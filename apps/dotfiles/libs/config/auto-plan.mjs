/**
 * 自動決策引擎 — 根據 repos 分析結果生成完整安裝計畫
 *
 * 用戶只需選 repos，其他全自動決定。
 */

import {
	ALL_AGENTS,
	ALL_COMMANDS,
	ALL_RULES,
	determineRole,
	getClaudeMdType,
} from "./config-classifier.mjs";

// ── 全局 hooks（5 個）──

const ALL_HOOKS = [
	"PostToolUse:Edit|Write (prettier)",
	"PostToolUse:Edit|Write (eslint)",
	"PreToolUse:Edit|Write (檔案保護)",
	"PreToolUse:Bash (危險命令攔截)",
	"Notification (macOS 通知)",
];

// ── Permission 白名單 ──

const PERMISSION_PRESETS = {
	allow: ["Read(*)", "Edit(*)", "Write(*)", "Glob(*)", "Grep(*)", "Agent(*)"],
	deny: [
		"Bash(git push --force *)",
		"Bash(git reset --hard *)",
		"Bash(rm -rf /)",
		"Bash(rm -rf ~)",
	],
};

// ── 全局 settings ──

const SETTINGS_PRESETS = {
	model: "opusplan",
	effortLevel: "high",
	autoMemoryEnabled: true,
};

// ── ZSH 模組 ──

const ALL_ZSH_MODULES = ["history", "keys", "aliases", "git", "tools"];

/**
 * 生成完整安裝計畫
 *
 * @param {Object} opts
 * @param {Array} opts.repos - 含 fullName/commits/pct/desc/stars 的 repo 物件
 * @param {Object} opts.pipelineResult - Pipeline 分析結果
 * @param {Object} opts.aiResResult - AI 資源推薦結果
 * @param {Object} opts.localPaths - { fullName: localPath } 映射
 * @param {Object} opts.profile - 開發者畫像
 * @returns {Object} plan
 */
export function generateInstallPlan({
	repos,
	pipelineResult,
	aiResResult,
	localPaths,
	roleOverrides,
	profile,
}) {
	const reposWithRoles = repos.map((r) => ({
		...r,
		role: roleOverrides?.[r.fullName] || determineRole(r),
		localPath: localPaths?.[r.fullName] || null,
	}));

	// 排序：⭐ 主力 → 🔄 臨時 → 🔧 工具（所有展示統一此順序）
	const ROLE_ORDER = { main: 0, temp: 1, tool: 2 };
	reposWithRoles.sort(
		(a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9),
	);

	const mainRepos = reposWithRoles.filter((r) => r.role === "main");
	const tempRepos = reposWithRoles.filter((r) => r.role === "temp");
	const toolRepos = reposWithRoles.filter((r) => r.role === "tool");

	// 專案 CLAUDE.md（排序已繼承，只有找到 localPath 的才生成）
	const projects = reposWithRoles
		.filter((r) => r.localPath)
		.map((r) => ({
			repo: r.fullName,
			role: r.role,
			localPath: r.localPath,
			claudeMdType: getClaudeMdType(r.role),
		}));

	// 費用預估
	const aiCost = {
		classify: repos.length * 0.08,
		claudeMd: mainRepos.length * 0.03,
		profile: 0.02,
		total: repos.length * 0.08 + mainRepos.length * 0.03 + 0.02,
	};

	return {
		// 基本
		targets: ["claude-dev", "zsh"], // 由 setup.mjs 根據 features 裁剪
		mode: "auto",
		installMode: "full", // full | minimal

		// Repos
		repos: reposWithRoles,
		mainCount: mainRepos.length,
		tempCount: tempRepos.length,
		toolCount: toolRepos.length,

		// 技術棧
		techStacks:
			pipelineResult?.preselectedTechs || pipelineResult?.detectedSkills || [],

		// AI 資源
		aiRes: aiResResult?.recommended || [],

		// 全局配置（全部統一裝到 ~/.claude/）
		global: {
			commands: ALL_COMMANDS,
			agents: ALL_AGENTS,
			rules: ALL_RULES,
			hooks: ALL_HOOKS,
			permissions: PERMISSION_PRESETS,

			settings: SETTINGS_PRESETS,
		},

		// 專案配置
		projects,

		// zsh
		zshModules: ALL_ZSH_MODULES,

		// 畫像
		profile: profile || null,

		// 費用
		aiCost,

		// 時間戳
		timestamp: new Date().toISOString(),
	};
}

/**
 * 從完整計畫生成精簡安裝計畫
 *
 * 精簡模式只保留核心 commands/agents/rules，
 * 移除 AI 資源、專案配置和 ZSH 模組。
 * 適合快速上手或低權限環境。
 *
 * @param {Object} fullPlan - generateInstallPlan 返回的完整計畫
 * @returns {Object} 精簡版計畫（installMode = 'minimal'）
 */
export function generateMinimalPlan(fullPlan) {
	return {
		...fullPlan,
		installMode: "minimal",
		global: {
			commands: ["check", "test"],
			agents: ["debugger"],
			rules: ["api-and-data"],
			hooks: [
				"PostToolUse:Edit|Write (prettier)",
				"PreToolUse:Edit|Write (檔案保護)",
			],
			permissions: fullPlan.global.permissions,
			settings: fullPlan.global.settings,
		},
		projects: [],
		aiRes: [],
		zshModules: [],
	};
}

// Re-export for convenience
export { ALL_HOOKS, ALL_ZSH_MODULES, PERMISSION_PRESETS, SETTINGS_PRESETS };
