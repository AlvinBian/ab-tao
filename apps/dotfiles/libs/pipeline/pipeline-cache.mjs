/**
 * 統一快取層（content-addressed）
 *
 * 所有快取都基於內容 hash，輸入不變 → 快取命中。
 * 支援 per-repo AI 分類、整合結果、AI 資源推薦。
 *
 * 快取目錄結構：
 *   .cache/
 *     {type}/         （如 repo-ai / aiRes-ai / merge）
 *       {key}.json
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_BASE = ".cache";

/**
 * 計算字串的 MD5 hash（取前 12 字元作為快取鍵）
 *
 * @param {string} content - 要 hash 的字串內容
 * @returns {string} 12 字元的 hex hash
 */
export function hashKey(content) {
	return createHash("md5").update(content).digest("hex").slice(0, 12);
}

// AI 分類快取 TTL：48 小時（毫秒）
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * 讀取快取資料（含 TTL 檢查，超過 48 小時視為過期）
 *
 * @param {string} baseDir - 專案根目錄
 * @param {string} type - 快取類型（如 'repo-ai'）
 * @param {string} key - 快取鍵（通常由 hashKey 產生）
 * @returns {Object|null} 快取資料，不存在、過期或解析失敗返回 null
 */
export function readCache(baseDir, type, key) {
	const filePath = path.join(baseDir, CACHE_BASE, type, `${key}.json`);
	if (!fs.existsSync(filePath)) return null;
	try {
		const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
		// TTL 檢查：cachedAt 存在且未過期才返回
		if (data?._cachedAt && Date.now() - data._cachedAt > CACHE_TTL_MS) {
			fs.rmSync(filePath, { force: true });
			return null;
		}
		return data;
	} catch {
		return null;
	}
}

/**
 * 寫入快取資料
 *
 * @param {string} baseDir - 專案根目錄
 * @param {string} type - 快取類型（如 'repo-ai'）
 * @param {string} key - 快取鍵
 * @param {Object} data - 要快取的資料（會序列化為 JSON）
 * @returns {void}
 */
export function writeCache(baseDir, type, key, data) {
	const dir = path.join(baseDir, CACHE_BASE, type);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, `${key}.json`),
		JSON.stringify({ ...data, _cachedAt: Date.now() }),
		"utf8",
	);
}

/**
 * 清除指定類型的所有快取
 *
 * @param {string} baseDir - 專案根目錄
 * @param {string} type - 要清除的快取類型
 * @returns {void}
 */
export function clearCacheType(baseDir, type) {
	const dir = path.join(baseDir, CACHE_BASE, type);
	if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
}
