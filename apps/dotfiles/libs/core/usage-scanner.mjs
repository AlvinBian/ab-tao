/**
 * 使用情況掃描器 — 從 Claude session JSONL 提取 command/agent 使用統計
 *
 * 掃描各 repo 的 .claude/ 下所有 .jsonl 檔案（排除 subagents/），
 * 只統計 human 角色的訊息，提取 /command 和 @agent 調用。
 */

import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { isEmpty } from "lodash-es";
import { HOME } from "./paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PROJECTS_DIR = path.join(HOME, ".claude", "projects");

/**
 * 掃描所有 JSONL session 檔案，提取使用統計
 *
 * @returns {Promise<{
 *   commands: Map<string, { count: number, lastUsed: string|null }>,
 *   agents: Map<string, { count: number, lastUsed: string|null }>,
 *   sessions: { total: number, byProject: Map<string, number>, dailyCounts: Map<string, number> }
 * }>}
 */
export async function scanUsage(installedAgentNames = null) {
	const commands = new Map();
	const agents = new Map();
	const sessions = { total: 0, byProject: new Map(), dailyCounts: new Map() };

	// 已安裝的 agent 名稱集合（過濾 @babel/@storybook 等誤判）
	const agentFilter = installedAgentNames ? new Set(installedAgentNames) : null;

	if (!fs.existsSync(PROJECTS_DIR)) return { commands, agents, sessions };

	const projectDirs = fs
		.readdirSync(PROJECTS_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory());

	// 收集所有 JSONL 路徑，並行掃描（JS 單執行緒安全，Map 操作無競爭）
	const allJsonlTasks = [];
	for (const projectDir of projectDirs) {
		const projectPath = path.join(PROJECTS_DIR, projectDir.name);
		const jsonlFiles = fs
			.readdirSync(projectPath)
			.filter((f) => f.endsWith(".jsonl") && !f.includes("subagent"));

		sessions.byProject.set(projectDir.name, jsonlFiles.length);
		sessions.total += jsonlFiles.length;

		for (const file of jsonlFiles) {
			allJsonlTasks.push(
				scanJsonlFile(
					path.join(projectPath, file),
					commands,
					agents,
					sessions,
					agentFilter,
				),
			);
		}
	}
	await Promise.all(allJsonlTasks);

	return { commands, agents, sessions };
}

/**
 * 逐行讀取 JSONL 檔案，提取 /command 和 @agent
 */
async function scanJsonlFile(
	filePath,
	commands,
	agents,
	sessions,
	agentFilter,
) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: fs.createReadStream(filePath, { encoding: "utf8" }),
			crlfDelay: Infinity,
		});

		rl.on("line", (line) => {
			try {
				const obj = JSON.parse(line);
				// 只統計 human 訊息
				const role = obj.message?.role || obj.role || "";
				if (role !== "human") return;

				const timestamp = obj.timestamp || obj.message?.timestamp || null;
				if (timestamp) {
					const day = timestamp.slice(0, 10); // YYYY-MM-DD
					sessions.dailyCounts.set(
						day,
						(sessions.dailyCounts.get(day) || 0) + 1,
					);
				}

				// 提取訊息文字
				const texts = extractTexts(obj);
				for (const text of texts) {
					// /command 調用（行首或訊息開頭）
					const cmdMatches = text.match(/(?:^|\n)\s*\/([a-z][-a-z0-9]*)/g);
					if (cmdMatches) {
						for (const m of cmdMatches) {
							const name = m.replace(/^[\s\n]*\//, "");
							const entry = commands.get(name) || { count: 0, lastUsed: null };
							entry.count++;
							if (timestamp && (!entry.lastUsed || timestamp > entry.lastUsed))
								entry.lastUsed = timestamp;
							commands.set(name, entry);
						}
					}

					// @agent 調用（只統計已安裝的 agent，避免 @babel/@storybook 誤判）
					const agentMatches = text.match(/@([a-z][-a-z0-9]*)/g);
					if (agentMatches) {
						for (const m of agentMatches) {
							const name = m.slice(1);
							if (agentFilter && !agentFilter.has(name)) continue;
							const entry = agents.get(name) || { count: 0, lastUsed: null };
							entry.count++;
							if (timestamp && (!entry.lastUsed || timestamp > entry.lastUsed))
								entry.lastUsed = timestamp;
							agents.set(name, entry);
						}
					}
				}
			} catch {
				/* skip malformed lines */
			}
		});

		rl.on("close", resolve);
		rl.on("error", () => {
			rl.close();
			resolve();
		});
	});
}

