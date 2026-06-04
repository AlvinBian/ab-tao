/**
 * Branch A: Claude Code 開發配置 + 專案配置
 *
 * 包含：
 *   [1] 全局配置（settings + hooks + RTK）
 *   [2] Claude 安裝（commands + agents + rules）
 *   [3] 專案配置（AI 資源 + Stacks）
 *
 * 提供 2 個可獨立呼叫的函式：
 *   - deployGlobalConfig  — 部署 settings + commands/agents/rules/hooks
 *   - installAiResources  — 安裝外部 AI 資源 + Commons 資源
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import { isEmpty } from 'lodash-es'
import { listrLogger } from '../../cli/logger.mjs'
import {
  ADDITIVE_DIRS,
  FORBIDDEN_DIRS,
  HOOKS_DEDUP_KEY,
  SETTINGS_ARRAY_MERGE,
  SETTINGS_PRESERVE_PATHS,
} from '../../config/preserve-policy.mjs'
import { HOME } from '../../core/paths.mjs'
import {
  buildSyncResult,
  writeSkillFiles,
  writeSyncedFiles,
} from '../../external/source-sync.mjs'
import { mergeConfig } from '../../install/config-merge.mjs'
import { syncConfig } from '../../install/config-sync.mjs'
import { runTarget } from '../../install/index.mjs'
import { applyMcpServers } from '../../install/mcp-manager.mjs'
import { t } from '../../ui/theme.mjs'
import { withSpinner } from '../../ui/with-spinner.mjs'
import { snapshotHashes, writeReloadMarker } from './reload-marker.mjs'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Hooks 三元組 dedup：(matcher, command) 相同時保留 id 版本
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 對同一 event 下的 hooks 陣列做 (matcher, command) 三元組 dedup。
 * 若同一 (matcher, innerCommands) 組合同時存在匿名條目 + id 條目，保留 id 版本並移除匿名。
 *
 * @param {Array} arr hooks 陣列（同一 event 下）
 * @returns {Array} dedup 後的陣列
 */
function _deduplicateHooks(arr) {
  const seen = new Map() // key = HOOKS_DEDUP_KEY(entry) → index in out
  const out = []
  for (const entry of arr) {
    const key = HOOKS_DEDUP_KEY(entry)
    if (!seen.has(key)) {
      seen.set(key, out.length)
      out.push(entry)
      continue
    }
    // 重複 key：若新進來的有 id 而既存的沒有 → 用 id 版本替換
    const prevIdx = seen.get(key)
    if (entry.id && !out[prevIdx].id) {
      out[prevIdx] = entry
    }
    // 否則丟棄（已有更好或同等版本）
  }
  return out
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Skills 結構遷移（三層 → 二層）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 偵測並自動遷移舊版三層 skills 結構到新版二層結構
 *
 * 舊版（v1）：skills/{source}/{name}/SKILL.md
 * 新版（v2）：skills/{name}/SKILL.md
 *
 * 判斷邏輯：若 skills/ 下的子目錄本身不含 SKILL.md 或 SKILL.md.disabled，
 * 則視為來源目錄（source dir），將其子目錄上移一層。
 *
 * @param {string} skillsRoot - ~/.claude/skills 或 preview/claude/skills 的絕對路徑
 * @returns {number} 已遷移的 skill 數量
 */
function migrateSkillsIfNeeded(skillsRoot) {
  if (!fs.existsSync(skillsRoot))
    return 0
  let migrated = 0
  const entries = fs.readdirSync(skillsRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory())
      continue
    const srcDir = path.join(skillsRoot, entry.name)
    // 若此目錄直接含有 SKILL.md 或 SKILL.md.disabled，視為二層葉節點，略過
    const hasSkillMd
      = fs.existsSync(path.join(srcDir, 'SKILL.md'))
        || fs.existsSync(path.join(srcDir, 'SKILL.md.disabled'))
    if (hasSkillMd)
      continue

    // 此目錄為來源目錄（三層結構）— 將子目錄上移一層
    const children = fs.readdirSync(srcDir, { withFileTypes: true })
    for (const child of children) {
      if (!child.isDirectory())
        continue
      const oldPath = path.join(srcDir, child.name)
      const newPath = path.join(skillsRoot, child.name)
      if (!fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath)
        migrated++
      }
    }
    // 移除已清空的來源目錄
    try {
      const remaining = fs.readdirSync(srcDir)
      if (remaining.length === 0)
        fs.rmdirSync(srcDir)
    }
    catch {
      // 略過無法移除的情況
    }
  }
  return migrated
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 獨立可呼叫函式（不依賴 Listr）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 部署全局配置 — settings + commands/agents/rules/hooks
 *
 * 包含兩階段：
 *   1. 合併 settings.json（模型、權限、自動記憶）
 *   2. 透過 runTarget 安裝 commands / agents / rules / hooks
 *
 * @param {object} opts
 * @param {string} opts.repoDir - dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview
 * @param {object} opts.targets - config.json targets
 * @param {string|null} opts.model - 用戶選擇的 model
 * @param {boolean} opts.isManual - 是否手動模式
 * @param {Array} [opts.targetKeys] - plan.targets（要安裝的 target 清單）
 * @param {Array} [opts.techStacks] - plan.techStacks（技術棧 ID）
 * @param {object | null} [opts.prev] - session（傳遞給 runTarget）
 * @param {object} [opts.logger] - 外部 logger（可選，給 runTarget 使用）
 * @returns {Promise<object>} installSelections - { commands, agents, rules, hooks }
 */
