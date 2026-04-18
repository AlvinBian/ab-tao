/**
 * manifest-validator.mjs — state.json drift 偵測 + managed 清單管理
 *
 * 整合 state.mjs 提供高階 API：
 *   detectDrift()   — 對比 managed sha256 vs 實際檔案
 *   listManaged()   — 列出所有 ab-tao 管理的檔案
 *   markInstalled() — 安裝後記錄 managed 條目
 *   markUserOverride() — 使用者選 keep-local 時標記
 */

import fs from "node:fs";
import path from "node:path";
import { P } from "../core/paths.mjs";
import { stateRead, stateSetChoice, stateSetManaged } from "../state/state.mjs";
import { sha256OfFile } from "./three-way-diff.mjs";

/**
 * 偵測所有 managed 檔的 drift（實際 sha256 != 記錄 sha256）
 *
 * @returns {Array<{relPath: string, status: 'modified'|'deleted'|'ok', recorded: string, actual: string|null}>}
 */
export function detectDrift() {
	const state = stateRead();
	const results = [];

	for (const [relPath, entry] of Object.entries(state.managed)) {
		const absPath = path.join(P.home, relPath);
		const actualSha = sha256OfFile(absPath);

		if (actualSha === null) {
			results.push({
				relPath,
				status: "deleted",
				recorded: entry.sha256,
				actual: null,
			});
		} else if (actualSha !== entry.sha256) {
			results.push({
				relPath,
				status: "modified",
				recorded: entry.sha256,
				actual: actualSha,
			});
		} else {
			results.push({
				relPath,
				status: "ok",
				recorded: entry.sha256,
				actual: actualSha,
			});
		}
	}

	return results;
}

/**
 * 列出 ab-tao managed 的所有檔案
 * @returns {Array<{relPath: string, entry: object}>}
 */
export function listManaged() {
	return Object.entries(stateRead().managed).map(([relPath, entry]) => ({
		relPath,
		entry,
	}));
}

/**
 * 記錄已安裝檔案到 state.json managed
 *
 * @param {string} relPath 相對 ~/.claude/ 的路徑
 * @param {string} source ab-tao source 路徑描述
 */
export function markInstalled(relPath, source) {
	const absPath = path.join(P.home, relPath);
	const sha = sha256OfFile(absPath);
	if (!sha) return;
	stateSetManaged(relPath, {
		sha256: sha,
		source,
		installedAt: new Date().toISOString(),
		userOverride: false,
	});
}

/**
 * 標記使用者選擇 keep-local（後續 setup 自動 skip）
 * @param {string} relPath
 */
export function markUserOverride(relPath) {
	stateSetChoice(relPath, "keep-local");
}

/**
 * 是否應 skip（使用者已選 keep-local）
 * @param {string} relPath
 * @returns {boolean}
 */
export function shouldSkip(relPath) {
	const state = stateRead();
	const choice = state.choices[relPath];
	if (choice?.decision === "keep-local") return true;
	const entry = state.managed[relPath];
	return entry?.userOverride === true;
}