/**
 * 從 JSONL 物件中提取所有文字內容
 */
function extractTexts(obj) {
	const texts = [];
	const content = obj.message?.content || obj.content;
	if (typeof content === "string") {
		texts.push(content);
	} else if (Array.isArray(content)) {
		for (const item of content) {
			if (typeof item === "string") texts.push(item);
			else if (item?.text) texts.push(item.text);
		}
	}
	return texts;
}

/**
 * 收集完整的配置狀態 + 使用數據（供 HTML 報告和終端展示）
 */
export async function collectFullStatus() {
	const { getConfigStatus } = await import("./config-status.mjs");
	const { ALL_COMMANDS, ALL_AGENTS, ALL_RULES } = await import(
		"../config/config-classifier.mjs"
	);

	const configStatus = getConfigStatus();

	// 已安裝的 commands/agents/rules
	const CLAUDE_DIR = path.join(HOME, ".claude");
	const installed = {
		commands: safeReadDir(path.join(CLAUDE_DIR, "commands"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(".md", "")),
		agents: safeReadDir(path.join(CLAUDE_DIR, "agents"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(".md", "")),
		rules: safeReadDir(path.join(CLAUDE_DIR, "rules"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(".md", "")),
		disabledRules: safeReadDir(path.join(CLAUDE_DIR, "rules"))
			.filter((f) => f.endsWith(".md.disabled"))
			.map((f) => f.replace(".md.disabled", "")),
	};

	const usage = await scanUsage(installed.agents);

	// ECC 資源（從 @ab-tao/commons 讀取）
	const { ECC_DIR: aiResDir } = await import("@ab-tao/commons/paths");
	const extRes = {
		commands: safeReadDir(path.join(aiResDir, "commands"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(".md", "")),
		agents: safeReadDir(path.join(aiResDir, "agents"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(".md", "")),
		rules: safeReadDir(path.join(aiResDir, "rules"))
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(".md", "")),
	};

	// 分類每個 command/agent/rule 的來源
	const classify = (name, allManaged, extList) => {
		if (allManaged.includes(name)) return "core";
		if (extList.includes(name)) return "ext";
		return "user";
	};

	const commandsDetail = installed.commands
		.map((name) => ({
			name,
			source: classify(name, ALL_COMMANDS, extRes.commands),
			count: usage.commands.get(name)?.count || 0,
			lastUsed: usage.commands.get(name)?.lastUsed || null,
		}))
		.sort((a, b) => b.count - a.count);

	const agentsDetail = installed.agents
		.map((name) => ({
			name,
			source: classify(name, ALL_AGENTS, extRes.agents),
			count: usage.agents.get(name)?.count || 0,
			lastUsed: usage.agents.get(name)?.lastUsed || null,
		}))
		.sort((a, b) => b.count - a.count);

	const rulesDetail = installed.rules
		.map((name) => ({
			name,
			source: classify(name, ALL_RULES, extRes.rules),
			enabled: true,
		}))
		.concat(
			installed.disabledRules.map((name) => ({
				name,
				source: classify(name, ALL_RULES, extRes.rules),
				enabled: false,
			})),
		);

	// Hooks
	const hooksPath = path.join(CLAUDE_DIR, "hooks.json");
	let hooks = {};
	try {
		hooks = JSON.parse(fs.readFileSync(hooksPath, "utf8")).hooks || {};
	} catch {
		/* hooks.json 不存在則略過 */
	}
	const hooksDetail = Object.entries(hooks).map(([event, matchers]) => ({
		event,
		subHooks: Array.isArray(matchers)
			? matchers.reduce((sum, m) => sum + (m.hooks?.length || 0), 0)
			: 0,
	}));

	// Permissions
	const settingsPath = path.join(CLAUDE_DIR, "settings.json");
	let permissions = { allow: [], deny: [] };
	try {
		const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
		permissions = {
			allow: settings.permissions?.allow || [],
			deny: settings.permissions?.deny || [],
		};
	} catch {
		/* settings.json 不存在則略過 */
	}

	// settings.template 的 permissions（用來判斷來源）
	const templateSettingsPath = path.join(
		REPO_ROOT,
		"claude",
		"settings.template.json",
	);
	let templatePermissions = [];
	try {
		const tpl = JSON.parse(fs.readFileSync(templateSettingsPath, "utf8"));
		templatePermissions = tpl.permissions?.allow || [];
	} catch {
		/* settings.template.json 不存在則略過 */
	}

	// CLAUDE.md 項目
	const projectsDir = path.join(CLAUDE_DIR, "projects");
	const claudeMdProjects = [];
	if (fs.existsSync(projectsDir)) {
		const walkProjects = (dir, depth = 0) => {
			if (depth > 5) return;
			try {
				for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
					if (entry.isDirectory())
						walkProjects(path.join(dir, entry.name), depth + 1);
					else if (entry.name === "CLAUDE.md") {
						const stat = fs.statSync(path.join(dir, entry.name));
						claudeMdProjects.push({
							path: dir.replace(HOME, "~"),
							mtime: stat.mtime.toISOString(),
						});
					}
				}
			} catch {
				/* 目錄讀取失敗則略過 */
			}
		};
		walkProjects(projectsDir);
	}

	// Plugin 構建狀態（dist/release/*.plugin）
	const distDir = path.join(REPO_ROOT, "dist");
	const plugins = [];
	const releaseDir = path.join(distDir, "release");
	if (fs.existsSync(releaseDir)) {
		for (const f of fs.readdirSync(releaseDir)) {
			if (f.endsWith(".plugin")) {
				const stat = fs.statSync(path.join(releaseDir, f));
				plugins.push({ name: f, mtime: stat.mtime.toISOString() });
			}
		}
	}

	// 已安裝的 Claude plugins（claude plugin list --json）
	let installedPlugins = null;
	try {
		const out = execFileSync("claude", ["plugin", "list", "--json"], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 10000,
		});
		installedPlugins = JSON.parse(out.toString()).map((pl) => ({
			name: pl.name,
			version: pl.version || "",
			repo: pl.repo || "",
		}));
	} catch {
		// claude CLI 不可用或不支援 --json，installedPlugins 保持 null
	}

	// 備份
	const backupDir = path.join(distDir, "backup");
	const backups = [];
	if (fs.existsSync(backupDir)) {
		for (const d of fs.readdirSync(backupDir, { withFileTypes: true })) {
			if (d.isDirectory()) backups.push(d.name);
		}
	}

	// 磁碟佔用（並行執行）
	const [cacheSize, distSize, claudeSize] = await Promise.all([
		dirSizeAsync(path.join(REPO_ROOT, ".cache")),
		dirSizeAsync(distDir),
		dirSizeAsync(PROJECTS_DIR),
	]);
	const diskUsage = {
		cache: cacheSize,
		dist: distSize,
		claudeProjects: claudeSize,
	};

	// 環境變數健康檢查
	const envTemplatePath = path.join(REPO_ROOT, ".env.template");
	const envPath = path.join(REPO_ROOT, ".env");
	const envHealth = { missing: [], extra: [], empty: [] };
	try {
		const templateVars = parseEnvKeys(fs.readFileSync(envTemplatePath, "utf8"));
		const envVars = fs.existsSync(envPath)
			? parseEnvFile(fs.readFileSync(envPath, "utf8"))
			: new Map();
		for (const key of templateVars) {
			if (!envVars.has(key)) envHealth.missing.push(key);
			else if (envVars.get(key) === "") envHealth.empty.push(key);
		}
		for (const key of envVars.keys()) {
			if (!templateVars.has(key)) envHealth.extra.push(key);
		}
	} catch {
		/* .env 或 template 不存在則略過 */
	}

	// ZSH 模組
	const zshModulesDir = path.join(REPO_ROOT, "zsh", "modules");
	const zshInstalled = safeReadDir(path.join(HOME, ".zsh", "modules"))
		.filter((f) => f.endsWith(".zsh"))
		.map((f) => f.replace(".zsh", ""));
	const zshAvailable = safeReadDir(zshModulesDir)
		.filter((f) => f.endsWith(".zsh"))
		.map((f) => f.replace(".zsh", ""));

	// AI 設定
	const { env: envFn } = await import("./env.mjs");
	const ai = {
		model: envFn("AI_MODEL", "haiku"),
		effort: envFn("AI_EFFORT", "low"),
		repoModel: envFn("AI_REPO_MODEL", "sonnet"),
	};

	// 計算使用率
	const usedCommands = commandsDetail.filter((c) => c.count > 0).length;
	const usedAgents = agentsDetail.filter((a) => a.count > 0).length;
	const totalInstalled =
		installed.commands.length +
		installed.agents.length +
		installed.rules.length;
	const totalUsed = usedCommands + usedAgents + installed.rules.length; // rules 算全部使用

	return {
		overview: {
			healthPct: configStatus.summary.pct,
			totalInstalled,
			totalUsed,
			commandUsageRate: !isEmpty(installed.commands)
				? Math.round((usedCommands / installed.commands.length) * 100)
				: 0,
			agentUsageRate: !isEmpty(installed.agents)
				? Math.round((usedAgents / installed.agents.length) * 100)
				: 0,
		},
		commands: commandsDetail,
		agents: agentsDetail,
		rules: rulesDetail,
		hooks: hooksDetail,
		zsh: { installed: zshInstalled, available: zshAvailable },
		ai,
		permissions: {
			allow: permissions.allow,
			deny: permissions.deny,
			templateAllow: templatePermissions,
		},
		claudeMd: claudeMdProjects,
		plugins,
		installedPlugins,
		backups,
		diskUsage,
		envHealth,
		sessions: usage.sessions,
		aiRes: extRes,
		configStatus,
	};
}

/**
 * 掃描 skills 目錄，列出已安裝的 skill 清單
 *
 * @param {string} skillsDir - skills 根目錄（通常為 ~/.claude/skills）
 * @returns {Array<{ name: string, source: string, enabled: boolean, path: string }>}
 */
export function scanSkills(skillsDir) {
	const skills = [];
	if (!fs.existsSync(skillsDir)) return skills;

	function parseSource(filePath) {
		try {
			const head = fs.readFileSync(filePath, "utf8").slice(0, 200);
			const m = head.match(/<!--\s*generated by ab-tao(?:::([^\s>]+))?\s*-->/);
			if (m) return m[1] || "ab-tao";
		} catch {
			/* 讀取失敗則略過 */
		}
		return "unknown";
	}

	function walk(dir, depth) {
		if (depth > 3) return;
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const sub = path.join(dir, entry.name);
			const skillMd = path.join(sub, "SKILL.md");
			const skillMdDisabled = path.join(sub, "SKILL.md.disabled");
			const hasSkill = fs.existsSync(skillMd);
			const hasDisabled = fs.existsSync(skillMdDisabled);

			if (hasSkill || hasDisabled) {
				const markerFile = hasSkill ? skillMd : skillMdDisabled;
				const source = parseSource(markerFile);
				skills.push({
					name: entry.name,
					source,
					enabled: hasSkill,
					path: path.relative(skillsDir, sub),
				});
			} else {
				walk(sub, depth + 1);
			}
		}
	}

	walk(skillsDir, 0);
	return skills;
}

/**
 * 收集統一報告資料：合併即時掃描資料（live）與 session 快取（repos、techStacks）
 *
 * live 資料每次呼叫都重新掃描；快取來自 d:setup 完成後寫入的 last-report-data.json。
 *
 * @returns {Promise<object>}
 */
export async function collectUnifiedReportData() {
	// 1. 即時資料
	const live = await collectFullStatus();

	// 加入 skills（即時掃描）
	const skillsDir = path.join(HOME, ".claude", "skills");
	live.skills = scanSkills(skillsDir);

	// 2. Session 快取（由 setup.mjs 在 d:setup 完成後寫入）
	const CACHE_DIR = path.join(HOME, ".claude", ".cache");
	let cached = {};
	try {
		const cacheFile = path.join(CACHE_DIR, "last-report-data.json");
		cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
	} catch {
		/* 無快取則略過 */
	}

	return {
		...live,
		// session 快取欄位（repos、techStacks 來自上次 d:setup）
		cachedRepos: cached.repos || [],
		cachedTechStacks: cached.techStacks || {},
		cachedTimestamp: cached.timestamp || null,
		// skills 永遠使用即時掃描結果
		skills: live.skills,
	};
}

// ── 工具函式 ──

function safeReadDir(dir) {
	try {
		return fs.readdirSync(dir);
	} catch {
		return [];
	}
}

function _dirSize(dir) {
	try {
		if (!fs.existsSync(dir)) return 0;
		const output = execFileSync("du", ["-sk", dir], {
			encoding: "utf8",
			timeout: 5000,
		}).trim();
		return parseInt(output.split("\t")[0], 10) * 1024;
	} catch {
		return 0;
	}
}

function dirSizeAsync(dir) {
	return new Promise((resolve) => {
		if (!fs.existsSync(dir)) return resolve(0);
		execFile(
			"du",
			["-sk", dir],
			{ encoding: "utf8", timeout: 5000 },
			(err, stdout) => {
				if (err) return resolve(0);
				resolve(parseInt(stdout.trim().split("\t")[0], 10) * 1024);
			},
		);
	});
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function parseEnvKeys(content) {
	const keys = new Set();
	for (const line of content.split("\n")) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=/);
		if (m) keys.add(m[1]);
	}
	return keys;
}

