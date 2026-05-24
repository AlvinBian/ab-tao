/**
 * config-sync.mjs — Claude 配置同步 Orchestrator
 *
 * 職責：
 *   1. 首次部署提示（firstRunSeen）
 *   2. 掃描 template 目錄，分類每個項目的同步操作
 *   3. 渲染計畫摘要（renderPlanSummary）
 *   4. 批次或逐一確認 drift（confirmPlan）
 *   5. 執行計畫（含 _archive/ 備份）
 *   6. 更新 state.json 與 chmod +x .sh 檔
 *
 * CI / 靜默模式：process.env.CI || process.env.AB_TAO_QUIET
 *   → 跳過互動，批次 drift 策略預設為「全部使用 ab-tao template」
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { APP_VERSION } from '../core/constants.mjs'
import { stateRead, stateWrite } from '../state/state.mjs'
import { showFirstRunNotice } from '../ui/first-run-notice.mjs'
import { renderPlanSummary } from '../ui/plan-summary.mjs'
import { mergeConfig } from './config-merge.mjs'

// ── 計畫項目型別 ────────────────────────────────────────────────

/**
 * @typedef {'create'|'mergeJson'|'overwriteFile'|'overwriteInteractive'|'lockedKeep'|'additiveKeep'|'forbiddenSkip'|'noChange'} PlanAction
 *
 * create               — home 不存在 → 直接複製
 * mergeJson            — JSON 檔 + 內容不同 → mergeConfig()
 * overwriteFile        — 非 JSON + 非 additive + drift + template 新版（本地無手動改動）
 * overwriteInteractive — 非 JSON + drift + 需使用者決策
 * lockedKeep           — choices.decision = keep-local（使用者已明確鎖定）
 * additiveKeep         — ADDITIVE_DIRS 中的本地獨有檔 → 保留
 * forbiddenSkip        — FORBIDDEN_DIRS → 完全跳過
 * noChange             — 內容相同，無需操作
 */

// ── 主入口 ────────────────────────────────────────────────────────

/**
 * 同步 Claude 配置
 *
 * 流程：
 *   showFirstRunNotice → buildSyncPlan → renderPlanSummary
 *     → confirmPlan（互動模式）→ executePlan → updateStateJson → chmodShFiles
 *
 * @param {object} opts
 * @param {string}  opts.home      目標目錄（~/.claude/）
 * @param {string}  opts.template  ab-tao template 根目錄（apps/dotfiles/claude/）
 * @param {object}  opts.policy    preserve-policy.mjs 匯出的策略物件
 * @param {'interactive'|'auto'} [opts.mode]
 * @param {boolean} [opts.dryRun]
 */
export async function syncConfig({
  home,
  template,
  policy,
  mode = 'interactive',
  dryRun = false,
}) {
  // 確保目標目錄存在
  fs.mkdirSync(home, { recursive: true })

  // P1.3 — 首次部署提示
  const state = stateRead()
  showFirstRunNotice(state)

  const plan = await buildSyncPlan(home, template, policy)

  // P1.1 — 計畫摘要
  renderPlanSummary(plan)

  if (dryRun) {
    console.log(pc.yellow('Dry-run 模式：不執行任何寫入'))
    return
  }

  // P1.2 — 批次 / 逐一互動確認
  const isQuiet = process.env.CI || process.env.AB_TAO_QUIET
  if (mode === 'interactive' && !isQuiet) {
    await confirmPlan(plan)
  }
  else if (isQuiet) {
    // CI 模式：全部 drift 自動使用 ab-tao template（等同批次 A）
    _applyBatchStrategy(plan, 'A')
  }
  else {
    // auto 模式：overwriteInteractive（有 drift 需使用者決策）一律跳過，保護本地改動
    for (const item of plan) {
      if (item.action === 'overwriteInteractive')
        item._skip = true
    }
  }

  await executePlan(plan, home, template, policy)
  await updateStateJson(plan)
  await chmodShFiles(home)
}

// ── buildSyncPlan ─────────────────────────────────────────────────

