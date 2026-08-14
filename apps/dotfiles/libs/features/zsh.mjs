/**
 * ZSH Feature — 完全獨立的 ZSH 環境模組安裝 pipeline
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 * 不依賴任何其他 feature，不碰 ~/.claude/，不呼叫 GitHub API。
 */

import fs from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import { isEmpty } from 'lodash-es'
import { BACK, handleCancel, multiselectWithPrefs } from '../cli/prompts.mjs'
import { HOME } from '../core/paths.mjs'
import { getZoxideStatus } from '../external/zoxide.mjs'

const MODULE_DESCRIPTIONS = {
  options: 'Shell 行為選項（AUTO_CD · NO_BEEP · EXTENDED_GLOB · AUTO_PUSHD）',
  history: '歷史記錄（50K + 去重 + 專案歷史自動切換）',
  keys: '按鍵綁定（Option+←/→ 跳單詞 · ↑↓ 前綴搜尋）',
  aliases: '編輯器偵測 + gh / uv + 通用命令縮寫',
  git: 'lazygit alias（主要 Git alias 由 gitconfig 管理）',
  functions: '工具速查（cheat）· 模糊搜索 alias（fa）· SSH 金鑰產生 · 解壓縮',
  tools: 'bat/eza/zoxide/fd/rg/tldr + FZF 環境（sheldon 管理插件）',
}

