/**
 * collect-unified.mjs — 統一資料收集器
 *
 * 職責：為 Wave 3 report.html 的新 Tab 提供額外的資料源。
 * 收集：hooks 詳情、state.json 狀態與漂移偵測、memory 分層、MCP 設定、ccline 狀態。
 *
 * 匯出：collectExtendedData() — 同步函式，回傳所有新增欄位。
 * 注意：此模組為純 sync，不依賴非同步 I/O。
 *
 * Requires: Node.js 18+
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CLAUDE, HOME } from "../core/paths.mjs";

// CLAUDE_HOME = ~/.claude/
const CLAUDE_HOME = CLAUDE;

// ── 工具函式 ────────────────────────────────────────────────────

/**
 * 遞迴計算目錄下的檔案數量
 * @param {string} dir
 * @returns {number}
 */
function countFilesRecursive(dir) {
	let count = 0;
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isFile()) {
				count++;
			} else if (entry.isDirectory()) {
				count += countFilesRecursive(path.join(dir, entry.name));
			}
		}
	} catch {
		/* 目錄不可讀則略過 */
	}
	return count;
}

// ── Collector 函式 ──────────────────────────────────────────────

/**
 * 讀取 hooks 詳情
 *
 * 從 ~/.claude/hooks.json 解析所有 hook 事件，
 * 並檢查每個 hook 的腳本是否存在及可執行。
 *
 * @returns {{
 *   status: 'ok' | 'missing',
 *   hooks: Record<string, Array<object>>,
 *   count: number
 * }}
 */
function readHooksDetail() {
	const hooksJsonPath = path.join(CLAUDE_HOME, "hooks.json");
	try {
		const raw = JSON.parse(fs.readFileSync(hooksJsonPath, "utf8"));
		// hooks.json 頂層結構：{ "$schema": ..., "hooks": { EventName: [...] } }
		const hooksMap = raw.hooks || raw;
		const detail = {};
		for (const [event, hookList] of Object.entries(hooksMap)) {
			if (!Array.isArray(hookList)) continue;
			detail[event] = hookList.map((matcher) => {
				// 每個 matcher 下可能有多個 hooks 子項
				const subHooks = Array.isArray(matcher.hooks) ? matcher.hooks : [];
				const enrichedSubs = subHooks.map((hook) => {
					// 取得指令的第一段（可能是完整路徑或 node/sh 指令）
					const cmdFirst = hook.command ? hook.command.split(" ")[0] : null;
					const scriptExists = cmdFirst ? fs.existsSync(cmdFirst) : false;
					return {
						...hook,
						scriptExists,
					};
				});
				return {
					...matcher,
					hooks: enrichedSubs,
				};
			});
		}
		const count = Object.values(detail)
			.flat()
			.reduce((s, m) => s + (Array.isArray(m.hooks) ? m.hooks.length : 0), 0);
		return { status: "ok", hooks: detail, count };
	} catch {
		return { status: "missing", hooks: {}, count: 0 };
	}
}

/**
 * 讀取 ~/.claude/.ab-tao/state.json
 *
 * @returns {{ status: 'ok' | 'missing', data: object }}
 */
function readStateJson() {
	const statePath = path.join(CLAUDE_HOME, ".ab-tao", "state.json");
	try {
		return {
			status: "ok",
			data: JSON.parse(fs.readFileSync(statePath, "utf8")),
		};
	} catch {
		return { status: "missing", data: {} };
	}
}

/**
 * 偵測 managed 檔案的 sha256 漂移
 *
 * 比較 state.json managed 區塊中記錄的 sha256
 * 與當前檔案實際計算出的 sha256，找出差異。
 *
 * @returns {{
 *   driftedFiles: Array<{ path: string, reason?: string, expectedSha?: string, actualSha?: string }>,
 *   count: number
 * }}
 */
function detectDrift() {
	const state = readStateJson();
	if (state.status !== "ok" || !state.data.managed) {
		return { driftedFiles: [], count: 0 };
	}

	const drifted = [];
	for (const [relPath, info] of Object.entries(state.data.managed)) {
		const fullPath = path.join(CLAUDE_HOME, relPath);
		if (!fs.existsSync(fullPath)) {
			drifted.push({ path: relPath, reason: "missing" });
			continue;
		}
		// 只在 state 有記錄 sha256 時才比對
		if (!info.sha256) continue;
		try {
			const content = fs.readFileSync(fullPath);
			const sha = crypto.createHash("sha256").update(content).digest("hex");
			if (sha !== info.sha256) {
				drifted.push({
					path: relPath,
					expectedSha: info.sha256.slice(0, 8),
					actualSha: sha.slice(0, 8),
				});
			}
		} catch {
			drifted.push({ path: relPath, reason: "unreadable" });
		}
	}
	return { driftedFiles: drifted, count: drifted.length };
}

