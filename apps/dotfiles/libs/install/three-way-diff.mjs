/**
 * three-way-diff.mjs — chezmoi 三路 diff 模型
 *
 * 三方：
 *   source   — ab-tao template（apps/dotfiles/claude/...）
 *   target   — ~/.claude/ 目前檔案
 *   ancestor — 上次 manifest 記錄的 sha256（state.json managed[path]）
 *
 * 衝突分類：
 *   SAME              — target == source（無 drift）
 *   LOCAL_ONLY_CHANGE — target != ancestor，source == ancestor（純本地修改）
 *   SOURCE_ONLY_CHANGE — source != ancestor，target == ancestor（pure upstream update）
 *   BOTH_CHANGED      — 雙方都改了（真衝突）
 *   NEW_FILE          — ancestor 不存在（首次安裝）
 *   DELETED_LOCAL     — target 不存在
 */

import crypto from "node:crypto";
import fs from "node:fs";

/** 衝突類型常數 */
export const DiffType = {
	SAME: "same",
	LOCAL_ONLY_CHANGE: "local-only-change",
	SOURCE_ONLY_CHANGE: "source-only-change",
	BOTH_CHANGED: "both-changed",
	NEW_FILE: "new-file",
	DELETED_LOCAL: "deleted-local",
};

/**
 * 計算檔案 sha256（不存在時回傳 null）
 * @param {string} filepath
 * @returns {string|null}
 */
export function sha256OfFile(filepath) {
	try {
		const buf = fs.readFileSync(filepath);
		return crypto.createHash("sha256").update(buf).digest("hex");
	} catch {
		return null;
	}
}

/**
 * 計算字串 sha256
 * @param {string} str
 * @returns {string}
 */
export function sha256OfString(str) {
	return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

/**
 * 執行三路 diff
 *
 * @param {object} opts
 * @param {string} opts.sourcePath  ab-tao template 路徑
 * @param {string} opts.targetPath  ~/.claude/ 目前路徑
 * @param {string|null} opts.ancestorSha256  state.json 記錄的前次 sha256（null = 首次）
 * @returns {{ type: string, sourceSha: string|null, targetSha: string|null }}
 */
export function threeWayDiff({ sourcePath, targetPath, ancestorSha256 }) {
	const sourceSha = sha256OfFile(sourcePath);
	const targetSha = sha256OfFile(targetPath);

	if (targetSha === null)
		return { type: DiffType.DELETED_LOCAL, sourceSha, targetSha };
	if (sourceSha === null)
		return { type: DiffType.DELETED_LOCAL, sourceSha, targetSha };

	if (sourceSha === targetSha)
		return { type: DiffType.SAME, sourceSha, targetSha };

	if (ancestorSha256 === null) {
		return { type: DiffType.NEW_FILE, sourceSha, targetSha };
	}

	const sourceChanged = sourceSha !== ancestorSha256;
	const targetChanged = targetSha !== ancestorSha256;

	if (!sourceChanged && !targetChanged)
		return { type: DiffType.SAME, sourceSha, targetSha };
	if (!sourceChanged && targetChanged)
		return { type: DiffType.LOCAL_ONLY_CHANGE, sourceSha, targetSha };
	if (sourceChanged && !targetChanged)
		return { type: DiffType.SOURCE_ONLY_CHANGE, sourceSha, targetSha };
	return { type: DiffType.BOTH_CHANGED, sourceSha, targetSha };
}
