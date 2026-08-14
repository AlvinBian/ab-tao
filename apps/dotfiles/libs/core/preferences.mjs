/**
 * 個人偏好系統 — 收集、持久化、部署
 *
 * 偏好分四組：終端環境 / 通知 / 安全攔截 / 進階快取
 * 部署目標：~/.zshrc.d/.prefs.zsh · ~/.claude/hooks/.prefs · .protected-files · .dangerous-patterns
 */

import fs from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import { BACK, handleCancel } from '../cli/prompts.mjs'
import { HOME } from './paths.mjs'

// ── GUI 編輯器路徑映射 ──────────────────────────────────────────
export const GUI_EDITOR_PATHS = {
  cursor: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
  kiro: '/Applications/Kiro.app/Contents/Resources/app/bin/code',
  vscode:
    '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
}

const GUI_EDITOR_LABELS = { cursor: 'Cursor', kiro: 'Kiro', vscode: 'VS Code' }

// ── 預設危險指令模式（ERE 正則，部署到 ~/.claude/hooks/.dangerous-patterns）──
//
// ⚠️ 2026-08-12 大幅精簡。原本 13 條當中有 10 條與 pre-tool-bash.sh 的
//    BUILTIN_PATTERNS 完全重複，另外 3 條（rm -rf / rm -fr / git push --force）
//    現已由該腳本直接處理（見其「高風險命令」段）。
//
// ⚠️ 更重要的是：在此之前這個檔案**從未真正生效過** —— pre-tool-bash.sh 的
//    pattern 驗證拿空字串去比對，任何正常 regex 都被判成「無效」而略過（同日修正）。
//    修好之後這裡的每一條都會真的擋人，所以**新增前務必確認不會誤傷日常操作**：
//    廣義的 'rm[[:space:]]+-[a-zA-Z]*[rR]…' 會擋掉 rm -rf node_modules，
//    字面的 'rm -rf /' 當成 ERE 則會匹配到 rm -rf /tmp/foo —— 兩種舊寫法都不能用。
//
// 只保留 BUILTIN_PATTERNS 沒涵蓋的缺口：
const DEFAULT_DANGEROUS_PATTERNS = [
  // 寫入 raw disk device（BUILTIN 只擋 > /etc/）
  '>[[:space:]]*/dev/(sd[a-z]|nvme[0-9]|disk[0-9])',
  'dd[[:space:]].*of=/dev/(sd[a-z]|nvme[0-9]|disk[0-9])',
  // eval 直接吃網路內容（BUILTIN 只擋 eval+base64 與 eval $(…)）
  'eval[[:space:]].*(curl|wget)',
]

// ── 偏好預設值 ────────────────────────────────────────────────────
export const PREF_DEFAULTS = {
  guiEditorOrder: ['kiro', 'cursor', 'vscode'],
  cliEditor: 'vim',
  nodeManagerOrder: ['fnm', 'nvm', 'n'],
  keybinding: 'emacs',
  uvOverridePip: true,
  starshipPreset: 'default',
  batTheme: 'TwoDark',
  notifyFlushSecs: 60,
  notifyLevels: {
    Notification: 'immediate',
    PermissionDenied: 'immediate',
    PreCompact: 'immediate',
    Stop: 'immediate',
    SessionEnd: 'batch',
    TaskCompleted: 'batch',
    SubagentStop: 'batch',
    PostToolUseFailure: 'batch',
  },
  protectedFiles: ['.env*', '*.lock', 'pnpm-lock.yaml', 'package-lock.json'],
  dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS,
  doctorExtraTools: [],
  cacheTtl: {
    sourceSync: 3600000,
    pipeline: 172800000,
    staleThreshold: 30,
  },
}

// ── 互動式偏好收集 ────────────────────────────────────────────────

/**
 * 互動式收集個人偏好
 * @param {object | null} prevPrefs - 上次儲存的偏好
 * @returns {object | null} 合併後的偏好物件，取消則返回 null
 */
