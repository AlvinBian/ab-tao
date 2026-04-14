/**
 * CCometixLine 安裝檢驗與自動安裝
 *
 * 來源：https://github.com/Haleclipse/CCometixLine
 * 套件：@cometix/ccline
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HOME } from "../core/paths.mjs";

const CCLINE_PACKAGE = "@cometix/ccline";
const CCLINE_BIN = "ccline";
const CCLINE_SCRIPT_NAME = "my-ccline.sh";
const CCLINE_DEST_DIR = path.join(HOME, ".claude", "ccline");

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

/**
 * 部署 my-ccline.sh 到 ~/.claude/ccline/
 *
 * 從 repoDir/claude/ccline/my-ccline.sh 複製到 ~/.claude/ccline/my-ccline.sh，
 * 並設定可執行權限。
 *
 * @param {string} repoDir - @ab-tao/dotfiles 根目錄
 * @returns {{ deployed: boolean, scriptPath: string }}
 */
export function deployCclineScript(repoDir) {
	const src = path.join(repoDir, "claude", "ccline", CCLINE_SCRIPT_NAME);
	const dest = path.join(CCLINE_DEST_DIR, CCLINE_SCRIPT_NAME);

	if (!fs.existsSync(src)) {
		return { deployed: false, scriptPath: dest };
	}

	fs.mkdirSync(CCLINE_DEST_DIR, { recursive: true });
	fs.copyFileSync(src, dest);
	fs.chmodSync(dest, 0o755);

	return { deployed: true, scriptPath: dest };
}