/**
 * 掃描 template 並分類每個項目
 *
 * 分類邏輯：
 *   1. FORBIDDEN_DIRS → forbiddenSkip
 *   2. 目標不存在 → create
 *   3. 內容相同 → noChange
 *   4. choices.decision = keep-local → lockedKeep
 *   5. JSON 檔不同 → mergeJson
 *   6. ADDITIVE_DIRS 有 drift → additiveKeep（不覆蓋）
 *   7. 其他有 drift → overwriteInteractive（需決策）
 *
 * @param {string} home     目標目錄
 * @param {string} template template 根目錄
 * @param {object} policy   preserve-policy
 * @returns {Promise<Array<PlanItem>>}
 */
export async function buildSyncPlan(home, template, policy) {
  const { additiveDirs = [], forbiddenDirs = [] } = policy ?? {}

  // 讀取現有 choices（用於 lockedKeep 判斷）
  const state = stateRead()
  const choices = state.choices ?? {}

  const items = []
  await _walkTemplate(
    template,
    template,
    home,
    additiveDirs,
    forbiddenDirs,
    choices,
    items,
  )
  return items
}

/**
 * 遞迴掃描 template 目錄樹
 */
async function _walkTemplate(
  templateRoot,
  currentDir,
  homeRoot,
  additiveDirs,
  forbiddenDirs,
  choices,
  items,
) {
  let entries
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const entry of entries) {
    const srcPath = path.join(currentDir, entry.name)
    const relPath = path.relative(templateRoot, srcPath)
    const destPath = path.join(homeRoot, relPath)

    // 取第一層目錄名（用於判斷 forbidden/additive）
    const topDir = relPath.split(path.sep)[0]

    // FORBIDDEN_DIRS：完全跳過（每個頂層目錄只記錄一次）
    if (forbiddenDirs.includes(topDir)) {
      // 只在遇到頂層目錄本身時記錄（避免重複計數子目錄/檔案）
      if (relPath === topDir) {
        items.push({ action: 'forbiddenSkip', relPath, srcPath, destPath })
      }
      continue
    }

    if (entry.isDirectory()) {
      await _walkTemplate(
        templateRoot,
        srcPath,
        homeRoot,
        additiveDirs,
        forbiddenDirs,
        choices,
        items,
      )
      continue
    }

    if (!entry.isFile())
      continue

    // 由 adjustGlobalSettings() 特化處理的檔案，此處跳過
    const SETTINGS_MANAGED = new Set([
      'settings.template.json',
      'hooks.json',
      'mcp.yml',
      'plugins.yml',
      'chezmoi-ignore',
      'ab-tao-template-origin.json',
    ])
    if (SETTINGS_MANAGED.has(entry.name) && relPath === entry.name)
      continue

    const destExists = fs.existsSync(destPath)

    // 目標不存在 → create
    if (!destExists) {
      items.push({ action: 'create', relPath, srcPath, destPath })
      continue
    }

    // 計算 sha256 比較內容
    const srcSha = _sha256(srcPath)
    const destSha = _sha256(destPath)

    // 內容相同 → noChange
    if (srcSha === destSha) {
      items.push({ action: 'noChange', relPath, srcPath, destPath })
      continue
    }

    // 內容不同 — 先檢查使用者鎖定選擇
    const choice = choices[relPath]
    if (choice?.decision === 'keep-local') {
      items.push({ action: 'lockedKeep', relPath, srcPath, destPath })
      continue
    }

    // JSON 檔 → mergeJson
    if (entry.name.endsWith('.json')) {
      items.push({ action: 'mergeJson', relPath, srcPath, destPath })
      continue
    }

    // ADDITIVE_DIRS 中有 drift → additiveKeep（不覆蓋本地）
    if (additiveDirs.includes(topDir)) {
      items.push({ action: 'additiveKeep', relPath, srcPath, destPath })
      continue
    }

    // 其他 → overwriteInteractive（需使用者決策）
    items.push({ action: 'overwriteInteractive', relPath, srcPath, destPath })
  }
}

// ── confirmPlan ────────────────────────────────────────────────────

/**
 * 互動式確認計畫（P1.2）
 *
 * drift ≥ 3 先問批次 [I/A/K/S]，否則直接逐一確認。
 * CI / 靜默模式由 syncConfig() 的呼叫方在進入此函式前攔截。
 *
 * 批次選項說明：
 *   I — 逐檔互動（預設）
 *   A — 全部使用 ab-tao template（自動備份本地 → _archive/）
 *   K — 全部保留本地（標記 userOverride，寫入 choices.decision = keep-local）
 *   S — 全部跳過本次（不做任何操作，不寫 state）
 *
 * @param {Array<PlanItem>} plan
 */