export async function collectPreferences(prevPrefs) {
  const current = { ...PREF_DEFAULTS, ...(prevPrefs ?? {}) }

  p.log.step('🎛️ 個人偏好設定')

  // 顯示目前偏好摘要
  if (prevPrefs) {
    const summary = [
      `GUI: ${current.guiEditorOrder[0] ?? '未設定'}`,
      `CLI: ${current.cliEditor}`,
      `Node: ${current.nodeManagerOrder[0]}`,
      `按鍵: ${current.keybinding}`,
      `通知: ${current.notifyFlushSecs}s`,
      `Starship: ${current.starshipPreset}`,
    ].join('  ·  ')
    p.log.info(`目前：${summary}`)
  }

  const useDefaults = handleCancel(
    await p.confirm({
      message: prevPrefs ? '沿用目前偏好？' : '使用預設偏好？（推薦首次安裝）',
      initialValue: true,
    }),
  )
  if (useDefaults === BACK)
    return null
  if (useDefaults)
    return current

  // ── 🖥️ 終端環境 ──────────────────────────────────────────────
  p.log.step('🖥️ 終端環境')

  // 偵測已安裝的 GUI 編輯器（路徑存在即視為已安裝）
  const ALL_GUI_EDITORS = ['kiro', 'cursor', 'vscode']
  const installedEditors = ALL_GUI_EDITORS.filter(e =>
    fs.existsSync(GUI_EDITOR_PATHS[e]),
  )

  let guiEditorOrder
  if (installedEditors.length === 0) {
    p.log.warn('未偵測到已安裝的 GUI 編輯器，略過排序設定')
    guiEditorOrder = []
  }
  else {
    p.log.info(
      `偵測到已安裝：${installedEditors.map(e => GUI_EDITOR_LABELS[e]).join('、')}`,
    )

    const defaultOrderLabels = installedEditors
      .map(e => GUI_EDITOR_LABELS[e])
      .join(' > ')
    const isOrderCorrect = handleCancel(
      await p.confirm({
        message: `預設優先順序：${defaultOrderLabels}，是否正確？`,
        initialValue: true,
      }),
    )
    if (isOrderCorrect === BACK)
      return null

    if (isOrderCorrect) {
      guiEditorOrder = installedEditors
    }
    else {
      // 序列 select：依序讓使用者指定第 1、第 2… 優先的編輯器
      const remaining = [...installedEditors]
      const ordered = []
      const ordinals = ['第一', '第二', '第三']

      for (let i = 0; i < installedEditors.length; i++) {
        if (remaining.length === 1) {
          ordered.push(remaining[0])
          break
        }
        const pick = handleCancel(
          await p.select({
            message: `${ordinals[i] ?? `第 ${i + 1}`}優先 GUI 編輯器`,
            options: remaining.map(e => ({
              value: e,
              label: GUI_EDITOR_LABELS[e],
            })),
            initialValue: remaining[0],
          }),
        )
        if (pick === BACK)
          return null
        ordered.push(pick)
        remaining.splice(remaining.indexOf(pick), 1)
      }
      guiEditorOrder = ordered
    }
  }

  const cliEditor = handleCancel(
    await p.select({
      message: 'CLI 編輯器（git commit / 終端工具使用 $EDITOR）',
      options: [
        { value: 'vim', label: 'vim' },
        { value: 'nano', label: 'nano' },
        { value: 'vi', label: 'vi' },
      ],
      initialValue: current.cliEditor,
    }),
  )
  if (cliEditor === BACK)
    return null

  const nodeManagerPrimary = handleCancel(
    await p.select({
      message: '主要 Node 版本管理器',
      options: [
        { value: 'fnm', label: 'fnm（推薦）' },
        { value: 'nvm', label: 'nvm' },
        { value: 'n', label: 'n' },
      ],
      initialValue: current.nodeManagerOrder[0] ?? 'fnm',
    }),
  )
  if (nodeManagerPrimary === BACK)
    return null
  const nodeManagerOrder = [
    nodeManagerPrimary,
    ...['fnm', 'nvm', 'n'].filter(m => m !== nodeManagerPrimary),
  ]

  const keybinding = handleCancel(
    await p.select({
      message: 'ZSH 按鍵模式',
      options: [
        { value: 'emacs', label: 'emacs（預設）' },
        { value: 'vi', label: 'vi' },
      ],
      initialValue: current.keybinding,
    }),
  )
  if (keybinding === BACK)
    return null

  const uvOverridePip = handleCancel(
    await p.confirm({
      message: '用 uv 取代 pip（alias pip=\'uv pip\'）？',
      initialValue: current.uvOverridePip,
    }),
  )
  if (uvOverridePip === BACK)
    return null

  const starshipPreset = handleCancel(
    await p.select({
      message: 'Starship prompt 樣式',
      options: [
        {
          value: 'default',
          label: 'default 完整（語言版本 + git 狀態）（推薦）',
        },
        {
          value: 'minimal',
          label: 'minimal 精簡（目錄 + git branch + 字元）',
        },
        { value: 'full', label: 'full 詳細（含所有語言圖示）' },
        {
          value: 'catppuccin',
          label: 'catppuccin Mocha 分段式 powerline（需 Nerd Font）',
        },
      ],
      initialValue: current.starshipPreset,
    }),
  )
  if (starshipPreset === BACK)
    return null

  const batTheme = handleCancel(
    await p.select({
      message: 'bat 語法高亮主題（cat 替代工具）',
      options: [
        {
          value: 'TwoDark',
          label: 'TwoDark 深色雙色調（預設 · 推薦）',
        },
        { value: 'Dracula', label: 'Dracula 深紫科幻風' },
        { value: 'Nord', label: 'Nord 冷藍極簡風' },
        { value: 'Monokai Extended', label: 'Monokai Extended 經典暖色' },
        { value: 'GitHub', label: 'GitHub 淺色（日間模式）' },
      ],
      initialValue: current.batTheme ?? 'TwoDark',
    }),
  )
  if (batTheme === BACK)
    return null

  // ── 🔔 通知 ───────────────────────────────────────────────────
  p.log.step('🔔 通知設定')

  const notifyFlushSecsRaw = handleCancel(
    await p.text({
      message: '匯總通知延遲（秒）— 積累到此時間後一次性推送',
      initialValue: String(current.notifyFlushSecs),
      validate(v) {
        const n = Number(v)
        if (!Number.isInteger(n) || n < 5 || n > 3600)
          return '請輸入 5–3600 之間的整數'
      },
    }),
  )
  if (notifyFlushSecsRaw === BACK)
    return null
  const notifyFlushSecs = Number(notifyFlushSecsRaw)

  // ── 🔒 安全設定 ───────────────────────────────────────────────
  p.log.step('🔒 安全設定')

  const protectedFilesRaw = handleCancel(
    await p.text({
      message: '保護的檔案 pattern（逗號分隔）',
      placeholder: '.env*,*.lock,pnpm-lock.yaml,package-lock.json',
      initialValue: current.protectedFiles.join(','),
    }),
  )
  if (protectedFilesRaw === BACK)
    return null
  const protectedFiles = protectedFilesRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const keepDangerDefaults = handleCancel(
    await p.confirm({
      message: `沿用預設危險指令攔截（${DEFAULT_DANGEROUS_PATTERNS.length} 個正則）？`,
      initialValue: true,
    }),
  )
  if (keepDangerDefaults === BACK)
    return null
  const dangerousPatterns = keepDangerDefaults
    ? DEFAULT_DANGEROUS_PATTERNS
    : current.dangerousPatterns

  return {
    ...current,
    guiEditorOrder,
    cliEditor,
    nodeManagerOrder,
    keybinding,
    uvOverridePip,
    starshipPreset,
    batTheme,
    notifyFlushSecs,
    protectedFiles,
    dangerousPatterns,
  }
}

