/**
 * /api/sync/* — iCloud 偏好同步 REST + SSE 封裝
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runningTasks, sseHeaders, sseSend } from '../sse.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOTFILES_LIB = path.resolve(__dirname, '../../../dotfiles/libs')

let _abAsync = null
async function getAbAsync() {
  if (!_abAsync) {
    _abAsync = await import(path.join(DOTFILES_LIB, 'external/ab-async.mjs'))
  }
  return _abAsync
}

export async function syncRouter(req, res, url, json) {
  // ── GET /api/sync/status ──
  if (req.method === 'GET' && url.pathname === '/api/sync/status') {
    try {
      const { getSyncStatus } = await getAbAsync()
      // 轉發 sync99Local 查詢參數，避免 diffs 少算 99-local.zsh
      const sync99Local = url.searchParams?.get('sync99Local') === 'true'
      json(res, 0, 'ok', getSyncStatus({ sync99Local }))
    }
    catch (e) {
      json(res, 500, e.message, null, 500)
    }
    return true
  }

  // ── DELETE /api/sync ── 取消正在執行的同步
  if (req.method === 'DELETE' && url.pathname === '/api/sync') {
    const controller = runningTasks.get('sync')
    if (controller && typeof controller.abort === 'function') {
      controller.abort()
      json(res, 0, '同步已取消', null)
    }
    else {
      json(res, 404, '無正在執行的同步任務', null, 404)
    }
    return true
  }

  // ── POST /api/sync/push ── SSE（快速但仍同步執行）
  if (req.method === 'POST' && url.pathname === '/api/sync/push') {
    // push 與 pull 共用 'sync' key，防止同時執行造成 .ab-sync.json 競態
    if (runningTasks.has('sync')) {
      sseHeaders(res)
      sseSend(res, { type: 'error', message: '同步任務正在執行中' })
      sseSend(res, { type: 'done', success: false })
      res.end()
      return true
    }

    const controller = new AbortController()
    const { signal } = controller
    sseHeaders(res)
    runningTasks.set('sync', controller)

    req.on('close', () => {
      if (!signal.aborted)
        controller.abort()
      runningTasks.delete('sync')
    })

    try {
      const { pushPrefs } = await getAbAsync()
      sseSend(res, { type: 'log', message: '推送偏好設定至 iCloud…' })
      const result = await Promise.resolve(
        pushPrefs({
          sync99Local: req._body?.sync99Local,
          dryRun: req._body?.dryRun,
        }),
      )
      if (!res.writableEnded) {
        for (const f of result.dry ?? [])
          sseSend(res, { type: 'log', message: `[DRY-RUN] 將推送：${f}` })
        for (const f of result.pushed ?? [])
          sseSend(res, { type: 'log', message: `✓ 推送：${f}` })
        for (const f of result.skipped ?? [])
          sseSend(res, { type: 'log', message: `— 跳過：${f}` })
        for (const f of result.errors ?? [])
          sseSend(res, { type: 'log', level: 'warn', message: `✗ 錯誤：${f}` })
        sseSend(res, { type: 'done', success: true, result })
      }
    }
    catch (e) {
      if (!res.writableEnded) {
        sseSend(res, { type: 'error', message: e.message })
        sseSend(res, { type: 'done', success: false })
      }
    }
    finally {
      runningTasks.delete('sync')
      if (!res.writableEnded)
        res.end()
    }
    return true
  }

  // ── POST /api/sync/pull ── SSE
  if (req.method === 'POST' && url.pathname === '/api/sync/pull') {
    if (runningTasks.has('sync')) {
      sseHeaders(res)
      sseSend(res, { type: 'error', message: '同步任務正在執行中' })
      sseSend(res, { type: 'done', success: false })
      res.end()
      return true
    }

    const controller = new AbortController()
    const { signal } = controller
    sseHeaders(res)
    runningTasks.set('sync', controller)

    req.on('close', () => {
      if (!signal.aborted)
        controller.abort()
      runningTasks.delete('sync')
    })

    try {
      const { pullPrefs } = await getAbAsync()
      sseSend(res, { type: 'log', message: '從 iCloud 拉取偏好設定…' })
      const result = await pullPrefs({
        force: req._body?.force,
        sync99Local: req._body?.sync99Local,
        dryRun: req._body?.dryRun,
      })
      if (!res.writableEnded) {
        for (const f of result.dry ?? [])
          sseSend(res, { type: 'log', message: `[DRY-RUN] 將拉取：${f}` })
        for (const f of result.pulled ?? [])
          sseSend(res, { type: 'log', message: `✓ 拉取：${f}` })
        for (const f of result.skipped ?? [])
          sseSend(res, { type: 'log', message: `— 跳過：${f}` })
        sseSend(res, { type: 'done', success: true, result })
      }
    }
    catch (e) {
      if (!res.writableEnded) {
        sseSend(res, { type: 'error', message: e.message })
        sseSend(res, { type: 'done', success: false })
      }
    }
    finally {
      runningTasks.delete('sync')
      if (!res.writableEnded)
        res.end()
    }
    return true
  }

  return false
}
