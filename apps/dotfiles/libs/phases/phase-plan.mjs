/**
 * Phase: 安裝計畫展示 + 確認/調整/精簡
 *
 * 用 p.log.info 展示完整安裝計畫，讓用戶選擇安裝方式：
 *   - 安裝全部（直接執行）
 *   - 逐項確認（展開 detailConfirm 子流程）
 *   - 精簡安裝（只裝核心必需品）
 *   - 上一步（返回 BACK symbol）
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { cloneDeep, isEmpty } from "lodash-es";
import { buildPlanSummary } from "../cli/plan-view.mjs";
import { BACK, handleCancel, smartSelect } from "../cli/prompts.mjs";
import { generateMinimalPlan } from "../config/auto-plan.mjs";
import { HOME } from "../core/paths.mjs";

/** 官方推薦 Plugins */
const RECOMMENDED_PLUGINS = [
	{ name: "code-review", desc: "多 agent 並行 PR 審查" },
	{ name: "commit-commands", desc: "智能 commit 訊息生成" },
	{ name: "feature-dev", desc: "7 階段結構化功能開發" },
	{ name: "code-simplifier", desc: "審查變更代碼的品質與效率" },
	{ name: "security-guidance", desc: "安全漏洞掃描與修復建議" },
	{ name: "hookify", desc: "分析對話模式自動生成 hooks" },
	{ name: "ralph-loop", desc: "持續迭代迴圈 — 自動重試直到完成" },
	{ name: "session-report", desc: "Session 分析報告 — 回顧工作成果" },
];

/** 偵測已安裝的 plugins */
function getInstalledPlugins() {
	try {
		const out = execFileSync("claude", ["plugin", "list", "--json"], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 10000,
		});
		return new Set(JSON.parse(out.toString()).map((pl) => pl.name));
	} catch {
		return null; // claude CLI 不可用
	}
}

/** 取得推薦但未安裝的 plugins */
function getMissingPlugins() {
	const installed = getInstalledPlugins();
	if (!installed) return { available: false, missing: [] };
	return {
		available: true,
		missing: RECOMMENDED_PLUGINS.filter((pl) => !installed.has(pl.name)),
	};
}

/**
 * 展示安裝計畫並讓用戶確認
 *
 * @param {Object} plan - generateInstallPlan 產出
 * @returns {Object|symbol} 確認的 plan（可能被「精簡」修改）/ BACK / null（取消）
 */
