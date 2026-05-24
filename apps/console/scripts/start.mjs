/**
 * start.mjs — 自動分配閒置端口（≥ 10000）啟動 API server + Vite
 *
 * Usage:
 *   node scripts/start.mjs          dev 模式（vite watch）
 *   node scripts/start.mjs --open   preview 模式（build 後預覽，開啟瀏覽器）
 */

import { spawn } from 'node:child_process'
import { createServer as createNetServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const isOpen = process.argv.includes('--open')

/** 找到 ≥ min 的第一個閒置 TCP 端口 */
function findFreePort(min = 10000) {
  return new Promise((resolve) => {
    let port = min
    const tryPort = () => {
      const srv = createNetServer()
      srv.once('error', () => {
        port++
        tryPort()
      })
      srv.listen(port, () => {
        srv.close(() => resolve(port))
      })
    }
    tryPort()
  })
}

const apiPort = await findFreePort(10000)
const vitePort = await findFreePort(apiPort + 1)

console.log(`→ API   http://localhost:${apiPort}`)
console.log(`→ Vite  http://localhost:${vitePort}`)

const env = {
  ...process.env,
  PORT: String(apiPort),
  VITE_API_PORT: String(apiPort),
}

const viteBin = path.join(ROOT, 'node_modules/.bin/vite')

// 啟動 API server
const api = spawn(process.execPath, [path.join(ROOT, 'server/index.mjs')], {
  env,
  stdio: ['ignore', 'inherit', 'inherit'],
  cwd: ROOT,
})

// 啟動 Vite（dev 或 preview）
const viteArgs = isOpen
  ? ['preview', '--port', String(vitePort), '--open']
  : ['--port', String(vitePort)]

const vite = spawn(viteBin, viteArgs, {
  env,
  stdio: ['ignore', 'inherit', 'inherit'],
  cwd: ROOT,
})

function cleanup() {
  api.kill('SIGTERM')
  vite.kill('SIGTERM')
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

api.on('exit', (code) => {
  if (code) {
    vite.kill('SIGTERM')
    process.exit(code)
  }
})

vite.on('exit', (code) => {
  api.kill('SIGTERM')
  if (code)
    process.exit(code)
})
