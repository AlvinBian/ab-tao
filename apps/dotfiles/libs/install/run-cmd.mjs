/**
 * run-cmd.mjs — dry-run 包裹器（lewislulu 模型）
 *
 * 所有 FS 寫入操作透過 runCmd() 執行。
 * --dry-run 模式下僅印出將執行操作，不實際寫檔。
 * 驗證：V21（fs_usage strace 零副作用）
 */

/** @type {boolean} 全域 dry-run 旗標 */
let _dryRun = false

/**
 * 設定 dry-run 模式（由 setup.mjs 解析 CLI 旗標後呼叫）
 * @param {boolean} value
 */
export function setDryRun(value) {
  _dryRun = Boolean(value)
}

/**
 * 取得目前 dry-run 狀態
 * @returns {boolean}
 */
export function isDryRun() {
  return _dryRun
}

/**
 * 在 dry-run 模式下僅印出操作描述，否則執行 fn()
 *
 * @param {string} description 操作描述（顯示於 dry-run 輸出）
 * @param {() => any} fn 實際要執行的函式
 * @returns {any} fn() 的回傳值（dry-run 時為 undefined）
 */
export function runCmd(description, fn) {
  if (_dryRun) {
    console.log(`[DRY-RUN] ${description}`)
    return undefined
  }
  return fn()
}

/**
 * 非同步版本
 *
 * @param {string} description
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
export async function runCmdAsync(description, fn) {
  if (_dryRun) {
    console.log(`[DRY-RUN] ${description}`)
    return undefined
  }
  return fn()
}