export async function phasePlan(plan) {
	// 偵測現有安裝狀態
	const claudeDir = path.join(HOME, ".claude");
	const readDir = (dir) =>
		fs.existsSync(dir)
			? fs
					.readdirSync(dir)
					.filter((f) => f.endsWith(".md"))
					.map((f) => f.replace(".md", ""))
			: [];
	const existing = {
		commands: readDir(path.join(claudeDir, "commands")),
		agents: readDir(path.join(claudeDir, "agents")),
		rules: readDir(path.join(claudeDir, "rules")),
		hasSettings: fs.existsSync(path.join(claudeDir, "settings.json")),
		hasHooks: fs.existsSync(path.join(claudeDir, "hooks.json")),
	};

	// 組裝計畫摘要
	const summary = buildPlanSummary(plan, existing, HOME, claudeDir);
	p.log.info(`安裝計畫\n${summary}`);

	// 選擇
	const action = handleCancel(
		await p.select({
			message: "安裝方式  ↑↓ 選擇 · Enter 確認 · ESC 上一步",
			options: [
				{ value: "full", label: "✅ 安裝全部（推薦）" },
				{ value: "detail", label: "📋 逐項確認 展開各類別的選擇" },
				{
					value: "minimal",
					label: "⚡ 精簡安裝 只裝核心必需品（check + test + debugger）",
				},
				{ value: "back", label: "← 上一步" },
			],
		}),
	);

	if (action === BACK || action === "back") return BACK;

	let finalPlan;
	if (action === "minimal") finalPlan = generateMinimalPlan(plan);
	else if (action === "detail") finalPlan = await detailConfirm(plan);
	else finalPlan = plan;

	if (finalPlan === BACK) return BACK;

	// ── Model 選擇 ──
	const currentModel = (() => {
		try {
			const s = JSON.parse(
				fs.readFileSync(path.join(HOME, ".claude", "settings.json"), "utf8"),
			);
			return s.model || null;
		} catch {
			return null;
		}
	})();

	const modelChoice = handleCancel(
		await p.select({
			message: `🤖 Claude Code 模型策略${currentModel ? `  (目前：${currentModel})` : ""}`,
			options: [
				{
					value: "opusplan",
					label:
						"opusplan — 規劃用 Opus，執行用 Sonnet（推薦：品質與成本平衡，省 68%）",
				},
				{
					value: "sonnet",
					label: "sonnet 均衡（一般開發的預設選擇）",
				},
				{
					value: "haiku",
					label: "haiku 速度優先（成本最低，適合簡單任務）",
				},
				{
					value: "opus",
					label: "opus 最高品質（複雜架構設計、全程 Opus）",
				},
				{
					value: null,
					label: `← 保留現有設定${currentModel ? `（目前：${currentModel}）` : "（未設定）"}`,
				},
			],
			initialValue: currentModel || "opusplan",
		}),
	);
	if (modelChoice !== BACK) finalPlan.model = modelChoice;

	// ── Plugin 選擇（所有模式共用，安裝前選好）──
	const feats = new Set(finalPlan.features || []);
	if (feats.has("claude")) {
		p.log.info(
			[
				"📦 安裝層次說明",
				"  Layer 1 ab-tao 核心   — commands / agents / rules（剛才已選）",
				"  Layer 2 Anthropic 官方 — plugins from claude-plugins-official",
				"  Layer 3 外部 AI 資源  — commons 4 個來源（ECC / Anthropic / Superpowers / Context）",
			].join("\n"),
		);
		const { available, missing } = getMissingPlugins();
		if (!available) {
			p.log.warn(
				"Claude CLI 未安裝，跳過 Plugin 選擇。安裝後可手動執行：\n" +
					"  claude plugin install <name>@claude-plugins-official",
			);
			finalPlan.plugins = [];
		} else if (isEmpty(missing)) {
			p.log.success("✔ 所有推薦 Anthropic 官方 Plugins 已安裝");
			finalPlan.plugins = [];
		} else {
			const selected = handleCancel(
				await p.multiselect({
					message:
						"🔌 Anthropic 官方 Plugins  Space 選擇 · Enter 確認（直接 Enter 跳過）",
					options: missing.map((pl) => ({
						value: pl.name,
						label: `${pl.name} ${pl.desc}`,
					})),
					required: false,
					initialValues: missing.map((pl) => pl.name),
				}),
			);
			finalPlan.plugins = selected === BACK || !selected ? [] : selected;
		}
	}

	return finalPlan;
}

/**
 * 逐項確認子流程
 *
 * 讓用戶逐步調整計畫中的各個項目：
 *   1. 調整各 repo 的角色（main/temp）
 *   2. 選擇全局 commands / agents / rules
 *   3. 選擇 AI 外部資源
 *   4. 選擇 ZSH 模組
 *
 * @param {Object} originalPlan - 原始計畫（不直接修改，使用 cloneDeep 複製）
 * @returns {Promise<Object|symbol>} 調整後的計畫，或 BACK symbol
 */
