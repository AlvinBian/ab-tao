/**
 * Feature Registry — 功能註冊表與 orchestrator
 *
 * 每個 feature 是獨立的 plain object，統一接口，互不侵犯。
 * orchestrator 負責：功能選擇 → 依賴排序 → 逐一執行 → 統一收尾。
 */

import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import pc from "picocolors";
import { BACK, handleCancel } from "../cli/prompts.mjs";

// ── Feature 註冊 ─────────────────────────────────────────────────
// 動態 import 避免未選擇的 feature 載入不必要的依賴

const FEATURE_DEFS = [
	{
		id: "claude",
		label: "🤖 Claude Code 開發配置",
		hint: "commands · agents · rules · hooks · settings",
		load: () => import("./claude.mjs"),
	},
	{
		id: "project",
		label: "📁 專案配置（repos + AI）",
		hint: "CLAUDE.md + AI 資源 + 技術棧",
		load: () => import("./project.mjs"),
	},
	{
		id: "zsh",
		label: "🐚 ZSH 環境模組",
		hint: "history · keys · aliases · git · tools + sheldon 插件",
		load: () => import("./zsh.mjs"),
	},
	{
		id: "slack",
		label: "💬 Slack 通知",
		hint: "Channel / DM",
		load: () => import("./slack.mjs"),
	},
];

/**
 * 功能選擇（setup 的第一步）
 *
 * @returns {Promise<string[]>} 選擇的 feature id 陣列
 */
export async function selectFeatures() {
	const selected = handleCancel(
		await p.multiselect({
			message: "選擇安裝功能  Space 選擇 · Enter 確認（直接 Enter 取消）",
			options: FEATURE_DEFS.map((f) => ({
				value: f.id,
				label: `${f.label} ${pc.dim(f.hint)}`,
			})),
			initialValues: [],
			required: false,
		}),
	);

	if (selected === BACK || !selected || isEmpty(selected)) {
		return [];
	}

	return selected;
}

/**
 * 載入選擇的 feature 模組
 *
 * @param {string[]} ids - 選擇的 feature id 陣列
 * @returns {Promise<Object[]>} feature 物件陣列
 */
export async function loadFeatures(ids) {
	const features = [];
	for (const id of ids) {
		const def = FEATURE_DEFS.find((f) => f.id === id);
		if (!def) continue;
		const mod = await def.load();
		features.push(mod.default);
	}
	return features;
}

/**
 * 依賴拓撲排序
 *
 * @param {Object[]} features - feature 物件陣列
 * @returns {Object[]} 排序後的 feature 陣列
 */
export function topoSort(features) {
	const ids = new Set(features.map((f) => f.id));
	const sorted = [];
	const visited = new Set();

	function visit(feature) {
		if (visited.has(feature.id)) return;
		visited.add(feature.id);
		for (const depId of feature.dependsOn || []) {
			if (ids.has(depId)) {
				const dep = features.find((f) => f.id === depId);
				if (dep) visit(dep);
			}
		}
		sorted.push(feature);
	}

	for (const f of features) visit(f);
	return sorted;
}

/**
 * 建立 feature 隔離 context
 *
 * @param {Object} rootCtx - 頂層共享 context（不可變）
 * @param {Object} feature - feature 物件
 * @returns {Object} 隔離的 feature context
 */
export function createFeatureCtx(rootCtx, feature) {
	const { join } = rootCtx._path; // 由 orchestrator 注入
	const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	return {
		...rootCtx,
		featureId: feature.id,
		previewDir: join(rootCtx.repoDir, "dist", "preview", feature.id),
		backupDir: join(rootCtx.repoDir, "dist", "backup", ts, feature.id),
		state: {}, // feature 自己的可變狀態
	};
}
