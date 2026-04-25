/**
 * claude-hud 部署工具
 *
 * 來源：https://github.com/jarrodwatts/claude-hud
 * 安裝方式：Claude Code plugin（透過 extraKnownMarketplaces + enabledPlugins 注入）
 * ab-tao 職責：部署 wrapper script 與預設 plugin config，不執行任何套件安裝。
 */

import fs from "node:fs";
import path from "node:path";
import { HOME } from "../core/paths.mjs";

const CLAUDE_DIR = path.join(HOME, ".claude");
const PLUGIN_DIR = path.join(CLAUDE_DIR, "plugins", "claude-hud");
const WRAPPER_DEST = path.join(PLUGIN_DIR, "hud-wrapper.sh");
const CONFIG_DEST = path.join(PLUGIN_DIR, "config.json");
const PLUGIN_CACHE_GLOB = path.join(CLAUDE_DIR, "plugins", "cache");

const WRAPPER_SRC_NAME = "hud-wrapper.sh";
const CONFIG_SRC_NAME = "config.json";

/**
 * 偵測 claude-hud plugin 是否已由 Claude Code 安裝
 * 透過 plugins/cache/<marketplace>/claude-hud/<version>/ 目錄存在性判斷
 *
 * @returns {boolean}
 */
export function isClaudeHudPluginInstalled() {
	if (!fs.existsSync(PLUGIN_CACHE_GLOB)) return false;
	const entries = fs.readdirSync(PLUGIN_CACHE_GLOB);
	for (const marketplace of entries) {
		const hudPath = path.join(PLUGIN_CACHE_GLOB, marketplace, "claude-hud");
		if (!fs.existsSync(hudPath)) continue;
		const versions = fs.readdirSync(hudPath);
		if (versions.some((v) => /^\d+\.\d+\.\d+$/.test(v))) return true;
	}
	return false;
}

/**
 * 取得已安裝的 claude-hud plugin 版本號（最新版）
 *
 * @returns {string | null}
 */
export function getClaudeHudPluginVersion() {
	if (!fs.existsSync(PLUGIN_CACHE_GLOB)) return null;
	const entries = fs.readdirSync(PLUGIN_CACHE_GLOB);
	const versions = [];
	for (const marketplace of entries) {
		const hudPath = path.join(PLUGIN_CACHE_GLOB, marketplace, "claude-hud");
		if (!fs.existsSync(hudPath)) continue;
		for (const v of fs.readdirSync(hudPath)) {
			if (/^\d+\.\d+\.\d+$/.test(v)) versions.push(v);
		}
	}
	if (!versions.length) return null;
	return versions.sort((a, b) => {
		const [ma, mi, pa] = a.split(".").map(Number);
		const [mb, mi2, pb] = b.split(".").map(Number);
		return mb - ma || mi2 - mi || pb - pa;
	})[0];
}

/**
 * 部署 hud-wrapper.sh 到 ~/.claude/plugins/claude-hud/hud-wrapper.sh
 *
 * Idempotent：比對 size + content，相同則跳過複製；chmod 永遠執行。
 *
 * @param {string} repoDir - @ab-tao/dotfiles 根目錄
 * @returns {{ deployed: boolean, skipped: boolean, wrapperPath: string }}
 */
export function deployClaudeHudWrapper(repoDir) {
	const src = path.join(repoDir, "claude", "claude-hud", WRAPPER_SRC_NAME);
	if (!fs.existsSync(src)) {
		return { deployed: false, skipped: false, wrapperPath: WRAPPER_DEST };
	}

	fs.mkdirSync(PLUGIN_DIR, { recursive: true });

	let shouldWrite = true;
	if (fs.existsSync(WRAPPER_DEST)) {
		const srcSt = fs.statSync(src);
		const destSt = fs.statSync(WRAPPER_DEST);
		if (srcSt.size === destSt.size) {
			const srcBuf = fs.readFileSync(src);
			const destBuf = fs.readFileSync(WRAPPER_DEST);
			if (srcBuf.equals(destBuf)) shouldWrite = false;
		}
	}

	if (shouldWrite) fs.copyFileSync(src, WRAPPER_DEST);

	// chmod 永遠執行（冪等，修復 umask 或使用者改權限的 drift）
	fs.chmodSync(WRAPPER_DEST, 0o755);

	return { deployed: true, skipped: !shouldWrite, wrapperPath: WRAPPER_DEST };
}

/**
 * 部署 config.json 到 ~/.claude/plugins/claude-hud/config.json
 *
 * 策略：目標不存在才寫入（避免覆蓋使用者已調整的 plugin 設定）。
 *
 * @param {string} repoDir - @ab-tao/dotfiles 根目錄
 * @returns {{ deployed: boolean, skipped: boolean, configPath: string }}
 */
export function deployClaudeHudConfig(repoDir) {
	const src = path.join(repoDir, "claude", "claude-hud", CONFIG_SRC_NAME);
	if (!fs.existsSync(src)) {
		return { deployed: false, skipped: false, configPath: CONFIG_DEST };
	}

	fs.mkdirSync(PLUGIN_DIR, { recursive: true });

	if (fs.existsSync(CONFIG_DEST)) {
		return { deployed: false, skipped: true, configPath: CONFIG_DEST };
	}

	fs.copyFileSync(src, CONFIG_DEST);
	return { deployed: true, skipped: false, configPath: CONFIG_DEST };
}
