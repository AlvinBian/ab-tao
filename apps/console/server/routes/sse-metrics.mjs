/**
 * GET /api/sse/metrics — 即時讀取 metrics.jsonl 並以 SSE 串流輸出
 * 首次連線送出既有全部行，之後每 2s 偵測新增行
 */

import fs from 'node:fs'
import path from 'node:path'
import { DOTFILES_BIN, sseHeaders, sseSend } from '../sse.mjs'

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

export async function sseMetricsRouter(req, res, url) {
  if (req.method !== 'GET' || url.pathname !== '/api/sse/metrics')
    return false

  const P = await getP()
  const metricsPath = P.metrics

  sseHeaders(res)

  // 送出既有所有行
  let lastSize = 0
  if (fs.existsSync(metricsPath)) {
    const content = fs.readFileSync(metricsPath, 'utf8')
    lastSize = Buffer.byteLength(content, 'utf8')
    const lines = content.split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        sseSend(res, { type: 'metric', data: parsed })
      }
      catch {
        sseSend(res, { type: 'metric', raw: line })
      }
    }
  }

  sseSend(res, { type: 'ready', message: '既有資料載入完畢，開始監聽新增行' })

  // 每 2s 偵測新增行（lastSize 追蹤）
  const intervalId = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(intervalId)
      return
    }
    if (!fs.existsSync(metricsPath))
      return
    const stat = fs.statSync(metricsPath)
    const currentSize = stat.size
    if (currentSize <= lastSize)
      return

    const fd = fs.openSync(metricsPath, 'r')
    const newByteCount = currentSize - lastSize
    const buf = Buffer.alloc(newByteCount)
    fs.readSync(fd, buf, 0, newByteCount, lastSize)
    fs.closeSync(fd)
    lastSize = currentSize

    const newContent = buf.toString('utf8')
    const lines = newContent.split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        sseSend(res, { type: 'metric', data: parsed })
      }
      catch {
        sseSend(res, { type: 'metric', raw: line })
      }
    }
  }, 2000)

  req.on('close', () => {
    clearInterval(intervalId)
  })

  return true
}