export async function confirmPlan(plan) {
  // 只處理需要互動決策的項目
  const driftItems = plan.filter(i => i.action === 'overwriteInteractive')
  if (driftItems.length === 0)
    return

  // P1.2 — drift ≥ 3 先問批次策略
  if (driftItems.length >= 3) {
    const batchChoice = await p.select({
      message: [
        `🔀 偵測到 ${pc.bold(String(driftItems.length))} 個檔案有 drift：`,
      ].join(''),
      options: [
        { value: 'I', label: '逐檔互動 逐一決定每個 drift 檔案（預設）' },
        {
          value: 'A',
          label: '全部套用 ab-tao template 自動備份至 _archive/',
        },
        { value: 'K', label: '全部保留本地 標記 userOverride 跳過更新' },
        { value: 'S', label: '全部跳過 本次不處理 drift' },
      ],
    })

    if (p.isCancel(batchChoice)) {
      // 取消 → 等同全部跳過
      _applyBatchStrategy(plan, 'S')
      p.log.warn('已取消 drift 決策，本次全部跳過')
      return
    }

    if (batchChoice !== 'I') {
      _applyBatchStrategy(plan, batchChoice)
      _persistBatchChoices(driftItems, batchChoice)
      return
    }
    // batchChoice === 'I' → 繼續逐一確認
  }

  // 逐一確認
  for (const item of driftItems) {
    const choice = await p.select({
      message: `${pc.yellow('🔀 drift')}：${pc.cyan(item.relPath)}`,
      options: [
        { value: 'apply', label: '使用 ab-tao template（自動備份本地）' },
        { value: 'keep', label: '保留本地（標記 userOverride）' },
        { value: 'skip', label: '跳過本次（不做變更）' },
      ],
    })

    if (p.isCancel(choice) || choice === 'skip') {
      item._skip = true
    }
    else if (choice === 'keep') {
      item._skip = true
      // 持久化 keep-local 選擇
      _persistSingleChoice(item.relPath, 'keep-local')
    }
    // choice === 'apply' → 保持 item 原狀（執行階段會覆蓋並備份）
  }
}

// ── 批次策略套用 ───────────────────────────────────────────────────

/**
 * 將批次策略套用到所有 overwriteInteractive 項目
 *
 * @param {Array<PlanItem>} plan
 * @param {'A'|'K'|'S'} strategy
 */
function _applyBatchStrategy(plan, strategy) {
  const driftItems = plan.filter(i => i.action === 'overwriteInteractive')
  if (strategy === 'A') {
    // 全部使用 ab-tao template → 不標記 _skip，executePlan 會直接覆蓋並備份
    return
  }
  // K / S 都標記跳過（執行時不覆蓋）
  for (const item of driftItems) {
    item._skip = true
  }
}

/**
 * 批次持久化選擇到 state.json
 *
 * @param {Array<PlanItem>} items
 * @param {'A'|'K'|'S'} strategy
 */
function _persistBatchChoices(items, strategy) {
  if (strategy === 'K') {
    // K → keep-local，寫入 choices
    const now = new Date().toISOString()
    stateWrite((draft) => {
      for (const item of items) {
        draft.choices[item.relPath] = {
          decision: 'keep-local',
          lockedAt: now,
        }
        // 同步更新 managed.userOverride
        if (draft.managed[item.relPath]) {
          draft.managed[item.relPath].userOverride = true
        }
      }
    })
  }
  // A → 使用 ab-tao template，不寫入 choices（下次重新計算）
  // S → 跳過本次，不持久化（下次重新 drift 判斷）
}

/**
 * 持久化單一檔案的 keep-local 選擇
 *
 * @param {string} relPath
 * @param {'keep-local'|'use-ab-tao'|'skip'} decision
 */
function _persistSingleChoice(relPath, decision) {
  const now = new Date().toISOString()
  stateWrite((draft) => {
    draft.choices[relPath] = { decision, lockedAt: now }
    if (draft.managed[relPath]) {
      draft.managed[relPath].userOverride = decision === 'keep-local'
    }
  })
}

