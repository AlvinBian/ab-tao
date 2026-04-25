/**
 * ESM 路徑工具 — ~/.claude/ 唯一路徑登記表
 *
 * 所有模組統一由此匯入，禁止在其他檔案出現
 * path.join(HOME, ".claude", ...) 字面量
 */

import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HOME = os.homedir();
export const CLAUDE = path.join(HOME, ".claude");

/** ~/.claude/ 子路徑映射表 */
export const P = {
	home: CLAUDE,
	claudeMd: path.join(CLAUDE, "CLAUDE.md"),
	settings: path.join(CLAUDE, "settings.json"),
	hooksJson: path.join(CLAUDE, "hooks.json"),
	claudeMdDir: path.join(CLAUDE, "claude-md"),
	rules: path.join(CLAUDE, "rules"),
	docs: path.join(CLAUDE, "docs"),
	agents: path.join(CLAUDE, "agents"),
	commands: path.join(CLAUDE, "commands"),
	skills: path.join(CLAUDE, "skills"),
	hooks: path.join(CLAUDE, "hooks"),
	hookPrefs: path.join(CLAUDE, "hooks", ".prefs"),
	memory: path.join(CLAUDE, "memory"),
	projects: path.join(CLAUDE, "projects"),
	plans: path.join(CLAUDE, "plans"),
	tasks: path.join(CLAUDE, "tasks"),
	cache: path.join(CLAUDE, ".cache"),
	archive: path.join(CLAUDE, "_archive"),
	abTaoDir: path.join(CLAUDE, ".ab-tao"),
	state: path.join(CLAUDE, ".ab-tao", "state.json"),
	stateSchema: path.join(CLAUDE, ".ab-tao", "state.schema.json"),
	stateLock: path.join(CLAUDE, ".ab-tao", "state.lock"),
	configChoices: path.join(CLAUDE, ".ab-tao", "state.json"), // choices 現在在 state.json 內
	pluginsLock: path.join(CLAUDE, ".ab-tao", "plugins.lock"),
	pluginsInstalledJson: path.join(CLAUDE, "plugins", "installed_plugins.json"),
	metrics: path.join(CLAUDE, ".ab-tao", "metrics.jsonl"),
	sessionState: path.join(CLAUDE, ".ab-tao", "session-state.json"),
	worklogDrafts: path.join(CLAUDE, ".ab-tao", "worklog-drafts.jsonl"),
	claudeHudPluginDir: path.join(CLAUDE, "plugins", "claude-hud"),
	claudeHudWrapper: path.join(
		CLAUDE,
		"plugins",
		"claude-hud",
		"hud-wrapper.sh",
	),
	claudeHudConfig: path.join(CLAUDE, "plugins", "claude-hud", "config.json"),
	agentsMd: path.join(CLAUDE, "AGENTS.md"),
};

/** 將絕對路徑轉為相對 HOME 的顯示路徑 */
export const relToHome = (p) => path.relative(HOME, p).replace(/^/, "~/");

/** 取得 ESM 模組所在目錄（取代 CommonJS __dirname） */
export const getDirname = (importMeta) =>
	path.dirname(fileURLToPath(importMeta.url));

/** 取得專案根目錄（從 libs/<subdir>/ 向上兩層） */
export const getRepoRoot = (importMeta) =>
	path.resolve(getDirname(importMeta), "..", "..");