// ── 部署函式 ──────────────────────────────────────────────────────

/**
 * 部署 ~/.zshrc.d/.prefs.zsh（ZSH 腳本讀取）
 * @param {object} prefs - 偏好物件
 * @returns {string} 部署目標路徑
 */
export function deployZshPrefs(prefs) {
  if (!prefs)
    return null
  const safe = { ...PREF_DEFAULTS, ...prefs }
  const prefsDir = path.join(HOME, '.zshrc.d')
  fs.mkdirSync(prefsDir, { recursive: true })
  const dest = path.join(prefsDir, '.prefs.zsh')

  const editorPaths = (safe.guiEditorOrder || [])
    .map(e => GUI_EDITOR_PATHS[e])
    .filter(Boolean)

  const lines = [
    '# ab-tao 個人偏好（自動生成 — pnpm run d:setup 重新配置）',
    '# 使用 :- 格式：~/.zshrc 已設定的值優先，此檔僅提供預設值',
    '',
    '# GUI 編輯器偵測順序（open -e / code alias）',
    // eslint-disable-next-line no-template-curly-in-string
    'if [[ -z "${AB_GUI_EDITOR_ORDER+_}" ]]; then',
    '  AB_GUI_EDITOR_ORDER=(',
    ...editorPaths.map(ep => `    "${ep}"`),
    '  )',
    'fi',
    '',
    '# CLI 編輯器（git commit / 終端工具使用 $EDITOR）',
    `: "\${AB_CLI_EDITOR:=${safe.cliEditor}}"`,
    '',
    '# Node 版本管理器優先順序',
    // eslint-disable-next-line no-template-curly-in-string
    'if [[ -z "${AB_NODE_MANAGER_ORDER+_}" ]]; then',
    `  AB_NODE_MANAGER_ORDER=(${(safe.nodeManagerOrder || []).map(m => `"${m}"`).join(' ')})`,
    'fi',
    '',
    '# ZSH 按鍵模式',
    `: "\${AB_KEYBINDING:=${safe.keybinding}}"`,
    '',
    '# uv 覆蓋 pip',
    `: "\${AB_UV_OVERRIDE_PIP:=${safe.uvOverridePip ? 'true' : 'false'}}"`,
    '',
    '# Starship preset',
    `: "\${AB_STARSHIP_PRESET:=${safe.starshipPreset}}"`,
    '',
    '# bat 語法高亮主題',
    `: "\${AB_BAT_THEME:=${safe.batTheme ?? 'TwoDark'}}"`,
  ]

  const newContent = `${lines.join('\n')}\n`
  if (fs.existsSync(dest)) {
    try {
      if (fs.readFileSync(dest, 'utf8') === newContent)
        return dest
    }
    catch {
      /* proceed with write */
    }
  }
  fs.writeFileSync(dest, newContent)
  return dest
}

