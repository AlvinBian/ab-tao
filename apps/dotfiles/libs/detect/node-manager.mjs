/**
 * Node 版本管理 — fnm/nvm/n 偵測與策略
 *
 * 提供 resolveNodeManager()：偵測現有管理器 → 提供遷移選項
 * 設定 process.env.AB_TAO_NODE_MGR 供 install.sh 使用
 *
 * 遷移邏輯委託給 node-migrate.mjs
 */

import { execFileSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { HOME } from "../core/paths.mjs";
import {
	discoverNVersions,
	discoverNvmVersions,
	migrateToFnm,
} from "./node-migrate.mjs";
import { has } from "./shell-utils.mjs";

// ── nvm / fnm 命令執行 ──────────────────────────────

/**
 * 透過 bash source nvm.sh 執行 nvm 命令（nvm 是 shell function，不在 PATH）
 */
export function runNvm(nvmCmd) {
	const nvmDir = process.env.NVM_DIR || `${HOME}/.nvm`;
	try {
		execFileSync(
			"bash",
			["-c", `source "${nvmDir}/nvm.sh" 2>/dev/null && nvm ${nvmCmd}`],
			{ stdio: "inherit", timeout: 120000 },
		);
		return true;
	} catch {
		return false;
	}
}

/** 透過 fnm 執行命令（fnm 是獨立二進制，直接呼叫） */
export function runFnm(fnmCmd) {
	try {
		const args = fnmCmd.split(/\s+/);
		execFileSync("fnm", args, { stdio: "inherit", timeout: 120000 });
		return true;
	} catch {
		return false;
	}
}

// ── 偵測 ──────────────────────────────

/** 檢查 nvm 是否可用（source nvm.sh && nvm --version） */
export function checkNvm() {
	const nvmDir = process.env.NVM_DIR || `${HOME}/.nvm`;
	try {
		execFileSync(
			"bash",
			["-c", `source "${nvmDir}/nvm.sh" 2>/dev/null && nvm --version`],
			{ stdio: "pipe", timeout: 3000 },
		);
		return true;
	} catch {
		return false;
	}
}

/** 取得 nvm 版本號 */
export function nvmVersion() {
	const nvmDir = process.env.NVM_DIR || `${HOME}/.nvm`;
	try {
		return execFileSync(
			"bash",
			["-c", `source "${nvmDir}/nvm.sh" 2>/dev/null && nvm --version`],
			{ encoding: "utf8", stdio: "pipe", timeout: 3000 },
		).trim();
	} catch {
		return null;
	}
}

// ── 公開 API ──────────────────────────────

/**
 * Node 版本管理策略：偵測 fnm/nvm/n，提供遷移選項
 * 設定 process.env.AB_TAO_NODE_MGR 供 install.sh 使用
 *
 * @param {Set<string>} justInstalled - 本次剛安裝的工具集合
 */
export async function resolveNodeManager(justInstalled = new Set()) {
	const nowFnm = has("fnm") || justInstalled.has("fnm");
	const nowNvm = checkNvm();
	const nowN = has("n");

	// fnm 已就緒 + nvm/n 共存 → 讓用戶選擇
	if (nowFnm && (nowNvm || nowN)) {
		const other = nowNvm ? "nvm" : "n";
		const versions = nowNvm ? discoverNvmVersions() : discoverNVersions();
		const migrateHint =
			versions.length > 0
				? `遷移 ${versions.length} 個 Node 版本至 fnm + 卸載 ${other}`
				: `卸載 ${other}`;
		const choice = await p.select({
			message: `📦 偵測到 fnm + ${pc.bold(other)} 共存`,
			options: [
				{
					value: "fnm",
					label: "使用 fnm",
					hint: migrateHint,
				},
				{
					value: other,
					label: `保留 ${other}`,
					hint: `略過 fnm，ZSH 模組配置 ${other} 自動切換`,
				},
			],
			initialValue: "fnm",
		});

		const selected = p.isCancel(choice) ? "fnm" : choice;
		if (selected === "fnm") {
			await migrateToFnm(other);
		} else {
			p.log.info(pc.dim(`保留 ${other}（ZSH 模組將配置 cd 自動切換）`));
		}
		process.env.AB_TAO_NODE_MGR = selected;
		return;
	}

	// fnm 已就緒（無共存衝突）
	if (nowFnm) {
		process.env.AB_TAO_NODE_MGR = "fnm";
		return;
	}

	// 有 nvm/n 但沒有 fnm → 提供遷移選項
	if (nowNvm || nowN) {
		const existing = nowNvm ? "nvm" : "n";
		const versions = nowNvm ? discoverNvmVersions() : discoverNVersions();
		const versionHint =
			versions.length > 0
				? `遷移 ${versions.length} 個 Node 版本 + 卸載 ${existing} + 清理`
				: `安裝 fnm + 卸載 ${existing}`;

		const choice = await p.select({
			message: `📦 偵測到 ${pc.bold(existing)}，建議切換為 fnm（啟動 ~1ms vs ~1s）`,
			options: [
				{
					value: "migrate",
					label: "切換為 fnm",
					hint: versionHint,
				},
				{
					value: "keep",
					label: `保留 ${existing}`,
					hint: "ZSH 模組自動配置 cd 時讀取 .nvmrc 切換",
				},
			],
			initialValue: "migrate",
		});

		if (p.isCancel(choice) || choice === "keep") {
			process.env.AB_TAO_NODE_MGR = existing;
			p.log.info(pc.dim(`繼續使用 ${existing}（ZSH 模組將配置 cd 自動切換）`));
			return;
		}

		const ok = await migrateToFnm(existing);
		process.env.AB_TAO_NODE_MGR = ok ? "fnm" : existing;
		return;
	}

	// 什麼都沒有
	process.env.AB_TAO_NODE_MGR = "fnm";
}
