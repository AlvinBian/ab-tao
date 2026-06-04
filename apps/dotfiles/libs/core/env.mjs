/**
 * .env 載入（不依賴 dotenv）
 *
 * 職責：
 *   讀取專案根目錄的 .env 檔案，注入到 process.env。
 *   已存在的環境變數不會被覆蓋。
 *   只載入一次（idempotent）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { getDirname } from './paths.mjs'

const __dirname = getDirname(import.meta)
const ENV_LOCAL_PATH = path.resolve(__dirname, '../..', '.env.local')
const ENV_PATH = path.resolve(__dirname, '../..', '.env')

const TEMPLATE_PATH = path.resolve(__dirname, '../..', '.env.template')

let _loaded = false

/**
 * 載入 .env 檔案到 process.env（只執行一次）
 *
 * 解析規則：
 * - 跳過空行與 # 開頭的註解行
 * - 等號左側為 key，右側為 value（去除前後引號）
 * - 已存在於 process.env 的 key 不覆蓋
 * - .env 不存在但 .env.template 存在時自動複製 template
 *
 * @returns {void}
 */
function parseEnvFile(filePath) {
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    const key = trimmed.slice(0, eq).trim()
    // 去除 value 前後相符的成對引號（單引號或雙引號）
    const raw = trimmed.slice(eq + 1).trim()
    const val
      = (raw.startsWith('"') && raw.endsWith('"'))
        || (raw.startsWith('\'') && raw.endsWith('\''))
        ? raw.slice(1, -1)
        : raw
    if (!process.env[key])
      process.env[key] = val
  }
}

export function loadEnv() {
  if (_loaded)
    return
  // .env.local 優先（不 commit，機器獨立覆蓋；符合 Next.js / Vite 慣例）
  if (fs.existsSync(ENV_LOCAL_PATH))
    parseEnvFile(ENV_LOCAL_PATH)
  // .env 不存在但 template 存在時，自動從 template 建立
  if (!fs.existsSync(ENV_PATH) && fs.existsSync(TEMPLATE_PATH)) {
    fs.copyFileSync(TEMPLATE_PATH, ENV_PATH)
  }
  if (fs.existsSync(ENV_PATH))
    parseEnvFile(ENV_PATH)
  _loaded = true
}

/**
 * 寫入 / 更新 .env.local 的單一 key（upsert），並同步至 process.env。
 *
 * 因 loadEnv 的 _loaded flag 使其只讀一次，寫檔後必須手動同步 process.env，
 * 否則當前 process 讀不到新值。
 *
 * @param {string} key - 環境變數名
 * @param {string} value - 值（原樣寫入，不加引號）
 * @returns {void}
 */
export function setEnvLocal(key, value) {
  const content = fs.existsSync(ENV_LOCAL_PATH)
    ? fs.readFileSync(ENV_LOCAL_PATH, 'utf8')
    : ''
  const lines = content.split('\n')
  const idx = lines.findIndex((l) => {
    const t = l.trim()
    if (!t || t.startsWith('#'))
      return false
    const eq = t.indexOf('=')
    return eq !== -1 && t.slice(0, eq).trim() === key
  })
  if (idx !== -1) {
    lines[idx] = `${key}=${value}`
    fs.writeFileSync(ENV_LOCAL_PATH, `${lines.join('\n').trimEnd()}\n`)
  }
  else {
    const trimmed = content.trimEnd()
    fs.writeFileSync(ENV_LOCAL_PATH, trimmed ? `${trimmed}\n${key}=${value}\n` : `${key}=${value}\n`)
  }
  process.env[key] = value
}

/**
 * 讀取環境變數，帶型別轉換
 * @param {string} key
 * @param {*} fallback - 預設值（也決定型別轉換：number → parseInt, boolean → 'true'）
 * @returns {*}
 */
export function env(key, fallback) {
  loadEnv()
  const val = process.env[key]
  if (val === undefined || val === '')
    return fallback
  if (typeof fallback === 'number') {
    const n = Number.parseInt(val, 10)
    if (Number.isNaN(n) || n < 0)
      return fallback
    return n
  }
  if (typeof fallback === 'boolean')
    return val === 'true' || val === '1'
  return val
}
