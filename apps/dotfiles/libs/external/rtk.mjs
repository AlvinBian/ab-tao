/**
 * RTK（Rust Token Killer）安裝檢驗與狀態查詢
 *
 * 來源：https://github.com/rtk-ai/rtk
 * 安裝：brew install rtk  或  curl -fsSL https://rtk.sh | bash
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HOME } from "../core/paths.mjs";

const RTK_BIN = "rtk";
const RTK_HOOK_SCRIPT = path.join(HOME, ".claude", "hooks", "rtk-rewrite.sh");
const SETTINGS_PATH = path.join(HOME, ".claude", "settings.json");

/**
 * 檢查 rtk 是否已安裝
 * @returns {boolean}
 */
export function isRtkInstalled() {
	const result = spawnSync("which", [RTK_BIN], { stdio: "ignore" });
	return result.status === 0;
}

/**
 * 取得 rtk 版本號
 * @returns {string|null}
 */
export function getRtkVersion() {
	if (!isRtkInstalled()) return null;
	try {
		const output = execFileSync(RTK_BIN, ["--version"], {
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
 * 使用 Homebrew 安裝 RTK，不可用時 fallback curl
 * @returns {boolean}
 */
export function installRtk() {
	const brewAvailable =
		spawnSync("which", ["brew"], { stdio: "ignore" }).status === 0;
	if (brewAvailable) {
		const result = spawnSync("brew", ["install", "rtk"], {
			stdio: "inherit",
			shell: false,
			timeout: 120000,
		});
		if (result.status === 0) return true;
	}
	// fallback: curl 安裝
	const curlResult = spawnSync(
		"bash",
		[
			"-c",
			'export PATH="$HOME/.local/bin:$PATH" && curl -fsSL https://rtk.sh | bash',
		],
		{ stdio: "inherit", shell: false, timeout: 120000 },
	);
	return curlResult.status === 0;
}

/**
 * 執行 rtk init -g 完成全局 hook 配置
 * @returns {boolean}
 */
export function initRtk() {
	if (!isRtkInstalled()) return false;
	const result = spawnSync(RTK_BIN, ["init", "-g", "--auto-patch"], {
		stdio: "inherit",
		shell: false,
		timeout: 120000,
	});
	return result.status === 0;
}

/**
 * 檢查 rtk 是否已安裝，未安裝則自動安裝
 * @returns {{ installed: boolean, alreadyInstalled: boolean }}
 */
export function checkAndInstallRtk() {
	if (isRtkInstalled()) {
		return { installed: true, alreadyInstalled: true };
	}
	const success = installRtk();
	return { installed: success, alreadyInstalled: false };
}

/**
 * 檢查 rtk-rewrite.sh hook 是否已部署到 ~/.claude/hooks/
 * @returns {boolean}
 */
export function isRtkHookDeployed() {
	return fs.existsSync(RTK_HOOK_SCRIPT);
}

/**
 * 檢查 ~/.claude/settings.json 的 PreToolUse 是否已包含 rtk hook
 * @returns {boolean}
 */
export function isRtkHookConfigured() {
	try {
		const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
		const settings = JSON.parse(raw);
		const preToolUse = settings?.hooks?.PreToolUse ?? [];
		return preToolUse.some((entry) =>
			(entry?.hooks ?? []).some(
				(h) => typeof h.command === "string" && h.command.includes("rtk"),
			),
		);
	} catch {
		return false;
	}
}

/**
 * 取得 RTK 完整狀態
 * @returns {{ installed: boolean, version: string|null, hookDeployed: boolean, hookConfigured: boolean }}
 */
export function getRtkStatus() {
	const installed = isRtkInstalled();
	return {
		installed,
		version: installed ? getRtkVersion() : null,
		hookDeployed: isRtkHookDeployed(),
		hookConfigured: isRtkHookConfigured(),
	};
}
