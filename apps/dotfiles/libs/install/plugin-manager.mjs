import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { P } from '../core/paths.mjs'

const PLUGINS_YML = path.join(import.meta.dirname, '../../claude/plugins.yml')

/** 讀取 plugins.yml 宣告 */
export function loadPluginsYml() {
  const raw = fs.readFileSync(PLUGINS_YML, 'utf8')
  return parseYaml(raw)
}

/**
 * 取得 settings.json 的 enabledPlugins
 * @returns {Record<string, boolean>}
 */
export function getEnabledPlugins() {
  try {
    const raw = fs.readFileSync(P.settings, 'utf8')
    return JSON.parse(raw).enabledPlugins ?? {}
  }
  catch {
    return {}
  }
}

/**
 * 讀取 installed_plugins.json → Record<key, [{installPath, version, ...}]>
 * @returns {Record<string, Array<{installPath: string, version: string, scope: string}>>}
 */
function getInstalledPluginPaths() {
  try {
    const raw = fs.readFileSync(P.pluginsInstalledJson, 'utf8')
    return JSON.parse(raw).plugins ?? {}
  }
  catch {
    return {}
  }
}

/**
 * 判斷 plugin 是否健康（installPath 存在且版本非 unknown）
 * @param {string} key  e.g. "hookify@claude-plugins-official"
 * @param {Record<string, Array<{installPath: string, version: string}>>} installedPlugins
 * @returns {boolean}
 */
function isPluginHealthy(key, installedPlugins) {
  const entries = installedPlugins[key]
  if (!entries || entries.length === 0)
    return false
  const entry = entries.find(e => e.scope === 'user') ?? entries[0]
  if (!entry?.installPath || entry.version === 'unknown')
    return false
  return fs.existsSync(entry.installPath)
}

/**
 * 驗證所有 enabledPlugins 的 cache 路徑健康（非 unknown、目錄存在）
 * @returns {{ broken: string[], ok: string[] }}
 */
export function verifyPluginCachePaths() {
  const enabled = getEnabledPlugins()
  const installed = getInstalledPluginPaths()
  const broken = []
  const ok = []
  for (const [key, isEnabled] of Object.entries(enabled)) {
    if (!isEnabled)
      continue
    if (isPluginHealthy(key, installed)) {
      ok.push(key)
    }
    else {
      broken.push(key)
    }
  }
  return { broken, ok }
}

/**
 * 驗證 enabledPlugins 無 phantom（enabled=true 但 plugins.yml 中無宣告）
 * @returns {{ phantoms: string[], valid: string[] }}
 */
export function verifyPluginIntegrity() {
  const { plugins } = loadPluginsYml()
  const enabled = getEnabledPlugins()
  const declared = new Set(
    Object.keys(plugins).map(
      name =>
        `${name}@${plugins[name].marketplace ?? 'claude-plugins-official'}`,
    ),
  )

  const phantoms = []
  const valid = []
  for (const [key, isEnabled] of Object.entries(enabled)) {
    if (!isEnabled)
      continue
    if (declared.has(key)) {
      valid.push(key)
    }
    else {
      phantoms.push(key)
    }
  }
  return { phantoms, valid }
}

/**
 * 列出所有宣告的 plugin 及其狀態
 */
export function listPlugins() {
  const { plugins } = loadPluginsYml()
  const enabled = getEnabledPlugins()
  return Object.entries(plugins || {}).map(([name, cfg]) => {
    const c = cfg || {}
    const key = `${name}@${c.marketplace ?? 'claude-plugins-official'}`
    return {
      name,
      key,
      declared: c.enabled !== false,
      installed: key in enabled,
      active: enabled[key] === true,
      description: c.description ?? '',
    }
  })
}

/**
 * 預先登錄所有宣告的 marketplace（包含 enabled:false 的 plugin），
 * 讓使用者之後可一鍵 enable 而不需另行 add marketplace
 */
function installMarketplaces(pluginsData) {
  const ids = new Set()
  for (const m of pluginsData.marketplaces ?? []) {
    if (m.id && m.id !== 'claude-plugins-official')
      ids.add(m.id)
  }
  for (const id of ids) {
    try {
      execFileSync('claude', ['plugin', 'marketplace', 'add', id], {
        stdio: 'pipe',
      })
    }
    catch {
      // 已存在或 CLI 不可用時靜默忽略（idempotent）
    }
  }
}

/**
 * 同步 plugins：安裝缺失的（dry-run 模式僅印出）
 * @param {{ dryRun?: boolean, profile?: string }} opts
 */
export function syncPlugins({ dryRun = false, profile } = {}) {
  const pluginsData = loadPluginsYml()
  const { plugins, profile_overrides } = pluginsData
  const overrides = profile ? profile_overrides?.[profile] : undefined
  const results = { installed: [], skipped: [] }

  // 預先登錄所有 marketplace（包含 enabled:false 的 plugin）
  if (!dryRun)
    installMarketplaces(pluginsData)

  const enabledPlugins = getEnabledPlugins()
  const installedPlugins = getInstalledPluginPaths()

  for (const [name, cfg] of Object.entries(plugins || {})) {
    const c = cfg || {}
    const marketplace = c.marketplace ?? 'claude-plugins-official'
    let shouldEnable = c.enabled !== false

    if (overrides?.disable?.includes(name))
      shouldEnable = false
    if (overrides?.enable?.includes(name))
      shouldEnable = true

    if (!shouldEnable)
      continue

    const key = `${name}@${marketplace}`
    // 已啟用且 cache 路徑健康 → 跳過；cache 路徑損壞（unknown / 不存在）→ 重安裝
    const alreadyHealthy
      = key in enabledPlugins && isPluginHealthy(key, installedPlugins)

    if (alreadyHealthy) {
      results.skipped.push(key)
    }
    else if (dryRun) {
      console.log(`[dry-run] 將安裝：${key}`)
    }
    else {
      try {
        const installName = cfg.installName ?? name
        execFileSync(
          'claude',
          ['plugin', 'install', installName, '--marketplace', marketplace],
          {
            stdio: 'inherit',
          },
        )
        results.installed.push(key)
        // mandatorySetup：安裝後執行必要初始化（如 always_on: false）
        for (const cmd of cfg.config?.mandatorySetup ?? []) {
          try {
            execFileSync(process.env.SHELL ?? '/bin/sh', ['-c', cmd], {
              stdio: 'pipe',
            })
          }
          catch {
            console.warn(`[ab-tao] mandatorySetup 失敗（可手動執行）: ${cmd}`)
          }
        }
      }
      catch (err) {
        console.error(`安裝失敗：${key}`, err.message)
      }
    }
  }

  return results
}
