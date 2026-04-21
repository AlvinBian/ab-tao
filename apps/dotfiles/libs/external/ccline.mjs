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
 *
 * 使用三層偵測策略，避免 Node.js 進程 PATH 不含 pnpm global bin 造成誤判：
 * 1. 權威查詢：pnpm 全域套件清單（不靠 PATH）
 * 2. fallback：解析 pnpm global bin 路徑，直接 stat 檢查 binary 存在且可執行
 * 3. 最後 fallback：原 which（保留向後兼容）
 *
 * @returns {boolean}
 */
export function isCclineInstalled() {
	// 1. 權威查詢：pnpm 全域套件清單（不靠 PATH）
	const list = spawnSync("pnpm", ["list", "-g", CCLINE_PACKAGE, "--json"], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (list.status === 0) {
		try {
			const arr = JSON.parse(list.stdout);
			if (
				Array.isArray(arr) &&
				arr.some((r) => r.dependencies?.[CCLINE_PACKAGE])
			) {
				return true;
			}
		} catch {
			/* fallthrough */
		}
	}

	// 2. fallback：resolved bin path 檢查（size>0 + executable）
	const pnpmBin = spawnSync("pnpm", ["bin", "-g"], {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	if (pnpmBin.status === 0) {
		const resolvedBin = path.join(pnpmBin.stdout.trim(), CCLINE_BIN);
		const st = fs.statSync(resolvedBin, { throwIfNoEntry: false });
		if (st && st.size > 0) {
			try {
				fs.accessSync(resolvedBin, fs.constants.X_OK);
				return true;
			} catch {
				/* 不可執行，視為未安裝 */
			}
		}
	}

	// 3. 最後 fallback：原 which（保留向後兼容）
	const which = spawnSync("which", [CCLINE_BIN], { stdio: "ignore" });
	return which.status === 0;
}

/**
 * 使用 pnpm 全局安裝 @cometix/ccline
 *
 * 先 remove 再 add，強制 pnpm 重建所有 symlink。
 * 覆蓋安裝（Already up to date）會跳過 symlink 重建，
 * 導致 optional dependency（ccline-darwin-arm64）連結斷裂。
 *
 * @returns {boolean} 安裝是否成功
 */
export function installCcline() {
	// 先移除舊安裝，捕獲 stderr 以識別真實錯誤（與「未安裝」區分）
	if (isCclineInstalled()) {
		const removeResult = spawnSync(
			"pnpm",
			["remove", "--global", CCLINE_PACKAGE],
			{
				stdio: "pipe",
				shell: false,
			},
		);
		if (removeResult.status !== 0) {
			const stderr = removeResult.stderr?.toString() ?? "";
			const isNotInstalled = /not found|not installed|does not exist/i.test(
				stderr,
			);
			if (!isNotInstalled) {
				process.stderr.write(`[ccline] remove 失敗：${stderr.trim()}\n`);
			}
		}
	}
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

	// idempotency：比對 size + content，相同則跳過複製
	let shouldWrite = true;
	if (fs.existsSync(dest)) {
		const srcSt = fs.statSync(src);
		const destSt = fs.statSync(dest);
		if (srcSt.size === destSt.size) {
			const srcBuf = fs.readFileSync(src);
			const destBuf = fs.readFileSync(dest);
			if (srcBuf.equals(destBuf)) shouldWrite = false;
		}
	}

	if (shouldWrite) fs.copyFileSync(src, dest);

	// chmod 永遠執行（冪等，修復 umask 或使用者改權限的 drift）
	fs.chmodSync(dest, 0o755);

	return { deployed: true, scriptPath: dest, skipped: !shouldWrite };
}