export async function deployGlobalConfig(opts) {
  const {
    repoDir,
    previewDir,
    targets,
    model,
    isManual,
    targetKeys = [],
    techStacks = [],
    prev = null,
    logger = null,
    preferences = null,
    slackEnv = null,
  } = opts

  const preHashes = snapshotHashes()
  const installSelections = {}

  // ── 階段 0：claude-hud wrapper 部署 ──
  const {
    deployClaudeHudWrapper,
    deployClaudeHudConfig,
    isClaudeHudPluginInstalled,
  } = await import('../../external/claude-hud.mjs')
  const hudSpinner = p.spinner()
  hudSpinner.start('部署 claude-hud wrapper...')
  const { deployed: claudeHudWrapperDeployed }
    = deployClaudeHudWrapper(repoDir)
  deployClaudeHudConfig(repoDir)
  const claudeHudPluginInstalled = isClaudeHudPluginInstalled()
  hudSpinner.stop(
    claudeHudWrapperDeployed
      ? 'claude-hud wrapper 已部署'
      : 'claude-hud wrapper 部署失敗（來源不存在）',
  )
  if (logger) {
    if (claudeHudWrapperDeployed) {
      logger(
        '✅ hud-wrapper.sh 已部署 → ~/.claude/plugins/claude-hud/hud-wrapper.sh',
      )
    }
    if (!claudeHudPluginInstalled) {
      logger(
        'ℹ️ claude-hud plugin 尚未安裝，重啟 Claude Code 後將自動拉取（已注入 marketplace + enabledPlugins）',
      )
    }
  }

  // ── 階段 0b：RTK ──
  try {
    const { checkAndInstallRtk, initRtk } = await import(
      '../../external/rtk.mjs',
    )
    const rtkSpin = p.spinner()
    rtkSpin.start('檢查 RTK...')
    const { installed, alreadyInstalled } = checkAndInstallRtk()
    if (installed && !alreadyInstalled)
      initRtk()
    rtkSpin.stop(installed ? 'RTK 已就緒' : 'RTK 略過（可選）')
  }
  catch {
    /* 不阻塞安裝 */
  }

  // ── 階段 1：透過 syncConfig 同步 Claude 配置目錄 ──
  const templateDir = path.join(repoDir, 'claude')
  const claudeHome = path.join(HOME, '.claude')
  if (fs.existsSync(templateDir)) {
    try {
      await syncConfig({
        home: claudeHome,
        template: templateDir,
        policy: {
          preservePaths: SETTINGS_PRESERVE_PATHS,
          additiveDirs: ADDITIVE_DIRS,
          forbiddenDirs: FORBIDDEN_DIRS,
          arrayMerge: SETTINGS_ARRAY_MERGE,
        },
        mode: 'auto',
        dryRun: false,
      })
    }
    catch (syncErr) {
      // 同步失敗不阻塞整體安裝
      if (logger)
        logger(`⚠️ config-sync 失敗：${syncErr.message}`)
    }
  }

  // ── 階段 1b：部署 settings.json（template + preserve merge）──
  const templateSettingsPath = path.join(
    repoDir,
    'claude',
    'settings.template.json',
  )
  const localSettingsPath = path.join(claudeHome, 'settings.json')
  if (fs.existsSync(templateSettingsPath)) {
    try {
      const templateSettings = JSON.parse(
        fs.readFileSync(templateSettingsPath, 'utf8'),
      )
      const localSettings = fs.existsSync(localSettingsPath)
        ? JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
        : {}
      const merged = mergeConfig(templateSettings, localSettings, {
        preservePaths: SETTINGS_PRESERVE_PATHS,
        arrayMerge: SETTINGS_ARRAY_MERGE,
      })
      // 用戶選擇的 model 總是優先（若有傳入）
      if (model)
        merged.model = model
      // Strip empty extraKnownMarketplaces（Claude Code 不需要此空陣列）
      if (
        Array.isArray(merged.extraKnownMarketplaces)
        && merged.extraKnownMarketplaces.length === 0
      ) {
        delete merged.extraKnownMarketplaces
      }
      // ── Slack 通知環境變數設定（由 configure() 階段預先收集）──
      if (slackEnv) {
        merged.env = { ...(merged.env ?? {}), ...slackEnv }
      }
      const mergedJson = `${JSON.stringify(merged, null, 2)}\n`
      let shouldWriteSettings = true
      if (fs.existsSync(localSettingsPath)) {
        try {
          shouldWriteSettings
            = fs.readFileSync(localSettingsPath, 'utf8') !== mergedJson
        }
        catch {
          /* proceed with write */
        }
      }
      if (shouldWriteSettings) {
        fs.writeFileSync(localSettingsPath, mergedJson, 'utf8')
      }
      if (logger) {
        logger(
          t.ok(
            'settings.json 已部署',
            `${t.count(Object.keys(merged).length)} 個欄位`,
          ),
        )
      }
    }
    catch (settingsErr) {
      if (logger)
        logger(t.warn(`settings.json 部署失敗：${settingsErr.message}`))
    }
  }

  // ── 階段 1c：合併 hooks/defs/*.json → settings.json.hooks ──
  // 使用 (matcher, command) 三元組 dedup，清除匿名殘留並保留 id 版本
  const defsDir = path.join(repoDir, 'claude', 'hooks', 'defs')
  if (fs.existsSync(defsDir) && fs.existsSync(localSettingsPath)) {
    try {
      const existingSettingsContent = fs.readFileSync(
        localSettingsPath,
        'utf8',
      )
      const s = JSON.parse(existingSettingsContent)
      s.hooks = s.hooks ?? {}
      let totalHooks = 0
      for (const file of fs
        .readdirSync(defsDir)
        .filter(f => f.endsWith('.json'))) {
        const def = JSON.parse(
          fs.readFileSync(path.join(defsDir, file), 'utf8'),
        )
        const event = def.event
        const handlers = def.hooks ?? []
        const existing = s.hooks[event] ?? []
        const existingIds = new Set(existing.map(h => h.id).filter(Boolean))
        const merged = [
          ...existing,
          ...handlers.filter(h => !existingIds.has(h.id)),
        ]
        // 三元組 dedup：(matcher, command) 相同時，保留有 id 的版本，清除匿名殘留
        s.hooks[event] = _deduplicateHooks(merged)
        totalHooks += handlers.length
      }
      const hooksJson = `${JSON.stringify(s, null, 2)}\n`
      if (hooksJson !== existingSettingsContent) {
        fs.writeFileSync(localSettingsPath, hooksJson, 'utf8')
      }
      if (logger)
        logger(t.ok('hooks 已合併 settings.json', `${t.count(totalHooks)} 個`))
    }
    catch (hooksErr) {
      if (logger)
        logger(t.warn(`hooks 合併失敗：${hooksErr.message}`))
    }
  }

  // ── 階段 1d：套用 mcp.yml → settings.json.mcpServers ──
  // applyMcpServers() 是 sync 函數，只更新 mcpServers key，不影響 hooks 或其他欄位
  try {
    const mcpProfile = opts?.profile ?? 'personal'
    const mcpResult = applyMcpServers({ profile: mcpProfile, dryRun: false })
    const applied = mcpResult.applied?.length ?? 0
    const skipped = mcpResult.missing_secrets?.length ?? 0
    if (logger) {
      logger(
        t.ok(
          'MCP servers 已套用',
          `${t.count(applied)} 個${skipped > 0 ? `，${t.count(skipped)} 個待設定 token` : ''}`,
        ),
      )
    }
    if (skipped > 0 && mcpResult.missing_secrets) {
      for (const s of mcpResult.missing_secrets) {
        if (logger)
          logger(t.info(s))
      }
    }
  }
  catch (mcpErr) {
    if (logger)
      logger(t.warn(`MCP 套用失敗：${mcpErr.message}`))
  }

  // ── 階段 2：runTarget 安裝 commands/agents/rules/hooks ──
  const completed = new Set()
  for (const key of targetKeys.filter(tk => tk !== 'zsh')) {
    if (!targets[key])
      continue
    const result = await runTarget(repoDir, previewDir, key, targets[key], {
      selectedTargets: targetKeys,
      completed,
      flagAll: true,
      manual: isManual,
      skillIds: techStacks,
      session: prev,
      logger,
    })
    if (result)
      Object.assign(installSelections, result)
    completed.add(key)
  }

  // ── 階段 3：部署 hook 偏好 + cache TTL ──
  if (preferences) {
    try {
      const { deployHookPrefs, deployCacheTtlToEnv } = await import(
        '../../core/preferences.mjs',
      )
      deployHookPrefs(preferences)
      if (logger)
        logger('✅ hook 偏好已部署 → ~/.claude/hooks/.prefs')
      const envPath = path.join(repoDir, '.env')
      if (deployCacheTtlToEnv(preferences, envPath) && logger) {
        logger('✅ cache TTL 已更新 → .env')
      }
    }
    catch {
      /* 不阻塞安裝 */
    }
  }

  // ── 清理：移除 ab-tao 棄用部署檔案 + git 防護 ──
  try {
    // 防止 ~/.claude 被 git 管理
    const gitDir = path.join(claudeHome, '.git')
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true })
      if (logger) {
        logger(
          t.warn('已移除 ~/.claude/.git（Claude 配置目錄不應被 git 管理）'),
        )
      }
    }
    // 清理棄用的 ab-tao 部署檔案
    const STALE_FILES = [
      'hooks.json',
      'mcp.yml',
      'plugins.yml',
      'chezmoi-ignore',
      'ab-tao-template-origin.json',
    ]
    const STALE_DIRS = ['profiles', 'memory-templates', 'ccline']
    for (const f of STALE_FILES) {
      const fp = path.join(claudeHome, f)
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp)
        if (logger)
          logger(t.info(`已清理舊檔：${f}`))
      }
    }
    for (const d of STALE_DIRS) {
      const dp = path.join(claudeHome, d)
      if (fs.existsSync(dp)) {
        fs.rmSync(dp, { recursive: true })
        if (logger)
          logger(t.info(`已清理舊目錄：${d}`))
      }
    }
  }
  catch (cleanErr) {
    if (logger)
      logger(t.warn(`清理步驟失敗：${cleanErr.message}`))
  }

  writeReloadMarker({ preHashes })
  return {
    ...installSelections,
    claudeHudWrapperDeployed,
    claudeHudPluginInstalled,
  }
}

