/**
 * @ab-tao/root/shell — Shell 執行工具
 */

import { execSync } from 'node:child_process';

/** 執行指令，回傳 stdout（失敗回傳 null） */
export function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...options }).trim();
  } catch {
    return null;
  }
}

/** 執行指令，繼承 stdio（互動式） */
export function execInteractive(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

/** 檢查指令是否存在 */
export function commandExists(cmd) {
  return exec(`command -v ${cmd}`) !== null;
}
