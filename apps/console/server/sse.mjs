/**
 * 共用 SSE helper：設定 headers、發送事件、管理子進程生命週期。
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DOTFILES_BIN = path.resolve(__dirname, '../../dotfiles/bin')

/** @type {Map<string, import('node:child_process').ChildProcess | true>} */
export const runningTasks = new Map()

export function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
}

export function sseSend(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/**
 * spawn 子進程，把 stdout/stderr 轉成 SSE log 事件。
 * 結束時送 { type: 'done', code } 或 { type: 'error', message }。
 * @param {import('node:http').ServerResponse} res
 * @param {import('node:http').IncomingMessage} req
 */
export function spawnSse(res, req, taskType, cmd, args, opts = {}) {
  if (runningTasks.has(taskType)) {
    sseHeaders(res)
    sseSend(res, {
      type: 'error',
      message: `${taskType} 任務正在執行中，請稍後再試`,
    })
    sseSend(res, { type: 'done', success: false })
    res.end()
    return null
  }

  sseHeaders(res)

  let child
  try {
    child = spawn(cmd, args, {
      ...opts,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    })
  }
  catch (err) {
    sseSend(res, { type: 'error', message: err.message })
    sseSend(res, { type: 'done', success: false })
    res.end()
    return null
  }

  runningTasks.set(taskType, child)

  // 客戶端斷線時 kill 子進程並清除 task 記錄
  req.on('close', () => {
    if (!child.killed)
      child.kill('SIGTERM')
    runningTasks.delete(taskType)
  })

  const stdoutDecoder = new StringDecoder('utf8')
  const stderrDecoder = new StringDecoder('utf8')
  let stdoutBuffer = ''
  let stderrBuffer = ''

  child.stdout?.on('data', (chunk) => {
    stdoutBuffer += stdoutDecoder.write(chunk)
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed)
        continue
      // 嘗試解析 JSON 進度事件（子進程可用 console.log(JSON.stringify({type,…})) 輸出）
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.type) {
          sseSend(res, parsed)
          continue
        }
      }
      catch {
        // 非 JSON，當普通 log
      }
      sseSend(res, { type: 'log', message: trimmed })
    }
  })

  child.stderr?.on('data', (chunk) => {
    stderrBuffer += stderrDecoder.write(chunk)
    const lines = stderrBuffer.split('\n')
    stderrBuffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed)
        sseSend(res, { type: 'log', level: 'warn', message: trimmed })
    }
  })

  child.on('close', (code) => {
    if (res.writableEnded)
      return
    // flush 殘餘 buffer
    const remainOut = (stdoutBuffer + stdoutDecoder.end()).trim()
    if (remainOut)
      sseSend(res, { type: 'log', message: remainOut })
    const remainErr = (stderrBuffer + stderrDecoder.end()).trim()
    if (remainErr)
      sseSend(res, { type: 'log', level: 'warn', message: remainErr })
    runningTasks.delete(taskType)
    sseSend(res, { type: 'done', code: code ?? 0, success: (code ?? 0) === 0 })
    res.end()
  })

  child.on('error', (err) => {
    if (res.writableEnded)
      return
    runningTasks.delete(taskType)
    sseSend(res, { type: 'error', message: err.message })
    sseSend(res, { type: 'done', success: false })
    res.end()
  })

  return child
}