/**
 * 掃描 memory 分層結構
 *
 * 包含全域 memory（~/.claude/memory/）
 * 以及 projects/ 下每個專案的 memory/plans/tasks 目錄狀態。
 *
 * @returns {{
 *   global: { exists: boolean, fileCount: number },
 *   projects: Array<{ encoded: string, hasMemory: boolean, hasPlans: boolean, hasTasks: boolean }>
 * }}
 */
function scanMemoryLayers() {
	const globalMemory = path.join(CLAUDE_HOME, "memory");
	const projectsDir = path.join(CLAUDE_HOME, "projects");

	const globalExists = fs.existsSync(globalMemory);
	const projects = [];

	if (fs.existsSync(projectsDir)) {
		let entries;
		try {
			entries = fs.readdirSync(projectsDir, { withFileTypes: true });
		} catch {
			entries = [];
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const enc = entry.name;
			const base = path.join(projectsDir, enc);
			projects.push({
				encoded: enc,
				hasMemory: fs.existsSync(path.join(base, "memory")),
				hasPlans: fs.existsSync(path.join(base, "plans")),
				hasTasks: fs.existsSync(path.join(base, "tasks")),
			});
		}
	}

	return {
		global: {
			exists: globalExists,
			fileCount: globalExists ? countFilesRecursive(globalMemory) : 0,
		},
		projects,
	};
}

/**
 * 檢查 ccline 狀態
 *
 * 從 ~/.claude/settings.json 讀取 statusLine 配置，
 * 判斷腳本是否存在及已啟用。
 *
 * @returns {{
 *   enabled: boolean,
 *   command: string | null,
 *   scriptExists: boolean,
 *   status: 'ok' | 'degraded' | 'missing'
 * }}
 */
function checkCclineStatus() {
	const settingsPath = path.join(CLAUDE_HOME, "settings.json");
	try {
		const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
		const statusLine = settings?.statusLine;
		const command = statusLine?.command || null;
		// 展開 ~ 為實際 HOME 路徑
		const scriptExists = command
			? fs.existsSync(command.replace(/^~/, HOME))
			: false;
		const enabled = statusLine?.enabled !== false && Boolean(command);
		return {
			enabled,
			command,
			scriptExists,
			status: scriptExists && enabled ? "ok" : "degraded",
		};
	} catch {
		return {
			enabled: false,
			command: null,
			scriptExists: false,
			status: "missing",
		};
	}
}

/**
 * 讀取 MCP 設定
 *
 * 嘗試從 ~/.claude/mcp.yml 讀取（若存在），
 * 否則從 settings.json 的 mcpServers 欄位讀取。
 *
 * @returns {{
 *   status: 'ok' | 'settings' | 'missing',
 *   path?: string,
 *   raw?: string,
 *   servers?: string[]
 * }}
 */
function readMcpConfig() {
	const mcpPath = path.join(CLAUDE_HOME, "mcp.yml");
	// 嘗試讀取 mcp.yml
	if (fs.existsSync(mcpPath)) {
		try {
			const raw = fs.readFileSync(mcpPath, "utf8");
			return { status: "ok", path: mcpPath, raw };
		} catch {
			/* 讀取失敗則嘗試 settings.json */
		}
	}
	// 退回到 settings.json 的 mcpServers 欄位
	try {
		const settings = JSON.parse(
			fs.readFileSync(path.join(CLAUDE_HOME, "settings.json"), "utf8"),
		);
		const servers = Object.keys(settings?.mcpServers || {});
		return { status: "settings", servers };
	} catch {
		return { status: "missing", servers: [] };
	}
}

// ── 主要匯出函式 ────────────────────────────────────────────────

/**
 * 收集擴充資料（供 Wave 3 report.html 新 Tab 使用）
 *
 * 所有 collector 均為 sync，不影響 async 呼叫端。
 * 呼叫端（collectUnifiedReportData）可將此結果以 spread 方式合併至主資料物件。
 *
 * @returns {{
 *   hooksDetail: ReturnType<typeof readHooksDetail>,
 *   state: ReturnType<typeof readStateJson>,
 *   drift: ReturnType<typeof detectDrift>,
 *   memory: ReturnType<typeof scanMemoryLayers>,
 *   mcp: ReturnType<typeof readMcpConfig>,
 *   ccline: ReturnType<typeof checkCclineStatus>
 * }}
 */
export function collectExtendedData() {
	return {
		hooksDetail: readHooksDetail(),
		state: readStateJson(),
		drift: detectDrift(),
		memory: scanMemoryLayers(),
		mcp: readMcpConfig(),
		ccline: checkCclineStatus(),
	};
}

// 個別匯出，供需要單獨使用的模組引用
export {
	checkCclineStatus,
	countFilesRecursive,
	detectDrift,
	readHooksDetail,
	readMcpConfig,
	readStateJson,
	scanMemoryLayers,
};