/**
 * 部署 ~/.claude/hooks/.prefs / .protected-files / .dangerous-patterns
 * @param {object} prefs - 偏好物件
 * @returns {string} 部署目標目錄
 */
export function deployHookPrefs(prefs) {
  if (!prefs)
    return null
  const safe = { ...PREF_DEFAULTS, ...prefs }
  const hooksDir = path.join(HOME, '.claude', 'hooks')
  fs.mkdirSync(hooksDir, { recursive: true })

  // 原子寫入：先寫 .tmp，再 rename，避免 hook 腳本讀到半空檔案
  const atomicWrite = (dest, content) => {
    if (fs.existsSync(dest)) {
      try {
        if (fs.readFileSync(dest, 'utf8') === content)
          return
      }
      catch {
        /* proceed with write */
      }
    }
    const tmp = `${dest}.tmp.${process.pid}`
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, dest)
  }

  // .prefs（bash source 格式）
  const prefsLines = [
    '# ab-tao hook 偏好（自動生成）',
    `AB_NOTIFY_FLUSH_SECS=${safe.notifyFlushSecs ?? PREF_DEFAULTS.notifyFlushSecs}`,
    ...Object.entries(safe.notifyLevels || PREF_DEFAULTS.notifyLevels).map(
      ([k, v]) => `AB_NOTIFY_LEVEL_${k}="${v}"`,
    ),
  ]
  atomicWrite(path.join(hooksDir, '.prefs'), `${prefsLines.join('\n')}\n`)

  // .protected-files（一行一個 pattern）
  atomicWrite(
    path.join(hooksDir, '.protected-files'),
    `${(safe.protectedFiles || PREF_DEFAULTS.protectedFiles).join('\n')}\n`,
  )

  // .dangerous-patterns（一行一個 ERE 正則）
  atomicWrite(
    path.join(hooksDir, '.dangerous-patterns'),
    `${(safe.dangerousPatterns || PREF_DEFAULTS.dangerousPatterns).join('\n')}\n`,
  )

  return hooksDir
}

