/**
 * status.mjs — /api/status/* 路由
 *
 * 直接 import apps/dotfiles/libs 模組，不走 child process。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

// 取得 dotfiles 根目錄（相對路徑：../../apps/dotfiles）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

/**
 * lazy import helpers（dotfiles 模組在 first request 時載入，
 * 避免 server 啟動時因路徑問題崩潰）
 */
let _collectFn = null;
let _extendedFn = null;
let _usageFn = null;

async function getCollectFn() {
	if (!_collectFn) {
		const m = await import(path.join(DOTFILES_LIB, "core/usage-scanner.mjs"));
		_collectFn = m.collectUnifiedReportData;
	}
	return _collectFn;
}

async function getExtendedFn() {
	if (!_extendedFn) {
		const m = await import(
			path.join(DOTFILES_LIB, "report/collect-unified.mjs")
		);
		_extendedFn = m.collectExtendedData;
	}
	return _extendedFn;
}

async function getUsageFn() {
	if (!_usageFn) {
		const m = await import(path.join(DOTFILES_LIB, "core/usage-scanner.mjs"));
		_usageFn = m.scanUsageStats;
	}
	return _usageFn;
}

/**
 * statusRouter — 處理 /api/status/* 請求
 * @returns {boolean} 是否已處理
 */
export async function statusRouter(req, res, url, json) {
	// GET /api/status/overview
	if (req.method === "GET" && url.pathname === "/api/status/overview") {
		const collect = await getCollectFn();
		const data = await collect();
		json(res, 0, "ok", data);
		return true;
	}

	// GET /api/status/extended
	if (req.method === "GET" && url.pathname === "/api/status/extended") {
		const extended = await getExtendedFn();
		const data = extended();
		json(res, 0, "ok", data);
		return true;
	}

	// GET /api/status/usage
	if (req.method === "GET" && url.pathname === "/api/status/usage") {
		try {
			const scanUsage = await getUsageFn();
			const data = scanUsage ? await scanUsage() : [];
			json(res, 0, "ok", data);
		} catch {
			// scanUsageStats 可能需要 JSONL 存在，失敗時回空
			json(res, 0, "ok", []);
		}
		return true;
	}

	return false;
}
