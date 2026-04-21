/**
 * Feature Registry — 功能註冊表與 orchestrator
 *
 * 每個 feature 是獨立的 plain object，統一接口，互不侵犯。
 * orchestrator 負責：功能選擇 → 依賴展開 → 依賴排序 → 逐一執行 → 統一收尾。
 *
 * visible: true  — 使用者可見，出現在 selectFeatures 選單
 * visible: false — 內部功能，僅透過依賴鏈自動拉入
 */

import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import pc from "picocolors";
import { BACK, handleCancel } from "../cli/prompts.mjs";

// ── Feature 定義 ─────────────────────────────────────────────────
// 動態 import 避免未選擇的 feature 載入不必要的依賴

const FEATURE_DEFS = [
	// ── 使用者可見（選單項目）──────────────────────────────
	// order 欄位控制選單顯示順序（數字越小越前）
	{
		id: "zsh",
		label: "🐚 ZSH 環境模組",
		hint: "history · keys · aliases · git · tools + sheldon 插件",
		load: () => import("./zsh.mjs"),
		dependsOn: [],
		visible: true,
		order: 10,
	},
	{
		id: "chrome",
		label: "🌐 Chrome 優化配置",
		hint: "flags · 搜尋引擎 · 記憶體優化 · ZSH 工具",
		load: () => import("./chrome.mjs"),
		dependsOn: [],
		visible: true,
		order: 20,
	},
	{
		id: "claude-base",
		label: "🤖 Claude Code 配置",
		hint: "commands · agents · rules · hooks · settings",
		load: () => import("./claude-base.mjs"),
		dependsOn: [],
		visible: true,
		order: 30,
	},
	{
		id: "plugins",
		label: "🔌 官方 Plugins",
		hint: "code-review · commit-commands · feature-dev · code-simplifier · security-guidance · hookify · ralph-loop · session-report",
		load: () => import("./plugins.mjs"),
		dependsOn: [],
		visible: true,
		order: 40,
	},
	{
		id: "project-install",
		label: "📦 專案配置",
		hint: "repos + AI 資源 + 技術棧 + CLAUDE.md",
		load: () => import("./project-install.mjs"),
		dependsOn: ["repos", "tech-analysis"],
		visible: true,
		order: 50,
	},

	// ── 內部功能（依賴鏈自動拉入，不在選單中顯示）────────
	{
		id: "repos",
		label: "📁 Repos 選擇",
		hint: "組織 · repos · 角色分配",
		load: () => import("./repos.mjs"),
		dependsOn: [],
		visible: false,
	},
	{
		id: "tech-analysis",
		label: "🔬 技術分析",
		hint: "技術棧 · AI 分析 · 開發者畫像",
		load: () => import("./tech-analysis.mjs"),
		dependsOn: ["repos"],
		visible: false,
	},
];

/**
 * 功能選擇（setup 的第一步）
 *
 * 僅顯示 visible !== false 的功能，選擇後自動遞迴展開依賴。
 *
 * @returns {Promise<string[]>} 選擇的 feature id 陣列（含自動展開的依賴）
 */
export async function selectFeatures() {
	const visibleDefs = FEATURE_DEFS.filter((f) => f.visible !== false).sort(
		(a, b) => (a.order ?? 99) - (b.order ?? 99),
	);
	const selected = handleCancel(
		await p.multiselect({
			message: "選擇安裝功能  Space 選擇 · Enter 確認（直接 Enter 取消）",
			options: visibleDefs.map((f) => ({
				value: f.id,
				label: `${f.label} ${pc.dim(f.hint)}`,
			})),
			initialValues: [],
			required: false,
		}),
	);

	if (selected === BACK || !selected || isEmpty(selected)) return [];

	// 展開依賴：遞迴加入所有 dependsOn
	const allIds = new Set(selected);
	const expand = (id) => {
		const def = FEATURE_DEFS.find((f) => f.id === id);
		for (const dep of def?.dependsOn || []) {
			if (!allIds.has(dep)) {
				allIds.add(dep);
				expand(dep);
			}
		}
	};
	for (const id of selected) expand(id);

	const defOrder = FEATURE_DEFS.map((f) => f.id);
	return [...allIds].sort((a, b) => {
		const ia = defOrder.indexOf(a);
		const ib = defOrder.indexOf(b);
		return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
	});
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