/**
 * 若選用 catppuccin preset，返回 Nerd Font 安裝提示字串；否則返回 null
 * @param {object} prefs
 * @returns {string|null}
 */
export function getNerdFontHint(prefs) {
  if (!prefs || prefs.starshipPreset !== 'catppuccin')
    return null
  return [
    '  Catppuccin preset 需要 Nerd Font，請執行：',
    '    brew install --cask font-meslo-lg-nerd-font',
    '  安裝後在終端機字體設定中選 MesloLGS NF',
  ].join('\n')
}

/**
 * 從已部署的偏好檔案反向解析為 JS 偏好物件
 * 每個欄位獨立解析，失敗時使用 PREF_DEFAULTS 補齊，不會拋出例外
 * @returns {object} 解析後的偏好物件
 */
export function readPrefsFromDisk() {
  const prefs = structuredClone(PREF_DEFAULTS)

  // ── 解析 ~/.zshrc.d/.prefs.zsh ──
  const zshPrefsPath = path.join(HOME, '.zshrc.d', '.prefs.zsh')
  if (fs.existsSync(zshPrefsPath)) {
    try {
      const content = fs.readFileSync(zshPrefsPath, 'utf8')

      // AB_CLI_EDITOR="vim"  OR  : "${AB_CLI_EDITOR:=vim}"
      const cli = content.match(/AB_CLI_EDITOR(?:="|:=)([^"}\n]+)/)
      if (cli)
        prefs.cliEditor = cli[1].trim()

      // AB_KEYBINDING="emacs"  OR  : "${AB_KEYBINDING:=emacs}"
      const kb = content.match(/AB_KEYBINDING(?:="|:=)([^"}\n]+)/)
      if (kb)
        prefs.keybinding = kb[1].trim()

      // AB_UV_OVERRIDE_PIP=true|false  OR  : "${AB_UV_OVERRIDE_PIP:=true}"
      const uv = content.match(/AB_UV_OVERRIDE_PIP(?:=|:=)(\w+)/)
      if (uv)
        prefs.uvOverridePip = uv[1] === 'true'

      // AB_STARSHIP_PRESET="default"  OR  : "${AB_STARSHIP_PRESET:=default}"
      const sp = content.match(/AB_STARSHIP_PRESET(?:="|:=)([^"}\n]+)/)
      if (sp)
        prefs.starshipPreset = sp[1].trim()

      // AB_BAT_THEME="TwoDark"  OR  : "${AB_BAT_THEME:=TwoDark}"
      const bt = content.match(/AB_BAT_THEME(?:="|:=)([^"}\n]+)/)
      if (bt)
        prefs.batTheme = bt[1].trim()

      // AB_GUI_EDITOR_ORDER=( "/path/..." ... )  ← 新舊格式皆抓 /Applications/ 路徑
      const guiPaths = [...content.matchAll(/"(\/Applications\/[^"]+)"/g)].map(
        m => m[1],
      )
      if (guiPaths.length > 0) {
        const pathToKey = Object.fromEntries(
          Object.entries(GUI_EDITOR_PATHS).map(([k, v]) => [v, k]),
        )
        const guiEditorOrder = guiPaths
          .map(p => pathToKey[p])
          .filter(Boolean)
        if (guiEditorOrder.length > 0)
          prefs.guiEditorOrder = guiEditorOrder
      }

      // AB_NODE_MANAGER_ORDER=("fnm" "nvm" "n")  ← 新舊格式括號內容相同
      const nm = content.match(/AB_NODE_MANAGER_ORDER=\(([^)]+)\)/)
      if (nm) {
        const order = nm[1].replace(/"/g, '').split(/\s+/).filter(Boolean)
        if (order.length > 0)
          prefs.nodeManagerOrder = order
      }
    }
    catch {
      // 解析失敗，使用預設值，不影響流程
    }
  }

  // ── 解析 ~/.claude/hooks/.prefs ──
  const hookPrefsPath = path.join(HOME, '.claude', 'hooks', '.prefs')
  if (fs.existsSync(hookPrefsPath)) {
    try {
      const content = fs.readFileSync(hookPrefsPath, 'utf8')

      // AB_NOTIFY_FLUSH_SECS=60
      const flush = content.match(/^AB_NOTIFY_FLUSH_SECS=(\d+)/m)
      if (flush)
        prefs.notifyFlushSecs = Number(flush[1])

      // AB_NOTIFY_LEVEL_Stop="immediate"
      for (const m of content.matchAll(/^AB_NOTIFY_LEVEL_(\w+)="([^"]+)"/gm)) {
        const eventKey = m[1] // e.g. "Stop", "SessionEnd"
        const val = m[2]
        if (
          eventKey in prefs.notifyLevels
          && /^(immediate|batch|silent)$/.test(val)
        ) {
          prefs.notifyLevels[eventKey] = val
        }
      }
    }
    catch {
      // 解析失敗，使用預設值
    }
  }

  // ── 解析 ~/.claude/hooks/.protected-files ──
  const protectedPath = path.join(HOME, '.claude', 'hooks', '.protected-files')
  if (fs.existsSync(protectedPath)) {
    try {
      const lines = fs
        .readFileSync(protectedPath, 'utf8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#'))
      if (lines.length > 0)
        prefs.protectedFiles = lines
    }
    catch {
      // 解析失敗，使用預設值
    }
  }

  // ── 解析 ~/.claude/hooks/.dangerous-patterns ──
  const dangerPath = path.join(HOME, '.claude', 'hooks', '.dangerous-patterns')
  if (fs.existsSync(dangerPath)) {
    try {
      const lines = fs
        .readFileSync(dangerPath, 'utf8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#'))
      if (lines.length > 0)
        prefs.dangerousPatterns = lines
    }
    catch {
      // 解析失敗，使用預設值
    }
  }

  return prefs
}

/**
 * 更新 .env 檔案中的 cache TTL 鍵值
 * @param {object} prefs - 偏好物件
 * @param {string} envPath - .env 檔案絕對路徑
 * @returns {boolean} 是否有更新
 */
export function deployCacheTtlToEnv(prefs, envPath) {
  if (!prefs || !fs.existsSync(envPath))
    return false
  const ttl = prefs.cacheTtl ?? PREF_DEFAULTS.cacheTtl

  let content = fs.readFileSync(envPath, 'utf8')

  const updates = {
    AB_CACHE_TTL_SYNC: String(ttl.sourceSync ?? PREF_DEFAULTS.cacheTtl.sourceSync),
    AB_CACHE_TTL_PIPELINE: String(ttl.pipeline ?? PREF_DEFAULTS.cacheTtl.pipeline),
    AB_STALE_THRESHOLD_DAYS: String(ttl.staleThreshold ?? PREF_DEFAULTS.cacheTtl.staleThreshold),
  }

  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(content)) {
      content = content.replace(re, `${key}=${value}`)
    }
    else {
      if (!content.endsWith('\n'))
        content += '\n'
      content += `${key}=${value}\n`
    }
  }

  fs.writeFileSync(envPath, content)
  return true
}
