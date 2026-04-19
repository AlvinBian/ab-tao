/**
 * status.mjs — /api/status/* 路由
 *
 * 直接 import apps/dotfiles/libs 模組，不走 child process。
 * collectExtendedData 是同步函式；sessions 內的 Map 序列化為 plain object。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

let _collectFn = null;
let _usageFn = null;

async function getCollectFn() {
	if (!_collectFn) {
		const m = await import(path.join(DOTFILES_LIB, "core/usage-scanner.mjs"));
		_collectFn = m.collectUnifiedReportData;
	}
	return _collectFn;
}

async function getUsageFn() {
	if (!_usageFn) {
		const m = await import(path.join(DOTFILES_LIB, "core/usage-scanner.mjs"));
		_usageFn = m.scanUsageStats;
	}
	return _usageFn;
}

/** Map / Set → plain object（JSON.stringify 無法序列化 Map） */
function serializeData(data) {
	if (data === null || data === undefined) return data;
	if (data instanceof Map) return Object.fromEntries(data);
	if (data instanceof Set) return [...data];
	if (Array.isArray(data)) return data.map(serializeData);
	if (typeof data === "object") {
		return Object.fromEntries(
			Object.entries(data).map(([k, v]) => [k, serializeData(v)]),
		);
	}
	return data;
}

export async function statusRouter(req, res, url, json) {
	// GET /api/status/overview — 含 extended 資料
	if (req.method === "GET" && url.pathname === "/api/status/overview") {
		const collect = await getCollectFn();
		const raw = await collect();
		json(res, 0, "ok", serializeData(raw));
		return true;
	}

	// GET /api/status/usage — scanUsageStats（Map → plain object）
	if (req.method === "GET" && url.pathname === "/api/status/usage") {
		try {
			const scanUsage = await getUsageFn();
			const raw = scanUsage ? await scanUsage() : new Map();
			json(res, 0, "ok", serializeData(raw));
		} catch {
			json(res, 0, "ok", {});
		}
		return true;
	}

	return false;
}
