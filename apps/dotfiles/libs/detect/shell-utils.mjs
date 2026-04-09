/**
 * 共用 shell 工具函式
 *
 * 提供命令檢測、版本查詢、命令執行等基礎操作，
 * 被 doctor.mjs 和 node-manager.mjs 共用。
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { HOME } from "../core/paths.mjs";

/** claude CLI 可能的安裝路徑（官方安裝器、npm 全局、Homebrew） */
export const CLAUDE_CANDIDATES = [
	`${HOME}/.local/bin/claude`,
	"/usr/local/bin/claude",
	"/opt/homebrew/bin/claude",
	`${HOME}/.npm-global/bin/claude`,
	`${HOME}/.nvm/versions/node/current/bin/claude`,
];

/** 檢查命令是否存在（which） */
export function has(cmd) {
	try {
		execFileSync("which", [cmd], { stdio: "pipe" });
		return true;
	} catch {
		/* which 失敗，對 claude 額外檢查已知路徑 */
		if (cmd === "claude") return !!findClaudeCli();
		return false;
	}
}

/** 找到 claude CLI 的實際路徑 */
export function findClaudeCli() {
	// 先嘗試 which
	try {
		return execSync("which claude", { encoding: "utf8", stdio: "pipe" }).trim();
	} catch {
		/* 不在 PATH 中 */
	}
	// 逐一檢查候選路徑
	for (const candidate of CLAUDE_CANDIDATES) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

/** 取得命令版本號 */
export function ver(cmd, flag = "--version") {
	const bin = cmd === "claude" ? findClaudeCli() || cmd : cmd;
	try {
		return execFileSync(bin, [flag], { encoding: "utf8", stdio: "pipe" })
			.trim()
			.split("\n")[0];
	} catch {
		return null;
	}
}

/** 執行 shell 命令（自動判斷是否需要 shell） */
export function run(cmd) {
	try {
		const needsShell = /[|&;><$()`]/.test(cmd) || /&&|\|\|/.test(cmd);
		execSync(cmd, { stdio: "inherit", shell: needsShell, timeout: 300000 });
		return true;
	} catch {
		return false;
	}
}
