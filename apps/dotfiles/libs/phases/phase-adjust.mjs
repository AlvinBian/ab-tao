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
import { BACK, handleCancel } from "../cli/prompts.mjs";

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
		script: "node bin/install-preview.mjs",
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
 * 調整 2：合併 settings.template.json + hooks.json → settings.json
 *
 * 策略：
 *   - template 為基底，PRESERVE_PATHS 強制保留本地值
 *   - hooks.json 的 hooks 合併進 settings.json（以 id 去重）
 *   - 互動確認後寫入，可跳過
 */
export async function adjustGlobalSettings() {
	const { mergeConfig } = await import("../install/config-merge.mjs");
	const { SETTINGS_PRESERVE_PATHS, SETTINGS_ARRAY_MERGE } = await import(
		"../config/preserve-policy.mjs"
	);

	const templatePath = path.join(REPO, "claude", "settings.template.json");
	const localPath = path.join(CLAUDE_DIR, "settings.json");
	const hooksPath = path.join(CLAUDE_DIR, "hooks.json");

	if (!fs.existsSync(templatePath)) {
		p.log.warn("settings.template.json 不存在，跳過");
		return;
	}

	const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
	const local = fs.existsSync(localPath)
		? JSON.parse(fs.readFileSync(localPath, "utf8"))
		: {};

	// 合併（PRESERVE_PATHS 強制保留本地值）
	const merged = mergeConfig(template, local, {
		preservePaths: SETTINGS_PRESERVE_PATHS,
		arrayMerge: SETTINGS_ARRAY_MERGE,
	});

	// 將 hooks.json 的 hooks 合併進 settings（以 id 去重）
	if (fs.existsSync(hooksPath)) {
		try {
			const hooksData = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
			if (hooksData.hooks) {
				merged.hooks = merged.hooks ?? {};
				for (const [event, handlers] of Object.entries(hooksData.hooks)) {
					const existing = merged.hooks[event] ?? [];
					const existingIds = new Set(existing.map((h) => h.id));
					merged.hooks[event] = [
						...existing,
						...handlers.filter((h) => !existingIds.has(h.id)),
					];
				}
			}
		} catch {}
	}

	// 找出有差異的頂層 key
	const changedKeys = Object.keys(merged).filter(
		(k) => JSON.stringify(merged[k]) !== JSON.stringify(local[k]),
	);

	if (changedKeys.length === 0) {
		p.log.success("settings.json 無需更新（已是最新）");
		return;
	}

	// local 沒有的 key（新增）→ 預設全選
	const newKeys = changedKeys.filter((k) => !(k in local));
	// local 已有但值不同的 key（更新）→ 預設不選
	const updateKeys = changedKeys.filter((k) => k in local);

	let selectedNew = newKeys;
	if (newKeys.length > 0) {
		const result = await p.multiselect({
			message: "以下為新增欄位，請選擇要套用的項目：",
			options: newKeys.map((k) => ({ value: k, label: pc.cyan(k) })),
			initialValues: newKeys,
		});
		if (p.isCancel(result)) {
			p.log.warn("已取消，settings.json 未修改");
			return;
		}
		selectedNew = result;
	}

	let selectedUpdate = [];
	if (updateKeys.length > 0) {
		const result = await p.multiselect({
			message: "以下為更新欄位（local 已有不同值），請選擇要覆蓋的項目：",
			options: updateKeys.map((k) => ({ value: k, label: pc.cyan(k) })),
			initialValues: [],
		});
		if (p.isCancel(result)) {
			p.log.warn("已取消，settings.json 未修改");
			return;
		}
		selectedUpdate = result;
	}

	const selectedKeys = [...selectedNew, ...selectedUpdate];
	if (selectedKeys.length === 0) {
		p.log.warn("未選擇任何欄位，settings.json 未修改");
		return;
	}

	// 以 local 為基底，只套用選擇的 key
	const finalConfig = structuredClone(local);
	for (const k of selectedKeys) {
		finalConfig[k] = merged[k];
	}

	// 備份現有 settings.json
	if (fs.existsSync(localPath)) {
		const ts = TIMESTAMP();
		const backupDir = path.join(REPO, "dist", "backup", ts);
		fs.mkdirSync(backupDir, { recursive: true });
		fs.copyFileSync(localPath, path.join(backupDir, "settings.json"));
	}

	fs.writeFileSync(localPath, JSON.stringify(finalConfig, null, "\t"), "utf8");
	p.log.success("✅ settings.json 已更新（hooks.json 已合併）");
	await patchSession({ adjustedAt: new Date().toISOString() });
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
