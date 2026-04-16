/**
 * claude-mem 安裝檢驗與狀態查詢
 *
 * claude-mem 是 Claude Code 的持久記憶管理工具
 * 安裝：npx claude-mem install
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HOME } from "../core/paths.mjs";

const MEM_BIN = "claude-mem";
const MEM_HEALTH_PORT = 37777;
const MEM_HEALTH_URL = `http://localhost:${MEM_HEALTH_PORT}/health`;
const MEMORY_DIR = path.join(HOME, ".claude", "projects");

/**
 * 檢查 claude-mem 是否已安裝
 * @returns {boolean}
 */
export function isClaudeMemInstalled() {
	const result = spawnSync("which", [MEM_BIN], { stdio: "ignore" });
	return result.status === 0;
}

/**
 * 取得 claude-mem 版本號
 * @returns {string|null}
 */
export function getClaudeMemVersion() {
	if (!isClaudeMemInstalled()) return null;
	try {
		const output = execFileSync(MEM_BIN, ["--version"], {
			stdio: "pipe",
			encoding: "utf8",
		});
		const match = output.match(/[\d.]+/);
		return match ? match[0] : null;
	} catch {
		return null;
	}
}

/**
 * 檢查 claude-mem worker 是否正在執行（curl localhost:37777/health）
 * @returns {boolean}
 */
export function isWorkerRunning() {
	const result = spawnSync(
		"curl",
		[
			"-sf",
			"-o",
			"/dev/null",
			"-w",
			"%{http_code}",
			"--max-time",
			"1",
			MEM_HEALTH_URL,
		],
		{ stdio: "pipe", encoding: "utf8" },
	);
	return result.status === 0 && result.stdout === "200";
}

/**
 * 使用 npx 安裝 claude-mem
 * @returns {boolean}
 */
export function installClaudeMem() {
	const result = spawnSync("npx", ["claude-mem", "install"], {
		stdio: "inherit",
		shell: false,
	});
	return result.status === 0;
}

/**
 * 檢查 claude-mem 是否已安裝，未安裝則自動安裝
 * @returns {{ installed: boolean, alreadyInstalled: boolean }}
 */
export function checkAndInstallClaudeMem() {
	if (isClaudeMemInstalled()) {
		return { installed: true, alreadyInstalled: true };
	}
	const success = installClaudeMem();
	return { installed: success, alreadyInstalled: false };
}

/**
 * 偵測現有記憶資料（掃描 ~/.claude/projects/{project}/memory/）
 * @returns {{ hasExistingMemory: boolean, projectCount: number, fileCount: number, totalSizeKB: number }}
 */
export function detectExistingMemory() {
	if (!fs.existsSync(MEMORY_DIR)) {
		return {
			hasExistingMemory: false,
			projectCount: 0,
			fileCount: 0,
			totalSizeKB: 0,
		};
	}

	let projectCount = 0;
	let fileCount = 0;
	let totalSize = 0;

	let topEntries;
	try {
		topEntries = fs.readdirSync(MEMORY_DIR, { withFileTypes: true });
	} catch {
		return {
			hasExistingMemory: false,
			projectCount: 0,
			fileCount: 0,
			totalSizeKB: 0,
		};
	}

	for (const proj of topEntries) {
		if (!proj.isDirectory()) continue;
		const memDir = path.join(MEMORY_DIR, proj.name, "memory");
		if (!fs.existsSync(memDir)) continue;

		projectCount++;
		let files;
		try {
			files = fs.readdirSync(memDir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const f of files) {
			if (!f.isFile()) continue;
			fileCount++;
			try {
				const stat = fs.statSync(path.join(memDir, f.name));
				totalSize += stat.size;
			} catch {
				/* 忽略讀取失敗 */
			}
		}
	}

	return {
		hasExistingMemory: fileCount > 0,
		projectCount,
		fileCount,
		totalSizeKB: Math.round(totalSize / 1024),
	};
}

/**
 * 取得 claude-mem 完整狀態
 * @returns {{ installed: boolean, version: string|null, workerRunning: boolean }}
 */
export function getClaudeMemStatus() {
	const installed = isClaudeMemInstalled();
	return {
		installed,
		version: installed ? getClaudeMemVersion() : null,
		workerRunning: installed ? isWorkerRunning() : false,
	};
}
