/**
 * mcp.mjs — /api/mcp/* 路由
 *
 * 提供三支 endpoint：
 *   GET /api/mcp/servers      — 合併 ~/.claude.json 與 ~/.claude/settings.json 的 MCP Servers
 *   GET /api/mcp/plugins      — 解析 ~/.claude/settings.json enabledPlugins（物件格式）
 *   GET /api/mcp/marketplace  — 列舉 ~/.claude/plugins/marketplaces/ 本地快取
 */

import { readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const HOME = os.homedir()

/** 讀 JSON 檔，失敗時回傳 fallback */
async function readJson(filePath, fallback = {}) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  }
  catch {
    return fallback
  }
}

/**
 * 從 ~/.claude.json 的 projects[*].mcpServers 收集 per-project MCP Servers。
 * 每筆 server 的結構：{ name, type, url?, command?, args?, source, projectPath }
 */
async function collectProjectServers() {
  const claudeJson = await readJson(path.join(HOME, '.claude.json'), {})
  const projects = claudeJson.projects ?? {}
  const servers = []

  for (const [projectPath, project] of Object.entries(projects)) {
    const mcpServers = project?.mcpServers
    if (!mcpServers || typeof mcpServers !== 'object')
      continue

    for (const [name, cfg] of Object.entries(mcpServers)) {
      servers.push({
        name,
        type: cfg.type ?? 'stdio',
        url: cfg.url ?? null,
        command: cfg.command ?? null,
        args: cfg.args ?? null,
        source: 'project',
        projectPath,
      })
    }
  }

  return servers
}

/**
 * 從 ~/.claude.json 頂層 mcpServers 或 ~/.claude/settings.json mcpServers 收集全域 MCP Servers。
 * 優先讀 ~/.claude.json 頂層；再讀 settings.json 作為補充（不重複）。
 */
async function collectGlobalServers() {
  const claudeJson = await readJson(path.join(HOME, '.claude.json'), {})
  const settings = await readJson(
    path.join(HOME, '.claude', 'settings.json'),
    {},
  )

  // 合併兩個來源，以 server name 為唯一 key
  const map = new Map()

  for (const [, mcpServers] of [
    ['global-claude-json', claudeJson.mcpServers],
    ['global-settings', settings.mcpServers],
  ]) {
    if (!mcpServers || typeof mcpServers !== 'object')
      continue
    for (const [name, cfg] of Object.entries(mcpServers)) {
      if (!map.has(name)) {
        map.set(name, {
          name,
          type: cfg.type ?? 'stdio',
          url: cfg.url ?? null,
          command: cfg.command ?? null,
          args: cfg.args ?? null,
          source: 'global',
          projectPath: null,
        })
      }
    }
  }

  return [...map.values()]
}

/**
 * GET /api/mcp/servers
 * 合併全域與 per-project MCP Servers，以 name + source 去重。
 */
async function handleGetServers(res, json) {
  const [globalServers, projectServers] = await Promise.all([
    collectGlobalServers(),
    collectProjectServers(),
  ])

  // 去重策略：相同 name + source + projectPath 合為一筆
  const seen = new Set()
  const result = []

  for (const s of [...globalServers, ...projectServers]) {
    const key = `${s.name}|${s.source}|${s.projectPath ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(s)
    }
  }

  json(res, 0, 'ok', result)
  return true
}

/**
 * GET /api/mcp/plugins
 * 解析 enabledPlugins 物件 { "name@marketplace": true } → 陣列
 */
async function handleGetPlugins(res, json) {
  const settings = await readJson(
    path.join(HOME, '.claude', 'settings.json'),
    {},
  )
  const enabledPlugins = settings.enabledPlugins ?? {}

  const result = []

  for (const [key, enabled] of Object.entries(enabledPlugins)) {
    // 格式：name@marketplace（例：code-review@claude-plugins-official）
    const atIdx = key.lastIndexOf('@')
    const name = atIdx > 0 ? key.slice(0, atIdx) : key
    const marketplace = atIdx > 0 ? key.slice(atIdx + 1) : ''

    result.push({ name, marketplace, enabled: Boolean(enabled) })
  }

  json(res, 0, 'ok', result)
  return true
}

/**
 * GET /api/mcp/marketplace
 * 列舉 ~/.claude/plugins/marketplaces/ 子目錄，讀取 index.json（若存在）。
 * 不連線網路，僅回傳本地快取。
 */
async function handleGetMarketplace(res, json) {
  const marketplacesDir = path.join(HOME, '.claude', 'plugins', 'marketplaces')

  let entries
  try {
    entries = await readdir(marketplacesDir, { withFileTypes: true })
  }
  catch {
    // 目錄不存在或無讀取權限，回傳空陣列
    json(res, 0, 'ok', [])
    return true
  }

  const result = []

  for (const entry of entries) {
    if (!entry.isDirectory())
      continue

    const id = entry.name
    const indexPath = path.join(marketplacesDir, id, 'index.json')

    let plugins = []
    try {
      const indexJson = await readJson(indexPath, null)
      if (indexJson !== null) {
        // index.json 可能直接是陣列，或含 plugins 欄位
        plugins = Array.isArray(indexJson)
          ? indexJson
          : (indexJson.plugins ?? [])
      }
      else {
        // 無 index.json，嘗試列舉 plugins/ 子目錄
        const pluginsDir = path.join(marketplacesDir, id, 'plugins')
        try {
          const pluginEntries = await readdir(pluginsDir, {
            withFileTypes: true,
          })
          plugins = pluginEntries
            .filter(e => e.isDirectory())
            .map(e => ({ name: e.name }))
        }
        catch {
          // plugins 子目錄不存在，保留空陣列
        }
      }
    }
    catch {
      // 讀取失敗，保留空陣列
    }

    result.push({ id, plugins })
  }

  json(res, 0, 'ok', result)
  return true
}

/**
 * MCP 路由主函式
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {URL} url
 * @param {Function} json — 統一回應輔助 (res, code, message, data, status?)
 * @returns {Promise<boolean>} true = 已處理；false = 未匹配
 */
export async function mcpRouter(req, res, url, json) {
  // GET /api/mcp/servers
  if (req.method === 'GET' && url.pathname === '/api/mcp/servers') {
    return handleGetServers(res, json)
  }

  // GET /api/mcp/plugins
  if (req.method === 'GET' && url.pathname === '/api/mcp/plugins') {
    return handleGetPlugins(res, json)
  }

  // GET /api/mcp/marketplace
  if (req.method === 'GET' && url.pathname === '/api/mcp/marketplace') {
    return handleGetMarketplace(res, json)
  }

  return false
}