export default {
  id: 'zsh',
  label: '🐚 ZSH 環境模組',
  hint: 'history · keys · aliases · git · tools + sheldon 插件',
  dependsOn: [],
  conflicts: [],

  /**
   * 1. 環境檢查（只查 brew + sheldon）
   */
  async envCheck() {
    const checks = []
    const ok = true

    // Homebrew
    try {
      const { execFileSync } = await import('node:child_process')
      const ver = execFileSync('brew', ['--version'], { stdio: 'pipe' })
        .toString()
        .match(/Homebrew ([\d.]+)/)?.[1]
      checks.push(`Homebrew ${ver || '✔'}`)
    }
    catch {
      checks.push('Homebrew ✗（安裝 CLI 工具需要）')
    }

    // sheldon
    try {
      const { execFileSync } = await import('node:child_process')
      execFileSync('which', ['sheldon'], { stdio: 'pipe' })
      checks.push('sheldon ✔')
    }
    catch {
      checks.push('sheldon ✗（安裝時會自動安裝）')
    }

    // zoxide（tools 模組依賴 — 安裝時會自動 brew install）
    try {
      const { getZoxideVersion } = await import('../external/zoxide.mjs')
      const zv = getZoxideVersion()
      checks.push(zv ? `zoxide ${zv}` : 'zoxide ✗（安裝時會自動安裝）')
    }
    catch {
      /* 不阻塞 envCheck */
    }

    return { ok, message: checks.join(' · ') }
  },

  /**
   * 2. 備份（只備份 ZSH 相關）
   */
  async backup(ctx) {
    const backupDir = ctx.backupDir
    fs.mkdirSync(backupDir, { recursive: true })
    const backed = []

    const tryBackup = (src, name) => {
      if (fs.existsSync(src)) {
        const dest = path.join(backupDir, name)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.cpSync(src, dest, { recursive: true })
        backed.push(name)
      }
    }

    tryBackup(path.join(HOME, '.zshrc'), 'zshrc')
    tryBackup(path.join(HOME, '.zshrc.d'), 'zshrc.d')
    tryBackup(path.join(HOME, '.ripgreprc'), 'ripgreprc')
    tryBackup(path.join(HOME, '.gitconfig'), 'gitconfig')
    tryBackup(path.join(HOME, '.config', 'starship.toml'), 'starship.toml')

    return { files: backed, dir: backupDir }
  },

  /**
   * 3. 互動配置（模組選擇）
   */
  async configure(ctx) {
    // 發現可選模組（排除恆常部署的 00-env、90-plugins）
    const confDir = path.join(ctx.repoDir, 'zsh', 'modules')
    const allFiles = fs.existsSync(confDir)
      ? fs.readdirSync(confDir).filter(f => f.endsWith('.zsh'))
      : []
    const selectableModules = allFiles
      .map(f => f.replace('.zsh', ''))
      .filter(name => !name.startsWith('00-') && !name.startsWith('90-'))

    const items = selectableModules.map((name) => {
      const shortName = name.replace(/^\d+-/, '')
      const desc = MODULE_DESCRIPTIONS[shortName]
      return {
        value: name,
        label: desc ? `${shortName} ${desc}` : shortName,
        disabled: false,
      }
    })

    if (ctx.flags?.all) {
      return { modules: selectableModules }
    }

    if (ctx.flags?.quick) {
      // 從 session 重建（上次安裝的模組）
      const prevModules = ctx.prev?.install?.modules
      if (prevModules?.length)
        return { modules: prevModules }
      return { modules: selectableModules } // fallback 全選
    }

    // @clack/core v1.2.0 在 options 為空陣列時會崩潰（讀取 options[0].disabled）
    if (isEmpty(items)) {
      return { modules: [] }
    }

    const selected = handleCancel(
      await multiselectWithPrefs(
        'zsh.modules',
        items,
        ({ options: sortedOpts, initialValues }) => p.multiselect({
          message: '選擇要安裝的 ZSH 模組',
          options: sortedOpts,
          initialValues: initialValues.length ? initialValues : selectableModules,
          required: false,
        }),
      ),
    )

    if (selected === BACK || isEmpty(selected)) {
      return null
    }

    return { modules: selected }
  },

  /**
   * 4. 生成計畫
   */
  async plan(ctx, config) {
    if (!config)
      return null
    const moduleNames = config.modules.map(m => m.replace(/^\d+-/, ''))
    return {
      features: ['zsh'],
      targets: ['zsh'],
      zshModules: moduleNames,
      mode: ctx.flags?.manual ? 'manual' : 'auto',
    }
  },

  /**
   * 5. 確認
   */
  async confirm(ctx, plan) {
    if (!plan)
      return false
    if (ctx.flags?.all || ctx.flags?.quick)
      return true

    const lines = [
      `ZSH 模組 → ~/.zshrc.d/（${plan.zshModules.length} 可選 + 2 恆常 + sheldon 插件）`,
      ...plan.zshModules.map(
        m => `  · ${m} — ${MODULE_DESCRIPTIONS[m] || ''}`,
      ),
    ]

    p.log.info(lines.join('\n'))

    const ok = handleCancel(
      await p.confirm({
        message: '確認安裝？',
        initialValue: true,
      }),
    )

    return ok === true
  },

  /**
   * 6. 安裝
   */
  async install(ctx, plan) {
    if (!plan)
      return null

    const { runWithProgress } = await import('../cli/progress.mjs')
    const { CLACK_LOGGER } = await import('../cli/logger.mjs')

    const moduleNames = plan.zshModules
    const script = 'zsh zsh/install.sh'

    CLACK_LOGGER.info(`安裝 ${moduleNames.length} 個 ZSH 模組 → ~/.zshrc.d/`)

    // total 由 install.sh 動態輸出 TOTAL:XX（fallback 30）
    await runWithProgress(`${script} --modules ${moduleNames.join(',')}`, {
      cwd: ctx.repoDir,
      total: 30,
      logger: CLACK_LOGGER,
      parseProgress(line) {
        // 匹配所有 ✔/▶/⚠ 開頭的進度行
        if (/^\s+[✔▶⚠]/.test(line)) {
          // 提取關鍵字作為 label
          const match = line.match(/[✔▶⚠]\s+(.+)/)
          const label = match?.[1]?.trim() || ''
          return label || null
        }
        return null
      },
    })

    // ── tools 模組依賴的 zoxide：未安裝則自動 brew install ──
    // zoxide init 配置已在 60-tools.zsh，但 guard `_command_exists zoxide`
    // 需工具實際存在才生效，故在此補上 Node 層自動安裝（對齊 RTK pattern）。
    if (moduleNames.includes('tools')) {
      try {
        const { checkAndInstallZoxide } = await import('../external/zoxide.mjs')
        const { installed, alreadyInstalled } = checkAndInstallZoxide()
        if (installed && alreadyInstalled)
          CLACK_LOGGER.info('zoxide 已安裝')
        else if (installed)
          CLACK_LOGGER.info('zoxide 已安裝 → brew install zoxide')
        else CLACK_LOGGER.warn('zoxide 安裝略過（brew 不可用，可手動 brew install zoxide）')
      }
      catch {
        /* 不阻塞安裝 */
      }
    }

    // ── 部署個人偏好 ──
    const prefs = ctx.preferences
    if (prefs) {
      try {
        const { deployZshPrefs } = await import('../core/preferences.mjs')
        deployZshPrefs(prefs)
        CLACK_LOGGER.info('偏好已部署 → ~/.zshrc.d/.prefs.zsh')
      }
      catch {
        /* 不阻塞安裝 */
      }
    }

    // ── Starship preset 選擇 ──
    const preset = prefs?.starshipPreset ?? 'default'
    if (preset !== 'default') {
      try {
        const presetSrc = path.join(
          ctx.repoDir,
          'zsh',
          `starship-${preset}.toml`,
        )
        const dest = path.join(HOME, '.config', 'starship.toml')
        if (fs.existsSync(presetSrc)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          let starshipChanged = true
          if (fs.existsSync(dest)) {
            try {
              starshipChanged = !fs
                .readFileSync(presetSrc)
                .equals(fs.readFileSync(dest))
            }
            catch {
              /* proceed */
            }
          }
          if (starshipChanged) {
            fs.copyFileSync(presetSrc, dest)
            CLACK_LOGGER.info(`Starship preset → ${preset}`)
          }
        }
      }
      catch {
        /* 不阻塞安裝 */
      }
    }

    return { modules: moduleNames }
  },

  /**
   * 7. 驗證
   */
  async verify(_ctx, installResult) {
    const confDir = path.join(HOME, '.zshrc.d', 'conf')
    let passed = 0
    let total = 0
    const missing = []

    // 檢查恆常模組
    for (const core of ['00-env.zsh', '90-plugins.zsh']) {
      total++
      if (fs.existsSync(path.join(confDir, core)))
        passed++
      else missing.push(core)
    }

    // 檢查 sheldon
    const toml = path.join(HOME, '.zshrc.d', 'sheldon', 'plugins.toml')
    total++
    if (fs.existsSync(toml))
      passed++
    else missing.push('plugins.toml')

    // 檢查 loader
    try {
      const zshrc = fs.readFileSync(path.join(HOME, '.zshrc'), 'utf8')
      total++
      if (zshrc.includes('ab-tao:loader'))
        passed++
      else missing.push('loader in .zshrc')
    }
    catch {
      total++
      missing.push('.zshrc')
    }

    // 檢查用戶選擇的模組（使用安裝結果精確核對）
    const modules = installResult?.modules ?? []
    if (modules.length > 0 && fs.existsSync(confDir)) {
      const confFiles = fs.readdirSync(confDir)
      for (const mod of modules) {
        total++
        const found = confFiles.some(
          f => f.endsWith(`-${mod}.zsh`) || f === `${mod}.zsh`,
        )
        if (found)
          passed++
        else missing.push(`${mod}.zsh`)
      }
    }

    // 檢查 .gitconfig
    total++
    if (fs.existsSync(path.join(HOME, '.gitconfig')))
      passed++
    else missing.push('.gitconfig')

    // 檢查 starship.toml
    total++
    if (fs.existsSync(path.join(HOME, '.config', 'starship.toml')))
      passed++
    else missing.push('starship.toml')

    return { passed, total, missing }
  },

  /**
   * 8. 完成輸出
   */
  complete(results) {
    if (!results)
      return []
    const starshipExists = fs.existsSync(
      path.join(HOME, '.config', 'starship.toml'),
    )
    const gitconfigExists = fs.existsSync(path.join(HOME, '.gitconfig'))
    const lines = [
      '🐚 ZSH 模組（~/.zshrc.d/ + sheldon）',
      `  已安裝：${results.modules?.join('、') || '無'}`,
      `  .gitconfig: ${gitconfigExists ? '✔（24 aliases + delta）' : '✗'}`,
      `  Starship: ${starshipExists ? '✔（Go/Rust/PHP/Java/Docker）' : '✗（未安裝 starship）'}`,
    ]
    // zoxide：tools 模組選中時才回報（智能 cd，命令 z xxx）
    if (results.modules?.includes('tools')) {
      const z = getZoxideStatus()
      lines.push(
        `  zoxide: ${z.installed ? `✔ v${z.version || '?'}（z xxx 智能跳目錄）` : '✗（brew install zoxide）'}`,
      )
    }
    lines.push('  執行 exec zsh 立即套用')
    return lines
  },

  /**
   * 9. 回滾
   */
  async rollback(ctx) {
    const backupDir = ctx.backupDir
    if (!fs.existsSync(backupDir))
      return

    const restore = (name, dest) => {
      const src = path.join(backupDir, name)
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true })
      }
    }

    restore('zshrc', path.join(HOME, '.zshrc'))
    restore('zshrc.d', path.join(HOME, '.zshrc.d'))
    restore('ripgreprc', path.join(HOME, '.ripgreprc'))
    restore('gitconfig', path.join(HOME, '.gitconfig'))
    restore('starship.toml', path.join(HOME, '.config', 'starship.toml'))
  },

  /**
   * 10. Session 數據
   */
  session(results) {
    return {
      modules: results?.modules || [],
      installedAt: new Date().toISOString(),
    }
  },

  /**
   * 11. 清理
   */
  async cleanup(ctx) {
    // 清理 preview 目錄
    if (fs.existsSync(ctx.previewDir)) {
      fs.rmSync(ctx.previewDir, { recursive: true, force: true })
    }
  },

  /**
   * 12. 報告數據
   */
  report(results) {
    return {
      feature: 'zsh',
      modules: results?.modules || [],
      target: '~/.zshrc.d/',
    }
  },
}
