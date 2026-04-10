/**
 * CCometixLine 安裝檢驗與自動安裝
 *
 * 來源：https://github.com/Haleclipse/CCometixLine
 * 套件：@cometix/ccline
 */

import { spawnSync } from "node:child_process";

const CCLINE_PACKAGE = "@cometix/ccline";
const CCLINE_BIN = "ccline";

/**
 * 檢查 ccline 是否已安裝
 * @returns {boolean}
 */
export function isCclineInstalled() {
	const result = spawnSync("which", [CCLINE_BIN], { stdio: "ignore" });
	return result.status === 0;
}

/**
 * 使用 pnpm 全局安裝 @cometix/ccline
 * @returns {boolean} 安裝是否成功
 */
export function installCcline() {
	const result = spawnSync("pnpm", ["add", "--global", CCLINE_PACKAGE], {
		stdio: "inherit",
		shell: false,
	});
	return result.status === 0;
}

/**
 * 檢查 ccline 是否已安裝，未安裝則自動安裝
 *
 * @returns {{ installed: boolean, alreadyInstalled: boolean }}
 *   installed        — ccline 現在是否可用
 *   alreadyInstalled — 原本就已安裝（無需重新安裝）
 */
export function checkAndInstallCcline() {
	if (isCclineInstalled()) {
		return { installed: true, alreadyInstalled: true };
	}
	const success = installCcline();
	return { installed: success, alreadyInstalled: false };
}
