/**
 * config-prompt.mjs — 互動式配置選擇流程
 *
 * 三方 diff 狀態 → 決定提示策略：
 *   same        → skip（無 prompt）
 *   new-file    → 直接寫入（target 不存在，無 prompt）
 *   skip        → 使用者已選 keep-local，自動略過
 *   drift       → 顯示選單 [d/u/k/m/s]（或 CI 自動決策）
 *
 * 非互動模式（CI=true 或 !stdin.isTTY）：
 *   - 讀 state.json.choices 中的已記錄選擇
 *   - 未記錄 → AB_TAO_CHOICE_DEFAULT env（預設 keep-local）
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
	stateGetChoice,
	stateGetManaged,
	stateSetChoice,
} from "../state/state.mjs";
import { backup } from "./backup.mjs";
import { deepMergeUnlessPresent, parseJsonSafe } from "./deep-merge.mjs";
import { markInstalled, shouldSkip } from "./manifest-validator.mjs";
import { runCmd } from "./run-cmd.mjs";
import { DiffType, threeWayDiff } from "./three-way-diff.mjs";

// ── 常數 ─────────────────────────────────────────────────────────

export const ChoiceAction = {
	USE_AB_TAO: "use-ab-tao",
	KEEP_LOCAL: "keep-local",
	MERGE: "merge",
	SKIP: "skip",
};

// ── 環境檢測 ─────────────────────────────────────────────────────

/** 是否為非互動模式（CI 或 non-TTY） */
export function isCI() {
	return process.env.CI === "true" || !process.stdin.isTTY;
}

/**
 * CI 模式下自動決策：
 * 1. 若 state.json 有已記錄選擇 → 採用
 * 2. 若 AB_TAO_CHOICE_DEFAULT 有設定 → 採用
 * 3. 預設 keep-local（yadm 模式：不覆蓋本地）
 */
export function getCIDefault(relPath) {
	const existing = stateGetChoice(relPath);
	if (existing) return existing.decision;

	const env = process.env.AB_TAO_CHOICE_DEFAULT;
	if (env === ChoiceAction.USE_AB_TAO) return ChoiceAction.USE_AB_TAO;
	if (env === ChoiceAction.MERGE) return ChoiceAction.MERGE;

	return ChoiceAction.KEEP_LOCAL;
}

// ── 評估 ─────────────────────────────────────────────────────────

/**
 * 評估單一檔案的 diff 狀態
 *
 * @param {string} relPath   相對 ~/.claude/ 的路徑（用於查 state）
 * @param {string} sourcePath ab-tao template 絕對路徑
 * @param {string} targetPath ~/.claude/ 目前絕對路徑
 * @returns {{ status: string, diff: object|null, autoAction: string|null, autoReason?: string }}
 */
export function evaluateFile(relPath, sourcePath, targetPath) {
	if (shouldSkip(relPath)) {
		return { status: "skip", diff: null, autoAction: ChoiceAction.KEEP_LOCAL };
	}

	const ancestorEntry = stateGetManaged(relPath);
	const ancestorSha = ancestorEntry?.sha256 ?? null;
	const diff = threeWayDiff({
		sourcePath,
		targetPath,
		ancestorSha256: ancestorSha,
	});

	// source 本身不存在（來源遺失）→ 略過
	if (diff.sourceSha === null) {
		return { status: "source-missing", diff, autoAction: ChoiceAction.SKIP };
	}

	switch (diff.type) {
		case DiffType.SAME:
			return { status: "same", diff, autoAction: "same" };

		case DiffType.DELETED_LOCAL:
			// target 不存在 → 新檔案，直接寫入
			return { status: "new-file", diff, autoAction: ChoiceAction.USE_AB_TAO };

		case DiffType.SOURCE_ONLY_CHANGE:
			// upstream 更新，本地未動 → 自動套用
			return {
				status: "drift",
				diff,
				autoAction: ChoiceAction.USE_AB_TAO,
				autoReason: "source-only",
			};

		// NEW_FILE, LOCAL_ONLY_CHANGE, BOTH_CHANGED → 需要 prompt
		default:
			return { status: "drift", diff, autoAction: null };
	}
}

