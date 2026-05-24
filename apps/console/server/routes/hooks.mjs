/**
 * /api/hooks/* — Hook 重新部署 API
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DOTFILES_BIN } from '../sse.mjs'
import { backupSettings } from './settings.mjs'

const DOTFILES_ROOT = path.resolve(DOTFILES_BIN, '..')
const DOTFILES_LIB = path.resolve(DOTFILES_ROOT, 'libs')

let _P = null
async function getP() {
  if (!_P) {
    const m = await import(path.join(DOTFILES_LIB, 'core/paths.mjs'))
    _P = m.P
  }
  return _P
}
const HOOKS_SOURCE = path.join(DOTFILES_ROOT, 'claude', 'hooks')
const DEFS_DIR = path.join(HOOKS_SOURCE, 'defs')
const HOME = os.homedir()
const SETTINGS_PATH = path.join(HOME, '.claude', 'settings.json')
const HOOKS_DEST = path.join(HOME, '.claude', 'hooks')

function loadDefs() {
  if (!fs.existsSync(DEFS_DIR))
    return []
  return fs
    .readdirSync(DEFS_DIR)
    .filter(f => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DEFS_DIR, f), 'utf8'))
      }
      catch {
        return null
      }
    })
    .filter(Boolean)
}

function redeployDef(def) {
  const results = []

  // Step 1: 複製 .sh 腳本並設置執行權限
  for (const handler of def.hooks ?? []) {
    for (const h of handler.hooks ?? []) {
      const cmdStr = h.command ?? ''
      const match = cmdStr.match(/\.claude\/hooks\/([^/\s]+\.sh)/)
      if (!match)
        continue
      const scriptName = match[1]
      const src = path.join(HOOKS_SOURCE, scriptName)
      const dest = path.join(HOOKS_DEST, scriptName)
      if (fs.existsSync(src)) {
        fs.mkdirSync(HOOKS_DEST, { recursive: true })
        fs.copyFileSync(src, dest)
        fs.chmodSync(dest, 0o755)
        results.push({ script: scriptName, action: 'copied' })
      }
      else {
        results.push({ script: scriptName, action: 'source_missing' })
      }
    }
  }

  // Step 2: 更新 settings.json.hooks（id-dedup，保留非 ab-tao 的 hook）
  if (fs.existsSync(SETTINGS_PATH)) {
    const s = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
    s.hooks = s.hooks ?? {}
    const event = def.event
    const incoming = def.hooks ?? []
    const incomingIds = new Set(incoming.map(h => h.id))
    const existing = s.hooks[event] ?? []
    s.hooks[event] = [
      ...existing.filter(h => !incomingIds.has(h.id)),
      ...incoming,
    ]
    fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(s, null, 2)}\n`, 'utf8')
    results.push({ action: 'settings_patched', event, count: incoming.length })
  }

  return results
}

export async function hooksRouter(req, res, url, json) {
  // ── POST /api/hooks/redeploy ── { hookId: "ab-tao:pre:bash" | "all" }
  if (req.method === 'POST' && url.pathname === '/api/hooks/redeploy') {
    const { hookId } = req._body ?? {}
    if (!hookId) {
      json(res, 400, 'hookId is required', null, 400)
      return true
    }
    try {
      const P = await getP()
      const defs = loadDefs()
      const toRedeploy
        = hookId === 'all'
          ? defs
          : defs.filter(def =>
              (def.hooks ?? []).some(h => h.id === hookId),
            )
      if (toRedeploy.length === 0) {
        json(res, 404, `找不到 Hook "${hookId}"`, null, 404)
        return true
      }
      await backupSettings(P)
      const results = toRedeploy.flatMap(redeployDef)
      json(res, 0, '重新部署完成', { hookId, results })
    }
    catch (e) {
      json(res, 500, e.message, null, 500)
    }
    return true
  }

  return false
}
