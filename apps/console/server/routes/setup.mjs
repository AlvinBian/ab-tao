/**
 * /api/setup/* — d:setup 互動精靈的 REST + SSE 封裝
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DOTFILES_BIN,
  runningTasks,
  spawnSse,
  sseHeaders,
  sseSend,
} from '../sse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOTFILES_LIB = path.resolve(__dirname, '../../../dotfiles/libs')

let _loadSession = null
let _clearSessionProgress = null

async function getSession() {
  if (!_loadSession) {
    const m = await import(path.join(DOTFILES_LIB, 'core/session.mjs'))
    _loadSession = m.loadSession
    _clearSessionProgress = m.clearSessionProgress
  }
  return {
    loadSession: _loadSession,
    clearSessionProgress: _clearSessionProgress,
  }
}

export async function setupRouter(req, res, url, json) {
  // ── GET /api/setup/session ──
  if (req.method === 'GET' && url.pathname === '/api/setup/session') {
    try {
      const { loadSession } = await getSession()
      const session = loadSession()
      json(res, 0, 'ok', session ?? {})
    }
    catch (e) {
      json(res, 500, e.message, null, 500)
    }
    return true
  }

  // ── DELETE /api/setup/progress ──
  if (req.method === 'DELETE' && url.pathname === '/api/setup/progress') {
    try {
      const { clearSessionProgress } = await getSession()
      clearSessionProgress()
      json(res, 0, '進度已清除', null)
    }
    catch (e) {
      json(res, 500, e.message, null, 500)
    }
    return true
  }

  // ── GET /api/setup/status ── 是否有任務正在執行
  if (req.method === 'GET' && url.pathname === '/api/setup/status') {
    json(res, 0, 'ok', {
      running: runningTasks.has('setup'),
      tasks: [...runningTasks.keys()],
    })
    return true
  }

  // ── DELETE /api/setup/execute ── 取消正在執行的 setup
  if (req.method === 'DELETE' && url.pathname === '/api/setup/execute') {
    const child = runningTasks.get('setup')
    if (child) {
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!child.killed)
          child.kill('SIGKILL')
      }, 3000)
      json(res, 0, '任務已取消', null)
    }
    else {
      json(res, 404, '無正在執行的 setup 任務', null, 404)
    }
    return true
  }

  // ── POST /api/setup/execute ── SSE：執行 d:setup --quick（非互動式快速安裝）
  if (req.method === 'POST' && url.pathname === '/api/setup/execute') {
    if (runningTasks.has('setup')) {
      sseHeaders(res)
      sseSend(res, {
        type: 'error',
        message: 'setup 任務正在執行中，請稍後再試',
      })
      sseSend(res, { type: 'done', success: false })
      res.end()
      return true
    }

    const {
      flags = [],
      dryRun = false,
      mode = 'quick',
    } = req._body ?? {}
    const extraFlags = Array.isArray(flags) ? [...flags] : []
    // 強制加上 --yes 跳過所有確認
    if (!extraFlags.includes('--yes'))
      extraFlags.push('--yes')
    // 模式 flag（預設 quick）
    if (mode === 'manual' && !extraFlags.includes('--manual'))
      extraFlags.push('--manual')
    if (mode === 'all' && !extraFlags.includes('--all'))
      extraFlags.push('--all')
    // 進階 flag
    if (dryRun && !extraFlags.includes('--dry-run'))
      extraFlags.push('--dry-run')

    spawnSse(
      res,
      req,
      'setup',
      process.execPath,
      [path.join(DOTFILES_BIN, 'setup.mjs'), ...extraFlags],
      { cwd: path.resolve(DOTFILES_BIN, '..') },
    )
    return true
  }

  return false
}