/**
 * 安裝 AI 資源 — 外部源融合 + Commons 安裝
 *
 * 包含三部分：
 *   1. 外部 AI 資源融合（buildSyncResult + writeSyncedFiles）
 *   2. Commons 資源逐來源安裝（含 commands/agents/rules）
 *   3. Skills 安裝（writeSkillFiles）
 *
 * @param {object} opts
 * @param {string} opts.repoDir - dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview
 * @param {object} opts.plan - 含 aiRes, commonsSelections, techStacks
 * @param {object | null} opts.pipelineResult - 含 commonsResources
 * @param {object | null} opts.fetchedSources - fetchAllSources 結果
 * @param {boolean} opts.isManual
 * @returns {Promise<object>} { installSelections, syncResult, commonsSummary }
 */
export async function installAiResources(opts) {
  const { previewDir, plan, pipelineResult, fetchedSources, isManual } = opts

  const installSelections = {}
  let syncResult = null

  // ── 部分 1：外部 AI 資源融合 ──
  if ((plan.aiRes?.length ?? 0) > 0 && !isEmpty(fetchedSources?.sources)) {
    const aiResTypeMap = fetchedSources.aiResTypeMap || {}
    const aiResByType = {
      commands: new Set(),
      agents: new Set(),
      rules: new Set(),
    }
    for (const name of plan.aiRes) {
      const type = aiResTypeMap[name.replace('.md', '')] || 'commands'
      aiResByType[type]?.add(name)
    }
    syncResult = buildSyncResult(fetchedSources, aiResByType)
    const claudePreview = path.join(previewDir, 'claude')
    await withSpinner(
      '寫入 AI 資源（preview）',
      async () => writeSyncedFiles(syncResult.downloaded, claudePreview),
      { hint: claudePreview },
    )
    if (!isManual) {
      await withSpinner(
        '寫入 AI 資源（~/.claude）',
        async () =>
          writeSyncedFiles(syncResult.downloaded, path.join(HOME, '.claude')),
        { hint: '~/.claude' },
      )
    }
    // 更新 installSelections 以反映 AI 資源安裝
    for (const [type, names] of Object.entries(aiResByType)) {
      for (const name of names) {
        const n = name.replace('.md', '')
        if (!installSelections[type])
          installSelections[type] = []
        if (!installSelections[type].includes(n))
          installSelections[type].push(n)
      }
    }
  }

  // ── 部分 2 & 3：Commons 資源 + Skills 安裝 ──
  const commSources = pipelineResult?.commonsResources?.sources || []
  if (!isEmpty(commSources)) {
    const validFile = f => f?.name && f.content
    const selections = plan.commonsSelections || {}
    const filterBySelection = (items, srcName, type) => {
      const sel = selections[srcName]?.[type]
      if (!sel)
        return items.filter(validFile)
      const nameSet = new Set(sel)
      return items
        .filter(validFile)
        .filter(f => nameSet.has(f.name.replace('.md', '')))
    }
    const downloaded = commSources.map(src => ({
      source: src.name,
      commands: filterBySelection(src.commands || [], src.name, 'commands'),
      agents: filterBySelection(src.agents || [], src.name, 'agents'),
      rules: filterBySelection(src.rules || [], src.name, 'rules'),
      hooks: null,
    }))
    const claudePreview = path.join(previewDir, 'claude')
    await withSpinner(
      '寫入 Commons 資源（preview）',
      async () => writeSyncedFiles(downloaded, claudePreview),
      { hint: claudePreview },
    )
    if (!isManual) {
      await withSpinner(
        '寫入 Commons 資源（~/.claude）',
        async () => writeSyncedFiles(downloaded, path.join(HOME, '.claude')),
        { hint: '~/.claude' },
      )
    }

    // 安裝 skills（SKILL.md 格式，按用戶選擇過濾）
    // 注意：writeSkillFiles 使用 src.source 作為目錄名，commons 物件用 src.name
    const skillSources = commSources
      .map((s) => {
        const sel = selections[s.name]?.skills
        const filtered = sel
          ? s.skills.filter(sk => new Set(sel).has(sk.name))
          : s.skills
        return { ...s, source: s.name, skills: filtered || [] }
      })
      .filter(s => !isEmpty(s.skills))
    if (!isEmpty(skillSources)) {
      // 遷移偵測：在寫入前確認目錄結構為二層，自動修正舊版三層結構
      const s = p.spinner()
      s.start('檢查 skills 目錄結構...')
      const previewSkillsRoot = path.join(previewDir, 'claude', 'skills')
      const globalSkillsRoot = path.join(HOME, '.claude', 'skills')
      const previewMigrated = migrateSkillsIfNeeded(previewSkillsRoot)
      const globalMigrated = isManual
        ? 0
        : migrateSkillsIfNeeded(globalSkillsRoot)
      const migrated = previewMigrated + globalMigrated
      if (migrated > 0) {
        s.stop(`已遷移 ${migrated} 個 skills 到扁平結構`)
      }
      else {
        s.stop('skills 目錄結構正常')
      }

      const previewSkillResult = await writeSkillFiles(
        skillSources,
        path.join(previewDir, 'claude'),
      )
      let skipped = previewSkillResult?.skipped || []
      let failed = previewSkillResult?.failed || []
      if (!isManual) {
        const globalSkillResult = await writeSkillFiles(
          skillSources,
          path.join(HOME, '.claude'),
        )
        // 全局寫入的 skipped/failed 優先（代表實際部署結果）
        skipped = globalSkillResult?.skipped || skipped
        failed = globalSkillResult?.failed || failed
      }
      installSelections.skillsSkipped = skipped
      installSelections.skillsFailed = failed
    }

    // 更新 installSelections 以反映實際安裝
    for (const d of downloaded) {
      for (const cmd of d.commands || []) {
        const n = cmd.name.replace('.md', '')
        if (!installSelections.commands)
          installSelections.commands = []
        if (!installSelections.commands.includes(n))
          installSelections.commands.push(n)
      }
      for (const a of d.agents || []) {
        const n = a.name.replace('.md', '')
        if (!installSelections.agents)
          installSelections.agents = []
        if (!installSelections.agents.includes(n))
          installSelections.agents.push(n)
      }
      for (const r of d.rules || []) {
        const n = r.name.replace('.md', '')
        if (!installSelections.rules)
          installSelections.rules = []
        if (!installSelections.rules.includes(n))
          installSelections.rules.push(n)
      }
    }
    for (const s of skillSources) {
      for (const sk of s.skills || []) {
        if (!installSelections.skills)
          installSelections.skills = []
        if (!installSelections.skills.includes(sk.name))
          installSelections.skills.push(sk.name)
      }
    }
  }

  // 彙總 commons 安裝摘要（供呼叫端顯示，避免重複讀取 pipelineResult）
  const commonsSummary = {
    sourceCount: commSources.length,
    totalResources: commSources.reduce(
      (s, src) =>
        s
        + (src.commands?.length ?? 0)
        + (src.agents?.length ?? 0)
        + (src.rules?.length ?? 0)
        + (src.skills?.length ?? 0),
      0,
    ),
  }

  return { installSelections, syncResult, commonsSummary }
}