/**
 * 將 Claude 專案路徑轉為可讀名稱
 * -Users-alvin-Documents-MyProjects-ab-dotfiles → Documents/MyProjects/ab-dotfiles
 *
 * Claude 編碼規則：把實際路徑的 / 替換為 -
 * 難點：項目名本身可能含 -（如 kkday-b2c-web）
 * 策略：嘗試匹配已知的 HOME 前綴，然後逐段還原
 */
export function humanizeProjectPath(encoded) {
	const home = HOME;
	// 把 HOME 的每一段作為前綴匹配
	const homeParts = home.split("/").filter(Boolean); // ['Users', 'alvin']
	let remaining = encoded.startsWith("-") ? encoded.slice(1) : encoded;

	// 逐段消耗 HOME 前綴
	for (const part of homeParts) {
		if (remaining.startsWith(`${part}-`)) {
			remaining = remaining.slice(part.length + 1);
		} else if (remaining.startsWith(part)) {
			remaining = remaining.slice(part.length);
			break;
		} else break;
	}
	if (!remaining || remaining === "-") return "~";
	if (remaining.startsWith("-")) remaining = remaining.slice(1);

	// 嘗試用真實檔案系統驗證路徑段
	// 從 HOME 開始逐段匹配最長的目錄名
	const parts = [];
	let current = home;
	let rest = remaining;

	while (rest) {
		let matched = false;
		// 嘗試從最長到最短的前綴匹配
		const segments = rest.split("-");
		for (let len = segments.length; len >= 1; len--) {
			const candidate = segments.slice(0, len).join("-");
			const testPath = path.join(current, candidate);
			try {
				const stat = fs.statSync(testPath);
				if (stat.isDirectory() || stat.isFile()) {
					parts.push(candidate);
					current = testPath;
					rest = segments.slice(len).join("-");
					if (rest.startsWith("-")) rest = rest.slice(1); // 不應該發生，但防禦
					matched = true;
					break;
				}
			} catch {
				/* 路徑 stat 失敗則略過此候選段 */
			}
		}
		if (!matched) {
			// 無法匹配，把剩餘部分作為最後一段
			if (rest) parts.push(rest);
			break;
		}
	}

	return parts.join("/") || "~";
}

