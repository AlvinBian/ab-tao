/**
 * zoxide（智能 cd — 記住常用目錄，命令 `z xxx`）安裝檢驗與狀態查詢
 *
 * 來源：https://github.com/ajeetdsouza/zoxide
 * 安裝：brew install zoxide  或  官方 webinstall script（fallback）
 *
 * 設計對齊 libs/external/rtk.mjs：自包含偵測 + 安裝；差異在於 zoxide 的
 * shell 初始化（`eval "$(zoxide init zsh)"` + `alias cd='z'`）由 ZSH 模組
 * zsh/modules/60-tools.zsh 負責，而非 ~/.claude/ hook，故本模組的「配置檢查」
 * 對象為已部署的 ~/.zshrc.d/conf 內 tools 模組是否含 zoxide init。
 */

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { HOME } from '../core/paths.mjs'

const ZOXIDE_BIN = 'zoxide'
const ZSH_CONF_DIR = path.join(HOME, '.zshrc.d', 'conf')

/**
 * 檢查 zoxide 是否已安裝
 * @returns {boolean}
 */
export function isZoxideInstalled() {
  const result = spawnSync('which', [ZOXIDE_BIN], { stdio: 'ignore' })
  return result.status === 0
}

/**
 * 取得 zoxide 版本號
 * @returns {string|null} 例如 "0.9.9"，未安裝或解析失敗回 null
 */
export function getZoxideVersion() {
  if (!isZoxideInstalled())
    return null
  try {
    const output = execFileSync(ZOXIDE_BIN, ['--version'], {
      stdio: 'pipe',
      encoding: 'utf8',
    })
    const match = output.match(/[\d.]+/)
    return match ? match[0] : null
  }
  catch {
    return null
  }
}

/**
 * 使用 Homebrew 安裝 zoxide，brew 不可用時 fallback 官方 webinstall script
 *
 * ⚠️ fallback URL 為 zoxide 官方安裝腳本，若官方變更路徑需同步更新；
 *    主路徑（brew）為預設，fallback 僅在無 brew 環境觸發。
 * @returns {boolean} 安裝成功回 true
 */
export function installZoxide() {
  const brewAvailable
    = spawnSync('which', ['brew'], { stdio: 'ignore' }).status === 0
  if (brewAvailable) {
    const result = spawnSync('brew', ['install', ZOXIDE_BIN], {
      stdio: 'inherit',
      shell: false,
      timeout: 120000,
    })
    if (result.status === 0)
      return true
  }
  // fallback: 官方 webinstall（無 brew 環境）
  const curlResult = spawnSync(
    'bash',
    [
      '-c',
      'export PATH="$HOME/.local/bin:$PATH" && curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh',
    ],
    { stdio: 'inherit', shell: false, timeout: 120000 },
  )
  return curlResult.status === 0
}

/**
 * 檢查 zoxide 是否已安裝，未安裝則自動安裝
 * @returns {{ installed: boolean, alreadyInstalled: boolean }}
 */
export function checkAndInstallZoxide() {
  if (isZoxideInstalled()) {
    return { installed: true, alreadyInstalled: true }
  }
  const success = installZoxide()
  return { installed: success, alreadyInstalled: false }
}

/**
 * 檢查已部署的 ZSH tools 模組是否含 zoxide init 配置
 *
 * 對應 ~/.zshrc.d/conf 內 60-tools.zsh（symlink，readFileSync 會跟隨）是否
 * 包含 `zoxide init`；用於 status / doctor 區分「已裝但未配置」狀態。
 * @returns {boolean}
 */
export function isZoxideConfigured() {
  try {
    if (!fs.existsSync(ZSH_CONF_DIR))
      return false
    const toolsFile = fs
      .readdirSync(ZSH_CONF_DIR)
      .find(f => f.endsWith('-tools.zsh') || f === 'tools.zsh')
    if (!toolsFile)
      return false
    const content = fs.readFileSync(path.join(ZSH_CONF_DIR, toolsFile), 'utf8')
    return content.includes('zoxide init')
  }
  catch {
    return false
  }
}

/**
 * 取得 zoxide 完整狀態
 * @returns {{ installed: boolean, version: string|null, configured: boolean }}
 */
export function getZoxideStatus() {
  const installed = isZoxideInstalled()
  return {
    installed,
    version: installed ? getZoxideVersion() : null,
    configured: isZoxideConfigured(),
  }
}