// ── executePlan ────────────────────────────────────────────────────

/**
 * 執行計畫（含 _archive/ 備份）
 *
 * @param {Array<PlanItem>} plan
 * @param {string} home
 * @param {string} template
 * @param {object} policy
 */
export async function executePlan(plan, home, template, policy) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const archiveBase = path.join(home, '_archive', `v${APP_VERSION}-${ts}`)

  for (const item of plan) {
    try {
      await _executeItem(item, home, template, policy, archiveBase)
    }
    catch (err) {
      p.log.warn(`執行 ${item.relPath} 失敗：${err.message}`)
    }
  }
}

async function _executeItem(item, _home, _template, policy, archiveBase) {
  const { action, srcPath, destPath, relPath } = item

  switch (action) {
    case 'create': {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
      console.log(`  ${pc.green('✚')} ${relPath}`)
      break
    }

    case 'mergeJson': {
      const tplContent = JSON.parse(fs.readFileSync(srcPath, 'utf8'))
      const localContent = JSON.parse(fs.readFileSync(destPath, 'utf8'))
      const merged = mergeConfig(tplContent, localContent, policy)

      // 備份舊版本
      _archiveFile(destPath, relPath, archiveBase)

      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.writeFileSync(
        destPath,
        `${JSON.stringify(merged, null, 2)}\n`,
        'utf8',
      )
      console.log(`  ${pc.blue('⊕')} ${relPath} (merged)`)
      break
    }

    case 'overwriteInteractive':
    case 'overwriteFile': {
      if (item._skip) {
        console.log(`  ${pc.dim('○')} ${relPath} (跳過)`)
        break
      }
      // 備份舊版本
      _archiveFile(destPath, relPath, archiveBase)

      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
      console.log(`  ${pc.yellow('↺')} ${relPath}`)
      break
    }

    case 'lockedKeep':
      console.log(`  ${pc.dim('📌')} ${relPath} (鎖定保留本地)`)
      break

    case 'additiveKeep':
    case 'noChange':
    case 'forbiddenSkip':
      // 不做任何事
      break

    default:
      p.log.warn(`  未知操作：${action} for ${relPath}`)
  }
}

/**
 * 備份檔案到 _archive/
 */
function _archiveFile(srcPath, relPath, archiveBase) {
  if (!fs.existsSync(srcPath))
    return
  const archiveDest = path.join(archiveBase, relPath)
  fs.mkdirSync(path.dirname(archiveDest), { recursive: true })
  fs.copyFileSync(srcPath, archiveDest)
}

// ── updateStateJson ────────────────────────────────────────────────

/**
 * 更新 ~/.claude/.ab-tao/state.json
 * @param {Array<PlanItem>} plan
 */
export async function updateStateJson(plan) {
  const now = new Date().toISOString()

  stateWrite((s) => {
    for (const item of plan) {
      if (
        item.action === 'forbiddenSkip'
        || item.action === 'noChange'
        || item.action === 'additiveKeep'
        || item.action === 'lockedKeep'
        || item._skip
      ) {
        continue
      }

      if (!fs.existsSync(item.destPath))
        continue

      s.managed[item.relPath] = {
        sha256: _sha256(item.destPath),
        source: `ab-tao:${item.srcPath}`,
        installedAt: now,
        userOverride: false,
      }
    }

    s.installedAt = now
    s.abTaoVersion = APP_VERSION
  })
}

// ── chmodShFiles ───────────────────────────────────────────────────

/**
 * 對 home 下所有 .sh 執行 chmod +x
 * @param {string} home
 */
export async function chmodShFiles(home) {
  _walkShFiles(home, (filePath) => {
    try {
      fs.chmodSync(filePath, 0o755)
    }
    catch {
      /* 非致命 */
    }
  })
}

function _walkShFiles(dir, callback) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // 跳過 _archive（避免大量遞迴）
      if (entry.name === '_archive')
        continue
      _walkShFiles(fullPath, callback)
    }
    else if (entry.isFile() && entry.name.endsWith('.sh')) {
      callback(fullPath)
    }
  }
}

// ── 工具 ─────────────────────────────────────────────────────────

function _sha256(filePath) {
  try {
    const content = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(content).digest('hex')
  }
  catch {
    return null
  }
}
