/**
 * Graphite gt 安裝檢驗與狀態查詢
 *
 * 來源：https://graphite.dev
 * 安裝：brew install withgraphite/tap/graphite
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HOME } from "../core/paths.mjs";

const GT_BIN = "gt";

/**
 * 檢查 gt（Graphite CLI）是否已安裝
 * @returns {boolean}
 */
export function isGtInstalled() {
	const result = spawnSync("which", [GT_BIN], { stdio: "ignore" });
	return result.status === 0;
}

/**
 * 取得 gt 版本號
 * @returns {string|null} 版本字串，或 null 表示未安裝
 */
export function getGtVersion() {
	if (!isGtInstalled()) return null;
	try {
		const output = execFileSync(GT_BIN, ["--version"], {
			stdio: "pipe",
			encoding: "utf8",
		});
		const match = output.match(/[\d.]+/);
		return match ? match[0] : null;
	} catch {
		return null;
	}
}

/**
 * 檢查 gt 是否已完成 GitHub 授權
 * 透過 ~/.graphite_credentials 存在或 gt auth status 指令判斷
 * @returns {boolean}
 */
export function isGtAuthed() {
	const credPath = path.join(HOME, ".graphite_credentials");
	if (fs.existsSync(credPath)) return true;
	if (!isGtInstalled()) return false;
	try {
		execFileSync(GT_BIN, ["auth", "status"], { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/**
 * 使用 Homebrew 安裝 Graphite CLI
 * @returns {boolean} 安裝是否成功
 */
export function installGt() {
	const result = spawnSync("brew", ["install", "withgraphite/tap/graphite"], {
		stdio: "inherit",
		shell: false,
	});
	return result.status === 0;
}

/**
 * 檢查 gt 是否已安裝，未安裝則自動安裝
 * @returns {{ installed: boolean, alreadyInstalled: boolean }}
 */
export function checkAndInstallGt() {
	if (isGtInstalled()) {
		return { installed: true, alreadyInstalled: true };
	}
	const success = installGt();
	return { installed: success, alreadyInstalled: false };
}

/**
 * 取得 Graphite 完整狀態
 * @returns {{ installed: boolean, version: string|null, authed: boolean }}
 */
export function getGtStatus() {
	const installed = isGtInstalled();
	if (!installed) {
		return { installed: false, version: null, authed: false };
	}
	return {
		installed: true,
		version: getGtVersion(),
		authed: isGtAuthed(),
	};
}