function parseEnvFile(content) {
	const map = new Map();
	for (const line of content.split("\n")) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (m) map.set(m[1], m[2]);
	}
	return map;
}

/**
 * 掃描使用統計（30天內最後使用時間、調用次數等）
 *
 * @returns {Promise<Map<string, {
 *   name: string,
 *   type: 'command' | 'agent',
 *   callCount: number,
 *   lastUsed: string|null,
 *   firstUsed: string|null,
 *   stale: boolean
 * }>>}
 */
export async function scanUsageStats() {
	const stats = new Map();
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

	if (!fs.existsSync(PROJECTS_DIR)) return stats;

	const projectDirs = fs
		.readdirSync(PROJECTS_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory());

	// 收集所有路徑並行掃描
	const allStatsTasks = [];
	for (const projectDir of projectDirs) {
		const projectPath = path.join(PROJECTS_DIR, projectDir.name);
		const jsonlFiles = fs
			.readdirSync(projectPath)
			.filter((f) => f.endsWith(".jsonl") && !f.includes("subagent"));

		for (const file of jsonlFiles) {
			allStatsTasks.push(
				scanJsonlFileForStats(path.join(projectPath, file), stats),
			);
		}
	}
	await Promise.all(allStatsTasks);

	// 標記 stale 項目（30天未使用）
	for (const item of stats.values()) {
		if (item.lastUsed && item.lastUsed < thirtyDaysAgoStr) {
			item.stale = true;
		}
	}

	return stats;
}

