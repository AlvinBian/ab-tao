/**
 * 檔案系統工具
 */

import fs from "node:fs";
import path from "node:path";

/** 確保目錄存在，不存在則遞迴建立 */
export function ensureDir(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true });
	return dirPath;
}

/** 安全讀取 JSON，失敗回傳 fallback */
export function readJson(filePath, fallback = null) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return fallback;
	}
}

/** 寫入 JSON（自動建目錄 + 加換行） */
export function writeJson(filePath, data) {
	ensureDir(path.dirname(filePath));
	fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

/** 遞迴列出目錄中所有符合條件的檔案 */
export function walkFiles(dir, filter = () => true) {
	const results = [];
	if (!fs.existsSync(dir)) return results;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
				results.push(...walkFiles(fullPath, filter));
			}
		} else if (filter(entry.name, fullPath)) {
			results.push(fullPath);
		}
	}
	return results;
}
