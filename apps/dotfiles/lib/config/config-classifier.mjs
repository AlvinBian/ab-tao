/**
 * 配置分類引擎
 *
 * 所有 commands/agents/rules 統一裝到 ~/.claude/（全局）
 * 只有 CLAUDE.md 按 repo 角色差異化 → ~/.claude/projects/{path}/
 */

import fs from "node:fs";
import path from "node:path";
import { isEmpty } from "lodash-es";
import { getDirname } from "../core/paths.mjs";

const __dirname = getDirname(import.meta);
const CLAUDE_DIR = path.resolve(__dirname, "..", "..", "claude");

// ── 靜態 fallback（當動態掃描結果為空時使用）──

const FALLBACK_COMMANDS = [
	"pr-workflow",
	"tdd",
	"refactor-clean",
	"changeset",
	"e2e",
	"multi-frontend",
	"prompt-optimize",
	"multi-plan",
	"adr",
	"runbook",
	"api-design",
	"db-migration",
	"incident",
	"test",
	"check",
	"slack",
];

const FALLBACK_AGENTS = [
	"deployer",
	"migrator",
	"monitor",
	"dependency-auditor",
	"tdd-guide",
	"architect",
	"debugger",
	"perf",
	"data",
];

const FALLBACK_RULES = [
	"code-style",
	"git-workflow",
	"project-conventions",
	"testing",
	"performance",
	"slack-mrkdwn",
	"tool-selection",
	"agent-orchestration",
	"api-conventions",
	"context-management",
	"error-handling",
	"security-baseline",
	"observability",
	"typescript-conventions",
	"database-conventions",
];

// ── 動態掃描 claude/ 子目錄 ──

function scanClaudeDir(subdir) {
	const dir = path.join(CLAUDE_DIR, subdir);
	try {
		return fs
			.readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(/\.md$/, ""));
	} catch {
		return [];
	}
}

const _scanned = {
	commands: scanClaudeDir("commands"),
	agents: scanClaudeDir("agents"),
	rules: scanClaudeDir("rules"),
};

// ── 全部配置（統一安裝到 ~/.claude/）──

export const ALL_COMMANDS = !isEmpty(_scanned.commands)
	? _scanned.commands
	: FALLBACK_COMMANDS;
export const ALL_AGENTS = !isEmpty(_scanned.agents)
	? _scanned.agents
	: FALLBACK_AGENTS;
export const ALL_RULES = !isEmpty(_scanned.rules)
	? _scanned.rules
	: FALLBACK_RULES;

// 舊版時這些是專案級（現在全部統一到全局，但 upgrade.mjs 需要知道舊的分類來清理）
export const LEGACY_PROJECT_COMMANDS = [
	"e2e",
	"multi-frontend",
	"test-coverage",
	"auto-setup",
	"draft-slack",
	"review-slack",
	"slack-formatting",
	"build-fix",
	"quality-gate",
	"test-gen",
	"code-review",
	"simplify",
	"context-budget",
	"aside",
	"plan",
	"verify",
	"changelog",
	"onboarding",
];
export const LEGACY_PROJECT_AGENTS = [
	"security",
	"migrator",
	"perf-analyzer",
	"monitor",
	"refactor",
	"coder",
	"reviewer",
	"tester",
	"planner",
	"documenter",
	"explorer",
	"typescript-reviewer",
	"accessibility",
	"chief-of-staff",
	"architecture-reviewer",
	"build-error-resolver",
	"load-tester",
	"data-analyst",
	"database-reviewer",
];
export const LEGACY_PROJECT_RULES = [
	"project-conventions",
	"testing",
	"performance",
	"slack-mrkdwn",
];

// ── 角色閾值 ──

export const MAIN_REPO_MIN_COMMITS = 3;

// ── 角色判定 ──

/**
 * 根據 repo 的 commit 數量判定角色
 *
 * commit 數 ≥ MAIN_REPO_MIN_COMMITS（3）時為主力 repo，其餘為臨時 repo。
 * 工具類 repo（tool）需在呼叫端用 roleOverrides 手動指定。
 *
 * @param {{ commits: number }} repo - 含貢獻 commit 數的 repo 物件
 * @returns {'main'|'temp'} repo 角色
 */
export function determineRole(repo) {
	if (repo.commits >= MAIN_REPO_MIN_COMMITS) return "main";
	return "temp";
}

// ── 路徑編碼（Claude Code 原生格式）──

/**
 * 將本地路徑編碼為 Claude Code projects/ 目錄的 key 格式
 *
 * Claude Code 用路徑中的 / 全部換成 - 作為目錄名稱。
 * 例如：/Users/foo/bar → -Users-foo-bar
 *
 * @param {string} localPath - 本地絕對路徑
 * @returns {string} 編碼後的 key 字串
 */
export function encodeProjectPath(localPath) {
	return localPath.replace(/\//g, "-");
}

// ── CLAUDE.md 模板類型（按角色）──

/**
 * 根據 repo 角色返回對應的 CLAUDE.md 模板類型
 *
 * @param {'main'|'temp'|string} role - repo 角色
 * @returns {'full'|'concise'|'minimal'} 模板類型
 *   - full: AI 生成的完整版（主力 repo）
 *   - concise: 靜態精簡模板（臨時 repo）
 *   - minimal: 一行描述（工具型 repo）
 */
export function getClaudeMdType(role) {
	switch (role) {
		case "main":
			return "full"; // AI 生成完整版
		case "temp":
			return "concise"; // 靜態精簡模板
		default:
			return "minimal"; // 一行描述
	}
}
