/**
 * backup.mjs — timestamp backup（lewislulu 模型）
 *
 * 所有 stateWrite 前的檔案覆蓋必須先 backup，確保可回溯。
 * backup 格式：{filepath}.bak.{Date.now()}
 * 清理策略：由 session-end.sh hook 在 30 天後提示清除。
 */

import fs from "node:fs";

/**
 * 為目標路徑建立 timestamp backup
 *
 * @param {string} filepath 絕對路徑
 * @returns {string|null} backup 路徑（若原檔不存在則 null）
 */
export function backup(filepath) {
	if (!fs.existsSync(filepath)) return null;
	const backupPath = `${filepath}.bak.${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	fs.copyFileSync(filepath, backupPath);
	return backupPath;
}

/**
 * 列出某路徑的所有 backup 檔（排序由新到舊）
 *
 * @param {string} filepath 原始檔案路徑
 * @returns {string[]} backup 路徑陣列
 */
export function listBackups(filepath) {
	const dir = filepath.includes("/")
		? filepath.substring(0, filepath.lastIndexOf("/"))
		: ".";
	const base = filepath.includes("/")
		? filepath.substring(filepath.lastIndexOf("/") + 1)
		: filepath;
	try {
		return fs
			.readdirSync(dir)
			.filter((f) => f.startsWith(`${base}.bak.`))
			.map((f) => `${dir}/${f}`)
			.sort()
			.reverse();
	} catch {
		return [];
	}
}

/**
 * 清除超過 maxAgeDays 天的 backup 檔
 *
 * @param {string} filepath 原始檔案路徑
 * @param {number} maxAgeDays 最大保留天數（預設 30）
 * @returns {string[]} 已刪除的 backup 路徑
 */
export function pruneOldBackups(filepath, maxAgeDays = 30) {
	const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
	const deleted = [];
	for (const bak of listBackups(filepath)) {
		const ts = parseInt(bak.split(".bak.").pop(), 10);
		if (!Number.isNaN(ts) && ts < cutoff) {
			try {
				fs.unlinkSync(bak);
				deleted.push(bak);
			} catch {}
		}
	}
	return deleted;
}
