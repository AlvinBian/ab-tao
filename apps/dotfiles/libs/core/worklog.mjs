import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { P } from "./paths.mjs";

/**
 * @typedef {{
 *   id: string;
 *   createdAt: string;
 *   sessionId: string;
 *   project: string;
 *   branch: string;
 *   ticketKey: string;
 *   startedAt: string;
 *   endedAt: string;
 *   durationSec: number;
 *   commits: {sha: string; subject: string}[];
 *   comment: string;
 * }} WorklogDraft
 */

/** @returns {WorklogDraft[]} */
export function readDrafts() {
	if (!existsSync(P.worklogDrafts)) return [];
	const lines = readFileSync(P.worklogDrafts, "utf8").split("\n");
	/** @type {WorklogDraft[]} */
	const out = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		try {
			out.push(JSON.parse(line));
		} catch {
			// skip corrupt lines
		}
	}
	return out;
}

/**
 * 從 jsonl 移除指定 id 的草稿
 * @param {string[]} ids
 * @returns {number} 移除筆數
 */
export function dismissDrafts(ids) {
	const drafts = readDrafts();
	const idSet = new Set(ids);
	const kept = drafts.filter((d) => !idSet.has(d.id));
	const body = kept.map((d) => JSON.stringify(d)).join("\n");
	writeFileSync(P.worklogDrafts, kept.length ? `${body}\n` : "");
	return drafts.length - kept.length;
}

/**
 * 更新指定草稿的部分欄位
 * @param {string} id
 * @param {Partial<WorklogDraft>} patch
 * @returns {boolean}
 */
export function updateDraft(id, patch) {
	const drafts = readDrafts();
	const idx = drafts.findIndex((d) => d.id === id);
	if (idx < 0) return false;
	drafts[idx] = { ...drafts[idx], ...patch };
	writeFileSync(
		P.worklogDrafts,
		`${drafts.map((d) => JSON.stringify(d)).join("\n")}\n`,
	);
	return true;
}
