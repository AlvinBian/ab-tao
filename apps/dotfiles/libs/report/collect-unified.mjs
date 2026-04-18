/**
 * collect-unified.mjs — 擴充資料收集層（Wave 3 C2）
 *
 * 職責：為 unified-renderer.mjs 的 5 個新 Tab 提供資料：
 *   readHooksDetail()    → Hooks Tab
 *   readStateJson()      → State Tab
 *   detectDrift()        → State Tab（drift 清單）
 *   scanMemoryLayers()   → Memory & Plans Tab
 *   checkCclineStatus()  → Overview 擴充
 *   readMcpConfig()      → MCP & Plugins Tab
 *   collectExtendedData()→ 整合呼叫，回傳全部 extended 資料
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CLAUDE, P } from "../core/paths.mjs";

// ── Hooks ────────────────────────────────────────────────────────

/**
 * 讀取 hooks.json 的詳細資訊
 *
 * @returns {{
 *   hooks: Array<{name: string, event: string, script: string, exists: boolean, executable: boolean}>,
 *   total: number,
 *   healthy: number
 * }}
 */
export function readHooksDetail() {
	let raw = {};
	try {
		raw = JSON.parse(fs.readFileSync(P.hooksJson, "utf8"));
	} catch {
		return { hooks: [], total: 0, healthy: 0 };
	}

	const hooksMap = raw.hooks || {};
	const result = [];

	for (const [event, matchers] of Object.entries(hooksMap)) {
		if (!Array.isArray(matchers)) continue;
		for (const matcher of matchers) {
			const subHooks = Array.isArray(matcher.hooks) ? matcher.hooks : [];
			for (const hook of subHooks) {
				const cmd = hook.command || "";
				// 若命令超長則截短顯示
				const scriptDisplay =
					cmd.length > 120 ? `${cmd.slice(0, 117)}...` : cmd;

				// 嘗試從命令字串中找到腳本路徑
				const scriptPathMatch = cmd.match(
					/(?:node\s+|bash\s+|sh\s+)([^\s;|&"']+\.(?:js|mjs|sh))/,
				);
				let exists = true;
				let executable = true;

				if (scriptPathMatch) {
					const HOME = process.env.HOME || "";
					const scriptPath = scriptPathMatch[1].replace(/^~/, HOME);
					try {
						fs.accessSync(scriptPath, fs.constants.F_OK);
						try {
							fs.accessSync(scriptPath, fs.constants.X_OK);
						} catch {
							executable = false;
						}
					} catch {
						exists = false;
						executable = false;
					}
				}

				result.push({
					name: matcher.description || hook.id || `${event} hook`,
					event,
					script: scriptDisplay,
					exists,
					executable,
				});
			}
		}
	}

	const healthy = result.filter((h) => h.exists && h.executable).length;
	return { hooks: result, total: result.length, healthy };
}

// ── State ────────────────────────────────────────────────────────

/**
 * 讀取 ~/.claude/.ab-tao/state.json 摘要
 *
 * @returns {{
 *   version: string,
 *   managed: Record<string, object>,
 *   choices: Record<string, {decision: string, lockedAt: string}>,
 *   preserve: string[],
 *   forbidden: string[],
 *   sync: { tool: string, included: string[], excluded: string[] }
 * }}
 */
export function readStateJson() {
	try {
		const raw = fs.readFileSync(P.state, "utf8");
		const state = JSON.parse(raw);
		return {
			version: state.version || "1.0.0",
			managed: state.managed || {},
			choices: state.choices || {},
			preserve: state.preserve || [],
			forbidden: state.forbidden || [],
			sync: state.sync || { tool: "ab-tao", included: [], excluded: [] },
		};
	} catch {
		return {
			version: "—",
			managed: {},
			choices: {},
			preserve: [],
			forbidden: [],
			sync: { tool: "ab-tao", included: [], excluded: [] },
		};
	}
}

// ── Drift ────────────────────────────────────────────────────────

/**
 * 偵測 managed 檔案的 drift（sha256 比對）
 *
 * @returns {Array<{path: string, localHash: string|null, templateHash: string, decision: string}>}
 */
export function detectDrift() {
	let state;
	try {
		const raw = fs.readFileSync(P.state, "utf8");
		state = JSON.parse(raw);
	} catch {
		return [];
	}

	const managed = state.managed || {};
	const choices = state.choices || {};
	const results = [];

	for (const [relPath, entry] of Object.entries(managed)) {
		const absPath = path.join(CLAUDE, relPath);
		let localHash = null;

		try {
			const content = fs.readFileSync(absPath);
			localHash = createHash("sha256").update(content).digest("hex");
		} catch {
			// 檔案不存在或無法讀取
		}

		const templateHash = entry.sha256 || "";
		const isDrift =
			localHash === null || (templateHash && localHash !== templateHash);

		if (isDrift) {
			const choice = choices[relPath];
			results.push({
				path: relPath,
				localHash,
				templateHash,
				decision:
					choice?.decision || (localHash === null ? "deleted" : "modified"),
			});
		}
	}

	return results;
}

// ── Memory ───────────────────────────────────────────────────────

/**
 * 掃描 global 及各專案的 memory/plans/tasks 結構
 *
 * @returns {{
 *   global: { memory: string[], plans: string[], tasks: string[] },
 *   projects: Array<{ encoded: string, memory: string[], plans: string[], tasks: string[] }>
 * }}
 */
export function scanMemoryLayers() {
	const readMdFiles = (dir) => {
		try {
			return fs
				.readdirSync(dir)
				.filter((f) => f.endsWith(".md"))
				.sort();
		} catch {
			return [];
		}
	};

	// Global 層
	const globalMemory = readMdFiles(P.memory);
	const globalPlans = readMdFiles(P.plans);
	const globalTasks = readMdFiles(P.tasks);

	// 各專案層
	const projects = [];
	const projectsDir = P.projects;

	try {
		const projectDirs = fs
			.readdirSync(projectsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory());

		for (const dir of projectDirs) {
			const base = path.join(projectsDir, dir.name);
			const projMemory = readMdFiles(path.join(base, "memory"));
			const projPlans = readMdFiles(path.join(base, "plans"));
			const projTasks = readMdFiles(path.join(base, "tasks"));

			// 只收錄有資料的專案
			if (
				projMemory.length > 0 ||
				projPlans.length > 0 ||
				projTasks.length > 0
			) {
				projects.push({
					encoded: dir.name,
					memory: projMemory,
					plans: projPlans,
					tasks: projTasks,
				});
			}
		}
	} catch {
		// projects 目錄不存在則略過
	}

	return {
		global: {
			memory: globalMemory,
			plans: globalPlans,
			tasks: globalTasks,
		},
		projects,
	};
}

// ── CCline ───────────────────────────────────────────────────────

/**
 * 偵測 ccline 狀態
 *
 * @returns {{
 *   installed: boolean,
 *   statusLineConfigured: boolean,
 *   command: string|null,
 *   themes: string[]
 * }}
 */
export function checkCclineStatus() {
	const cclineScript = P.ccline;
	const installed = fs.existsSync(cclineScript);

	// 偵測 themes 目錄
	const themesDir = path.join(path.dirname(cclineScript), "themes");
	let themes = [];
	try {
		themes = fs
			.readdirSync(themesDir)
			.filter((f) => f.endsWith(".toml") || f.endsWith(".sh"))
			.sort();
	} catch {
		// themes 目錄不存在
	}

	// 從 settings.json 讀取 statusLineTool 配置
	let statusLineConfigured = false;
	let command = null;
	try {
		const settings = JSON.parse(fs.readFileSync(P.settings, "utf8"));
		const statusLine = settings.statusLineTool || settings.statusLine;
		if (statusLine) {
			statusLineConfigured = true;
			command = statusLine;
		}
	} catch {
		// settings.json 不存在
	}

	// 若 settings 中無配置，用 script 路徑作為 command
	if (!command && installed) {
		command = cclineScript;
	}

	return { installed, statusLineConfigured, command, themes };
}

// ── MCP ─────────────────────────────────────────────────────────

/**
 * 讀取 MCP 配置（settings.json 的 mcpServers + enabledPlugins）
 *
 * @returns {{
 *   servers: Array<{name: string, type: string, command: string}>,
 *   enabledPlugins: string[]
 * }}
 */
export function readMcpConfig() {
	let settings = {};
	try {
		settings = JSON.parse(fs.readFileSync(P.settings, "utf8"));
	} catch {
		return { servers: [], enabledPlugins: [] };
	}

	// MCP Servers
	const mcpServers = settings.mcpServers || {};
	const servers = Object.entries(mcpServers).map(([name, cfg]) => {
		const type = cfg.type || (cfg.url ? "sse" : "stdio");
		let command = "";
		if (cfg.command) {
			const args = Array.isArray(cfg.args)
				? cfg.args
						.filter((a) => !String(a).startsWith("-"))
						.slice(0, 2)
						.join(" ")
				: "";
			command = args ? `${cfg.command} ${args}` : cfg.command;
		} else if (cfg.url) {
			command = cfg.url;
		}
		return { name, type, command };
	});

	// enabledPlugins 物件的 key = plugin name，value = true/false
	const enabledPluginsMap = settings.enabledPlugins || {};
	const enabledPlugins = Object.entries(enabledPluginsMap)
		.filter(([, enabled]) => enabled === true)
		.map(([name]) => name);

	return { servers, enabledPlugins };
}

// ── 整合呼叫 ─────────────────────────────────────────────────────

/**
 * 整合呼叫：收集全部擴充資料，供 unified-renderer.mjs 的 extended 欄位使用
 *
 * @returns {{
 *   hooks: ReturnType<typeof readHooksDetail>,
 *   state: ReturnType<typeof readStateJson>,
 *   drift: ReturnType<typeof detectDrift>,
 *   memory: ReturnType<typeof scanMemoryLayers>,
 *   ccline: ReturnType<typeof checkCclineStatus>,
 *   mcp: ReturnType<typeof readMcpConfig>
 * }}
 */
export function collectExtendedData() {
	return {
		hooks: readHooksDetail(),
		state: readStateJson(),
		drift: detectDrift(),
		memory: scanMemoryLayers(),
		ccline: checkCclineStatus(),
		mcp: readMcpConfig(),
	};
}