/**
 * 逐行讀取 JSONL 檔案，提取使用統計
 * 若檔案超過 5MB，只讀最後 1000 行
 */
async function scanJsonlFileForStats(filePath, stats) {
	try {
		const stat = fs.statSync(filePath);
		const fileSizeBytes = stat.size;
		const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

		let input;

		if (fileSizeBytes > MAX_FILE_SIZE) {
			// 檔案太大，只讀最後 1000 行（async 讀取避免阻塞 event loop）
			const fileContent = await fs.promises.readFile(filePath, "utf8");
			const allLines = fileContent.split("\n");
			const linesToProcess = allLines.slice(
				Math.max(0, allLines.length - 1000),
			);
			input = Readable.from(linesToProcess);
		} else {
			input = fs.createReadStream(filePath, { encoding: "utf8" });
		}

		await new Promise((resolve) => {
			const rl = readline.createInterface({
				input,
				crlfDelay: Infinity,
			});

			rl.on("line", (line) => {
				if (!line.trim()) return;
				try {
					const obj = JSON.parse(line);
					const role = obj.message?.role || obj.role || "";
					if (role !== "human") return;

					const timestamp = obj.timestamp || obj.message?.timestamp || null;
					if (!timestamp) return;

					const texts = extractTexts(obj);
					for (const text of texts) {
						// /command 調用
						const cmdMatches = text.match(/(?:^|\n)\s*\/([a-z][-a-z0-9]*)/g);
						if (cmdMatches) {
							for (const m of cmdMatches) {
								const name = m.replace(/^[\s\n]*\//, "");
								const key = `cmd:${name}`;
								if (!stats.has(key)) {
									stats.set(key, {
										name,
										type: "command",
										callCount: 0,
										lastUsed: null,
										firstUsed: null,
										stale: false,
									});
								}
								const entry = stats.get(key);
								entry.callCount++;
								if (!entry.lastUsed || timestamp > entry.lastUsed)
									entry.lastUsed = timestamp;
								if (!entry.firstUsed || timestamp < entry.firstUsed)
									entry.firstUsed = timestamp;
							}
						}

						// @agent 調用
						const agentMatches = text.match(/@([a-z][-a-z0-9]*)/g);
						if (agentMatches) {
							for (const m of agentMatches) {
								const name = m.slice(1);
								const key = `agent:${name}`;
								if (!stats.has(key)) {
									stats.set(key, {
										name,
										type: "agent",
										callCount: 0,
										lastUsed: null,
										firstUsed: null,
										stale: false,
									});
								}
								const entry = stats.get(key);
								entry.callCount++;
								if (!entry.lastUsed || timestamp > entry.lastUsed)
									entry.lastUsed = timestamp;
								if (!entry.firstUsed || timestamp < entry.firstUsed)
									entry.firstUsed = timestamp;
							}
						}
					}
				} catch {
					/* skip malformed lines */
				}
			});

			rl.on("close", resolve);
			rl.on("error", () => {
				rl.close();
				resolve();
			});
		});
	} catch {
		/* 檔案讀取失敗（可能已被刪除），略過 */
	}
}

/**
 * 估算清理項目的 token 節省量
 * - commands：每個描述約 100 token
 * - agents：每個描述約 200 token
 *
 * @param {Array<{ type: 'command' | 'agent', name: string }>} items 要清理的項目
 * @returns {{ tokens: number, kb: number }}
 */
export function estimateTokenSavings(items) {
	let tokenCount = 0;
	for (const item of items) {
		if (item.type === "command") {
			tokenCount += 100;
		} else if (item.type === "agent") {
			tokenCount += 200;
		}
	}
	// 粗略估算：1 token ≈ 4 bytes
	const bytes = tokenCount * 4;
	const kb = bytes / 1024;
	return { tokens: tokenCount, kb: Math.round(kb * 100) / 100 };
}

export { formatBytes };