/**
 * 生成技術棧規則片段 — 呼叫 scan.mjs --init --no-ai --skills
 *
 * 產出：`REPO_DIR/.cache/stacks/{tech}/` 供 mergeSkillFragments 讀取注入。
 * 空清單時直接 return（防禦）。
 *
 * @param {string} repoDir - dotfiles repo 根目錄（apps/dotfiles）
 * @param {string[]} techStacks - 技術棧 ID 清單
 */
export async function generateStackFragments(repoDir, techStacks) {
  if (!techStacks?.length)
    return
  await new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['bin/scan.mjs', '--init', '--no-ai', '--skills', techStacks.join(',')],
      { cwd: repoDir },
    )
    child.on('close', (code) => {
      if (code === 0)
        resolve()
      else
        reject(new Error(`scan.mjs exit ${code}`))
    })
    child.on('error', reject)
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Listr 包裝層（向後相容）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 構建 Claude 安裝任務陣列
 *
 * 內部委託給 deployGlobalConfig / installAiResources，
 * 保留原有 Listr 任務結構以維持 phaseExecute 相容性。
 *
 * @param {object} plan - generateInstallPlan 產出
 * @param {object} opts
 * @param {string} opts.repoDir - @ab-tao/dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview 路徑
 * @param {object} opts.targets - config.json targets 定義
 * @param {object | null} opts.prev - session
 * @param {object | null} opts.pipelineResult
 * @param {object | null} opts.fetchedSources
 * @param {boolean} opts.isManual - 是否手動模式
 * @param {object} opts.installSelections - 共享狀態（寫入）
 * @param {object} opts.shared - 共享狀態物件 { syncResult }（寫入）
 * @param {object | null} [opts.preferences] - 用戶偏好設定
 * @returns {Array} Listr2 task 陣列
 */