// ── 應用 ─────────────────────────────────────────────────────────

/**
 * 執行選擇動作
 *
 * @param {string} action   ChoiceAction.*
 * @param {string} relPath  相對 ~/.claude/ 路徑
 * @param {string} sourcePath ab-tao template 路徑
 * @param {string} targetPath ~/.claude/ 目前路徑
 * @returns {{ applied: boolean, backupPath?: string }}
 */
export function applyFileChoice(action, relPath, sourcePath, targetPath) {
	switch (action) {
		case ChoiceAction.USE_AB_TAO: {
			const backupPath = runCmd(`backup ${relPath}`, () => backup(targetPath));
			runCmd(`copy ${sourcePath} → ${targetPath}`, () => {
				fs.mkdirSync(path.dirname(targetPath), { recursive: true });
				fs.copyFileSync(sourcePath, targetPath);
			});
			runCmd(`markInstalled ${relPath}`, () =>
				markInstalled(relPath, `ab-tao:${sourcePath}`),
			);
			return { applied: true, backupPath: backupPath ?? undefined };
		}

		case ChoiceAction.KEEP_LOCAL: {
			runCmd(`markUserOverride ${relPath}`, () =>
				stateSetChoice(relPath, "keep-local"),
			);
			return { applied: true };
		}

		case ChoiceAction.MERGE: {
			const srcContent = fs.readFileSync(sourcePath, "utf8");
			const tgtContent = fs.existsSync(targetPath)
				? fs.readFileSync(targetPath, "utf8")
				: "{}";

			const srcJson = parseJsonSafe(srcContent);
			const tgtJson = parseJsonSafe(tgtContent);

			if (!srcJson || !tgtJson) {
				// 非 JSON 檔案無法合併，回退至 keep-local
				runCmd(`markUserOverride ${relPath} (merge-fallback)`, () =>
					stateSetChoice(relPath, "keep-local"),
				);
				return { applied: false, fallback: "keep-local" };
			}

			const merged = deepMergeUnlessPresent(srcJson, tgtJson);
			const backupPath = runCmd(`backup ${relPath}`, () => backup(targetPath));
			runCmd(`write merged ${relPath}`, () => {
				fs.mkdirSync(path.dirname(targetPath), { recursive: true });
				fs.writeFileSync(
					targetPath,
					JSON.stringify(merged, null, "\t"),
					"utf8",
				);
			});
			runCmd(`markInstalled ${relPath}`, () =>
				markInstalled(relPath, `ab-tao:${sourcePath}+local-merge`),
			);
			return { applied: true, backupPath: backupPath ?? undefined };
		}

		case ChoiceAction.SKIP:
		default:
			return { applied: false };
	}
}

// ── 顯示 diff ─────────────────────────────────────────────────────

/** 顯示兩個檔案的 unified diff（fallback：顯示 sha256） */
export function showDiff(sourcePath, targetPath) {
	const result = spawnSync("diff", ["-u", targetPath, sourcePath], {
		encoding: "utf8",
		timeout: 3000,
	});

	if (result.stdout) {
		const lines = result.stdout.split("\n").slice(0, 50);
		console.log(lines.join("\n"));
		if (result.stdout.split("\n").length > 50) {
			console.log(`... （省略後續行）`);
		}
	} else {
		console.log(
			`target: ${_sha(targetPath) ?? "(missing)"}  source: ${_sha(sourcePath) ?? "(missing)"}`,
		);
	}
}

function _sha(p) {
	try {
		return crypto
			.createHash("sha256")
			.update(fs.readFileSync(p))
			.digest("hex")
			.slice(0, 12);
	} catch {
		return null;
	}
}

// ── 互動式 prompt（TTY 模式）──────────────────────────────────────

