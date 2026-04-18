/**
 * 配置快速調整
 *
 * 職責：
 *   提供 5 個獨立調整函式，每個函式：
 *     1. 備份現有配置（可選）
 *     2. 執行安裝/重寫
 *     3. patchSession() 只更新相關欄位
 *
 *   不走完整 phaseAnalyze（無 GitHub API / AI 呼叫），
 *   僅 CLAUDE.md 重新生成時例外（需 AI）。
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { CLACK_LOGGER } from "../cli/logger.mjs";

import { getDirname, HOME } from "../core/paths.mjs";
import { loadSession, patchSession } from "../core/session.mjs";

const __dirname = getDirname(import.meta);
const REPO = path.resolve(__dirname, "../..");
const CLAUDE_DIR = path.join(HOME, ".claude");

function backupIfExists(src, dest) {
	if (fs.existsSync(src)) {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.cpSync(src, dest, { recursive: true });
	}
}

const TIMESTAMP = () =>
	new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

/**
 * 調整 1：重新安裝 Claude commands / agents / rules / hooks
 *
 * @param {Object} opts
 * @param {boolean} opts.flagAll - 跳過互動全選
 * @param {boolean} opts.manual - 只 preview，不部署
 */
export async function adjustClaude({ flagAll = false, manual = false } = {}) {
	const s = p.spinner();
	s.start("🗂️ 備份現有 Claude 配置...");
	const ts = TIMESTAMP();
	backupIfExists(
		path.join(CLAUDE_DIR, "commands"),
		path.join(REPO, "dist", "backup", ts, "claude", "commands"),
	);
	backupIfExists(
		path.join(CLAUDE_DIR, "agents"),
		path.join(REPO, "dist", "backup", ts, "claude", "agents"),
	);
	backupIfExists(
		path.join(CLAUDE_DIR, "rules"),
		path.join(REPO, "dist", "backup", ts, "claude", "rules"),
	);
	s.stop("✅ 備份完成");

	const { handleInstallClaude } = await import("../install/install-claude.mjs");
	const session = loadSession();
	const previewDir = path.join(REPO, "dist", "preview");
	const step = {
		script: "node:config-sync",
		selectable: {
			commands: {
				dir: "claude/commands",
				ext: ".md",
				dest: `${CLAUDE_DIR}/commands`,
			},
			agents: {
				dir: "claude/agents",
				ext: ".md",
				dest: `${CLAUDE_DIR}/agents`,
			},
			rules: { dir: "claude/rules", ext: ".md", dest: `${CLAUDE_DIR}/rules` },
		},
	};
	const result = await handleInstallClaude(
		REPO,
		previewDir,
		step,
		"[調整] ",
		flagAll,
		manual,
		[],
		session,
		CLACK_LOGGER,
	);
	if (result)
		await patchSession({
			install: { ...(loadSession()?.install || {}), claude: result },
		});
}

/**
 * 調整 2：重新套用全局設定（settings.json）
 */
export async function adjustGlobalSettings() {
	const s = p.spinner();
	s.start("⚙️ 套用全局設定...");
	try {
		const { syncConfig } = await import("../install/config-sync.mjs");
		const {
			SETTINGS_PRESERVE_PATHS,
			ADDITIVE_DIRS,
			FORBIDDEN_DIRS,
			SETTINGS_ARRAY_MERGE,
		} = await import("../config/preserve-policy.mjs");
		const templateDir = path.join(REPO, "claude");
		if (!fs.existsSync(templateDir)) {
			s.stop("claude/ 模板目錄不存在");
			return;
		}
		await syncConfig({
			home: CLAUDE_DIR,
			template: templateDir,
			policy: {
				preservePaths: SETTINGS_PRESERVE_PATHS,
				additiveDirs: ADDITIVE_DIRS,
				forbiddenDirs: FORBIDDEN_DIRS,
				arrayMerge: SETTINGS_ARRAY_MERGE,
			},
			mode: "auto",
			dryRun: false,
		});
		s.stop("全局設定已套用");
		await patchSession({ adjustedAt: new Date().toISOString() });
	} catch (err) {
		s.stop(`全局設定套用失敗：${err.message?.slice(0, 60)}`);
	}
}

/**
 * 調整 3：引導用戶使用官方 /init 指令生成 CLAUDE.md
 */
export async function adjustClaudeMd() {
	p.log.info(
		"💡 CLAUDE.md 建議使用官方 /init 指令生成（在每個 repo 目錄下執行）",
	);
}

/**
 * 調整 5：重新安裝 ZSH 模組
 *
 * @param {Object} opts
 * @param {boolean} opts.flagAll - 跳過互動全選
 * @param {boolean} opts.manual - 只 preview，不部署
 */
export async function adjustZsh({ flagAll = false, manual = false } = {}) {
	const s = p.spinner();
	s.start("🗂️ 備份現有 zsh 配置...");
	const ts = TIMESTAMP();
	backupIfExists(
		path.join(HOME, ".zshrc.d"),
		path.join(REPO, "dist", "backup", ts, "zshrc.d"),
	);
	s.stop("✅ 備份完成");

	const { handleInstallModules } = await import(
		"../install/install-modules.mjs"
	);
	const session = loadSession();
	const previewDir = path.join(REPO, "dist", "preview");
	const step = {
		script: "zsh zsh/install.sh",
		selectable: {
			modules: {
				dir: "zsh/.zshrc.d/conf",
				ext: ".zsh",
				dest: `${HOME}/.zshrc.d/conf`,
				exclude: ["00-env", "90-plugins"],
			},
		},
	};
	const result = await handleInstallModules(
		REPO,
		previewDir,
		step,
		"[調整] ",
		flagAll,
		manual,
		session,
		CLACK_LOGGER,
	);
	if (result)
		await patchSession({
			install: { ...(loadSession()?.install || {}), modules: result.modules },
		});
}