export function buildClaudeTasks(
  plan,
  {
    repoDir,
    previewDir,
    targets,
    prev,
    pipelineResult,
    fetchedSources,
    isManual,
    installSelections,
    shared,
    preferences = null,
  },
) {
  // 預先提取 plan 屬性，避免子任務回呼透過閉包直接存取 plan 物件
  const features = new Set(plan.features || ['claude', 'zsh'])
  const has = f => features.has(f)
  const planModel = plan.model ?? null
  const planTargets = plan.targets || []
  const planTechStacks = plan.techStacks || []
  const planAiRes = plan.aiRes || []
  const planAiResCount = planAiRes.length
  const planTechStacksCount = planTechStacks.length

  return [
    // Branch A: Claude Code 開發配置 + 專案配置（順序執行，共用 ~/.claude/）
    {
      title: '🤖 Claude Code + 📁 專案配置',
      enabled: () => has('claude') || has('claudemd') || has('project'),
      task: (_, branchTask) =>
        branchTask.newListr(
          [
            // ━━━ Group 1: Claude Code 開發配置 ━━━
            {
              title: '🤖 Claude Code 開發配置',
              enabled: () => has('claude'),
              task: (_, task) =>
                task.newListr(
                  [
                    // [1] 全局配置（settings + hooks）
                    {
                      title: '⚙️ 全局配置 → ~/.claude/',
                      task: async (_, subtask) => {
                        // 實際部署由 deployGlobalConfig 統一處理（避免重複呼叫 deploySettings）
                        const templatePath = path.join(
                          repoDir,
                          'claude',
                          'settings.template.json',
                        )
                        if (fs.existsSync(templatePath)) {
                          subtask.output
                            = '將由 Claude 安裝步驟統一部署 settings'
                        }
                        else {
                          subtask.skip('settings.template.json 不存在')
                        }
                      },
                    },

                    // [2] Claude 安裝（commands + agents + rules + hooks → ~/.claude/）
                    {
                      title:
                        '📦 Claude 安裝 → ~/.claude/commands + agents + rules + hooks',
                      enabled: () => has('claude'),
                      task: async (_, subtask) => {
                        // 委託給 deployGlobalConfig 中的 runTarget 邏輯
                        const taskLogger = listrLogger(subtask)
                        const result = await deployGlobalConfig({
                          repoDir,
                          previewDir,
                          targets,
                          model: planModel,
                          isManual,
                          targetKeys: planTargets,
                          techStacks: planTechStacks,
                          prev,
                          logger: taskLogger,
                          preferences,
                        })
                        Object.assign(installSelections, result)
                        const parts = []
                        if (installSelections.commands?.length) {
                          parts.push(
                            `${installSelections.commands.length} commands`,
                          )
                        }
                        if (installSelections.agents?.length) {
                          parts.push(
                            `${installSelections.agents.length} agents`,
                          )
                        }
                        if (installSelections.rules?.length)
                          parts.push(`${installSelections.rules.length} rules`)
                        if (installSelections.hooks?.length)
                          parts.push(`${installSelections.hooks.length} hooks`)
                        subtask.output = parts.join(' · ') || '完成'
                      },
                    },
                  ],
                  { concurrent: false },
                ),
            },

            // ━━━ Group 2: 專案配置（repos + AI）━━━
            {
              title: '📁 專案配置（repos + AI）',
              enabled: () => has('claudemd') || has('project'),
              task: (_, task) =>
                task.newListr(
                  [
                    // [3] AI 資源 + 技術棧 Stacks
                    {
                      title: `🌐 AI 資源（${planAiResCount}）+ Stacks（${planTechStacksCount}）`,
                      enabled: () =>
                        has('project')
                        && (planAiResCount > 0 || planTechStacksCount > 0),
                      task: (_, subtask) =>
                        subtask.newListr(
                          [
                            {
                              title: `🌐 AI 資源融合 — ${planAiResCount} 個外部 commands/agents/rules`,
                              task: async (_, sub) => {
                                // 委託給 installAiResources
                                try {
                                  const aiResult = await installAiResources({
                                    repoDir,
                                    previewDir,
                                    plan,
                                    pipelineResult,
                                    fetchedSources,
                                    isManual,
                                  })
                                  // 回寫共享狀態
                                  if (aiResult.syncResult)
                                    shared.syncResult = aiResult.syncResult
                                  for (const [type, names] of Object.entries(
                                    aiResult.installSelections,
                                  )) {
                                    if (!installSelections[type])
                                      installSelections[type] = []
                                    for (const n of names) {
                                      if (!installSelections[type].includes(n))
                                        installSelections[type].push(n)
                                    }
                                  }

                                  // 組合輸出訊息（使用 aiResult.commonsSummary，避免直接存取閉包 pipelineResult）
                                  const msgParts = []
                                  const added
                                    = aiResult.syncResult?.downloaded?.length
                                      || 0
                                  if (added > 0)
                                    msgParts.push(`AI 資源已融合 ${added} 個`)
                                  const { sourceCount, totalResources }
                                    = aiResult.commonsSummary
                                  if (sourceCount > 0) {
                                    msgParts.push(
                                      `已安裝 ${sourceCount} 個 AI 來源（${totalResources} 個資源）`,
                                    )
                                  }
                                  sub.output
                                    = msgParts.join(' · ') || '無 AI 資源'
                                }
                                catch (err) {
                                  sub.output = `AI 資源安裝失敗（${err.message?.slice(0, 60)}）`
                                }
                              },
                            },
                            {
                              title: `🧬 Stacks 生成（${planTechStacksCount} 個技術棧）`,
                              task: async (_, sub) => {
                                if (planTechStacksCount > 0) {
                                  try {
                                    await new Promise((resolve, reject) => {
                                      const child = spawn(
                                        'node',
                                        [
                                          'bin/scan.mjs',
                                          '--init',
                                          '--no-ai',
                                          '--skills',
                                          planTechStacks.join(','),
                                        ],
                                        { cwd: repoDir },
                                      )
                                      child.on('close', (code) => {
                                        if (code === 0) {
                                          resolve()
                                        }
                                        else {
                                          reject(
                                            new Error(`scan.mjs exit ${code}`),
                                          )
                                        }
                                      })
                                      child.on('error', reject)
                                    })
                                    sub.output = `已生成 ${planTechStacksCount} 個技術棧規則`
                                  }
                                  catch (e) {
                                    sub.output = `生成失敗：${e.message?.slice(0, 50) || '未知錯誤'}`
                                    throw e
                                  }
                                }
                              },
                            },
                          ],
                          { concurrent: true, exitOnError: false },
                        ),
                    },
                  ],
                  { concurrent: false },
                ),
            },
          ],
          { concurrent: false },
        ),
    },
  ]
}