/**
 * 互動式選擇單一檔案的配置決策
 * CI 模式：自動決策（讀 state 或 env 預設）
 *
 * @param {string} relPath
 * @param {string} sourcePath
 * @param {string} targetPath
 * @returns {Promise<string>} ChoiceAction.*
 */
export async function promptFileChoice(relPath, sourcePath, targetPath) {
	const evaluation = evaluateFile(relPath, sourcePath, targetPath);

	// 自動決策情況（無需 prompt）
	if (evaluation.autoAction !== null) {
		return evaluation.autoAction;
	}

	// CI / 非 TTY 模式
	if (isCI()) {
		return getCIDefault(relPath);
	}

	// 互動式選單
	const diffType = evaluation.diff?.type ?? "unknown";
	const isJson = relPath.endsWith(".json");

	console.log(`\n┌─ 配置選擇 ────────────────────────────────────────┐`);
	console.log(`│  檔案：${relPath}`);
	console.log(`│  狀態：${_diffTypeLabel(diffType)}  `);
	console.log(`│`);
	console.log(`│  [d] 顯示 diff（本地 vs ab-tao template）`);
	console.log(`│  [u] 使用 ab-tao 預設（自動備份本地）`);
	console.log(`│  [k] 保留本地（標記 userOverride，日後自動 skip）`);
	if (isJson) {
		console.log(`│  [m] 合併（本地 key 優先，補入 template 缺漏 key）`);
	}
	console.log(`│  [s] 跳過本次（下次 d:setup 再問）`);
	console.log(`└────────────────────────────────────────────────────┘`);

	const validChoices = isJson
		? ["d", "u", "k", "m", "s"]
		: ["d", "u", "k", "s"];

	while (true) {
		const choice = await _readLine(`選擇 [${validChoices.join("/")}]：`);
		const c = choice.trim().toLowerCase();

		if (c === "d") {
			showDiff(sourcePath, targetPath);
			continue;
		}

		if (c === "u") return ChoiceAction.USE_AB_TAO;
		if (c === "k") return ChoiceAction.KEEP_LOCAL;
		if (c === "m" && isJson) return ChoiceAction.MERGE;
		if (c === "s") return ChoiceAction.SKIP;

		console.log(`  無效選項，請輸入 ${validChoices.join("/")}。`);
	}
}

/**
 * 完整處理單一檔案（evaluate → prompt → apply）
 *
 * @param {string} relPath
 * @param {string} sourcePath
 * @param {string} targetPath
 * @returns {Promise<{ status: string, action: string, result: object }>}
 */
export async function processFile(relPath, sourcePath, targetPath) {
	const evaluation = evaluateFile(relPath, sourcePath, targetPath);

	if (evaluation.status === "same") {
		return { status: "same", action: "same", result: {} };
	}

	if (evaluation.status === "skip") {
		return { status: "skip", action: ChoiceAction.KEEP_LOCAL, result: {} };
	}

	if (evaluation.status === "source-missing") {
		return { status: "source-missing", action: ChoiceAction.SKIP, result: {} };
	}

	const action = await promptFileChoice(relPath, sourcePath, targetPath);

	// same / skip 不執行 apply
	if (action === "same" || action === ChoiceAction.SKIP) {
		return { status: evaluation.status, action, result: {} };
	}

	const result = applyFileChoice(action, relPath, sourcePath, targetPath);
	return { status: evaluation.status, action, result };
}

// ── 工具 ─────────────────────────────────────────────────────────

function _diffTypeLabel(type) {
	const labels = {
		"new-file": "首次安裝（無 ancestor 紀錄）",
		"local-only-change": "本地已修改（template 未動）",
		"source-only-change": "template 更新（本地未動）",
		"both-changed": "雙方都有修改（真衝突）",
		deleted_local: "本地已刪除",
		same: "相同",
	};
	return labels[type] ?? type;
}

async function _readLine(prompt) {
	const { createInterface } = await import("node:readline");
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(prompt, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}