async function detailConfirm(originalPlan) {
	// _pipelineResult 含 Map 物件，cloneDeep 會損壞 Map，先取出再還原
	const savedPipelineResult = originalPlan._pipelineResult;
	const savedFetchedSources = originalPlan._fetchedSources;
	const savedCommonsResources = originalPlan._commonsResources;
	// 深拷貝避免 BACK 時污染 cache 中的原始 plan
	const plan = cloneDeep(originalPlan);
	plan._pipelineResult = savedPipelineResult;
	plan._fetchedSources = savedFetchedSources;
	plan._commonsResources = savedCommonsResources;
	// 1. Repo 角色調整
	const roleItems = plan.repos.map((r) => ({
		value: r.fullName,
		label: `${r.role === "main" ? "⭐" : "🔄"} ${r.fullName.split("/")[1]} ${r.role === "main" ? "主力（完整配置）" : "臨時（精簡配置）"}`,
	}));
	const mainRepos = await smartSelect({
		title: "⭐ 主力 repos（完整配置）",
		items: roleItems,
		preselected: plan.repos
			.filter((r) => r.role === "main")
			.map((r) => r.fullName),
		required: true,
		autoSelectThreshold: 0,
	});
	if (mainRepos === BACK) return BACK;

	// 更新角色
	const mainSet = new Set(mainRepos);
	for (const r of plan.repos) {
		if (mainSet.has(r.fullName)) {
			r.role = "main";
		} else if (r.role !== "tool") {
			r.role = "temp";
		}
		// tool repos keep their role unchanged
	}

	// 2-5. 全局 commands/agents/rules/hooks（各一個 smartSelect）
	const globalSelections = [
		{ key: "commands", title: "📟 全局 Commands", pool: plan.global.commands },
		{ key: "agents", title: "🤖 全局 Agents", pool: plan.global.agents },
		{ key: "rules", title: "📐 全局 Rules", pool: plan.global.rules },
	];

	for (const sel of globalSelections) {
		const items = sel.pool.map((name) => ({
			value: name,
			label: name,
		}));
		const selected = await smartSelect({
			title: sel.title,
			items,
			preselected: sel.pool,
			autoSelectThreshold: 0,
		});
		if (selected === BACK) return BACK;
		plan.global[sel.key] = selected;
	}

	// 6. 技術棧（如果 pipeline 有 tech-select 邏輯，這裡直接用預選）
	// 7. AI 資源選擇
	if (!isEmpty(plan.aiRes)) {
		const aiResItems = plan.aiRes.map((name) => ({
			value: name,
			label: name,
		}));
		const selectedAiRes = await smartSelect({
			title: "🌐 AI 資源",
			items: aiResItems,
			preselected: plan.aiRes,
			autoSelectThreshold: 0,
		});
		if (selectedAiRes === BACK) return BACK;
		plan.aiRes = selectedAiRes;
	}

	// 7.5. 每個 AI 來源的資源確認
	const commSources = plan._commonsResources?.sources || [];
	if (!isEmpty(commSources)) {
		const sourceIcons = {
			ecc: "🌐",
			anthropic: "📚",
			superpowers: "🚀",
			"context-engineering": "🧠",
		};
		plan.commonsSelections = {};

		for (const src of commSources) {
			const icon = sourceIcons[src.name] || "📦";
			const types = [
				{ key: "commands", items: src.commands || [], label: "commands" },
				{ key: "agents", items: src.agents || [], label: "agents" },
				{ key: "rules", items: src.rules || [], label: "rules" },
				{ key: "skills", items: src.skills || [], label: "skills" },
			].filter((t) => t.items.length > 0);

			if (isEmpty(types)) continue;

			// 將所有資源類型合併為一個 smartSelect（帶類型前綴）
			const allItems = [];
			const allPreselected = [];
			for (const t of types) {
				for (const item of t.items) {
					const name = item.name?.replace(".md", "") || item.name;
					const key = `${t.key}:${name}`;
					allItems.push({
						value: key,
						label: `[${t.label}] ${name}`,
					});
					allPreselected.push(key);
				}
			}

			const typeSummary = types
				.map((t) => `${t.items.length} ${t.label}`)
				.join(" · ");
			const selected = await smartSelect({
				title: `${icon} ${src.name}（${typeSummary}）`,
				items: allItems,
				preselected: allPreselected,
				autoSelectThreshold: 0,
			});
			if (selected === BACK) return BACK;

			// 解析選擇結果回各類型
			const selections = { commands: [], agents: [], rules: [], skills: [] };
			for (const key of selected) {
				const [type, ...nameParts] = key.split(":");
				const name = nameParts.join(":");
				if (selections[type]) selections[type].push(name);
			}
			plan.commonsSelections[src.name] = selections;
		}
	}

	// 8. ZSH 模組
	if (!isEmpty(plan.zshModules)) {
		const zshItems = plan.zshModules.map((name) => ({
			value: name,
			label: name,
		}));
		const selectedZsh = await smartSelect({
			title: "🐚 ZSH 模組",
			items: zshItems,
			preselected: plan.zshModules,
			autoSelectThreshold: 0,
		});
		if (selectedZsh === BACK) return BACK;
		plan.zshModules = selectedZsh;
	}

	return plan;
}
