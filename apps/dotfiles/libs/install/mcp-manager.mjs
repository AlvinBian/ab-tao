/**
 * mcp-manager.mjs — 宣告式 MCP Server 管理（Phase 12）
 *
 * 讀取 apps/dotfiles/claude/mcp.yml，依 active profile 篩選，
 * 將有效的 MCP servers 寫入 ~/.claude/settings.json 的 mcpServers 區塊。
 *
 * Secret 處理：
 *   1. 從 process.env 讀取 env_ref 指定的環境變數
 *   2. 若不存在 → 提示使用者（不中斷流程，server 標記為 skip）
 *   3. 絕不將 token 寫入 mcp.yml 本身
 */

import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { P } from '../core/paths.mjs'

const MCP_YML = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '../../claude/mcp.yml',
)

/** 讀取 mcp.yml 宣告 */
export function loadMcpYml() {
  const raw = fs.readFileSync(MCP_YML, 'utf8')
  return parseYaml(raw)
}

/**
 * 取得 settings.json 中的 mcpServers 區塊
 * @returns {Record<string, unknown>}
 */
export function getMcpServers() {
  try {
    const raw = fs.readFileSync(P.settings, 'utf8')
    return JSON.parse(raw).mcpServers ?? {}
  }
  catch {
    return {}
  }
}

/**
 * 判斷 server 是否在指定 profile 下啟用
 * @param {{ enabled_in_profiles?: string[] }} serverCfg
 * @param {string} profile
 */
function isEnabledForProfile(serverCfg, profile) {
  const profiles = serverCfg.enabled_in_profiles ?? []
  // 空陣列 = 全 profile 均啟用
  return profiles.length === 0 || profiles.includes(profile)
}

/**
 * 將 mcp.yml 宣告同步至 ~/.claude/settings.json
 * @param {{ profile?: string, dryRun?: boolean }} opts
 * @returns {{ applied: string[], skipped: string[], missing_secrets: string[] }}
 */
export function applyMcpServers({ profile = 'personal', dryRun = false } = {}) {
  const { servers } = loadMcpYml()
  const results = { applied: [], skipped: [], missing_secrets: [] }

  const newServers = {}

  for (const [name, cfg] of Object.entries(servers ?? {})) {
    if (!isEnabledForProfile(cfg, profile)) {
      results.skipped.push(`${name} (profile 不符)`)
      continue
    }

    // 解析 env_ref（支援 string 與 mapping 兩種形式）
    const env = {}
    if (cfg.env_ref) {
      const entries
        = typeof cfg.env_ref === 'string'
          ? [[cfg.env_ref, cfg.env_ref]]
          : Object.entries(cfg.env_ref) // [mcpEnvKey, processEnvKey]
      let hasError = false
      for (const [mcpKey, processEnvKey] of entries) {
        const val = process.env[processEnvKey]
        if (!val) {
          results.missing_secrets.push(`${name} (需要 $${processEnvKey})`)
          hasError = true
        }
        else {
          env[mcpKey] = val
        }
      }
      if (hasError) {
        results.skipped.push(`${name} (secret 缺失)`)
        continue
      }
    }

    newServers[name] = {
      command: cfg.command,
      args: cfg.args ?? [],
      ...(Object.keys(env).length > 0 ? { env } : {}),
    }
    results.applied.push(name)
  }

  if (!dryRun && results.applied.length > 0) {
    const settingsRaw = fs.readFileSync(P.settings, 'utf8')
    const settings = JSON.parse(settingsRaw)
    settings.mcpServers = { ...settings.mcpServers, ...newServers }
    fs.writeFileSync(
      P.settings,
      `${JSON.stringify(settings, null, 2)}\n`,
      'utf8',
    )
  }

  return results
}

/**
 * 列出所有宣告的 MCP servers 及其狀態
 * @param {string} profile
 */
export function listMcpServers(profile = 'personal') {
  const { servers } = loadMcpYml()
  const installed = getMcpServers()

  return Object.entries(servers ?? {}).map(([name, cfg]) => {
    const enabledForProfile = isEnabledForProfile(cfg, profile)
    const secretPresent
      = !cfg.env_ref
        || (typeof cfg.env_ref === 'string'
          ? !!process.env[cfg.env_ref]
          : Object.values(cfg.env_ref).every(k => !!process.env[k]))
    const isInstalled = name in installed

    return {
      name,
      description: cfg.description ?? '',
      enabledForProfile,
      secretPresent,
      installed: isInstalled,
      command: cfg.command,
      env_ref: cfg.env_ref ?? null,
      enabled_in_profiles: cfg.enabled_in_profiles ?? [],
    }
  })
}
