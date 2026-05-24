/**
 * GET /api/sse/install-progress — d:setup 串流進度的預留端點
 * 目前以心跳模式運作：每 5 秒送出 { type: "heartbeat", timestamp }
 */

import { sseHeaders, sseSend } from '../sse.mjs'

export async function sseInstallProgressRouter(req, res, url) {
  if (req.method !== 'GET' || url.pathname !== '/api/sse/install-progress')
    return false

  sseHeaders(res)

  sseSend(res, {
    type: 'heartbeat',
    timestamp: new Date().toISOString(),
    message: 'd:setup 串流進度端點就緒，等待任務啟動',
  })

  const intervalId = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(intervalId)
      return
    }
    sseSend(res, { type: 'heartbeat', timestamp: new Date().toISOString() })
  }, 5000)

  req.on('close', () => {
    clearInterval(intervalId)
  })

  return true
}
