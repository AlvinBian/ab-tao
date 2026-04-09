/**
 * 環境檢查 + 自動修復
 *
 * 檢查順序：Homebrew → Node 版本管理（fnm/nvm/n）→ Node.js → pnpm → gh CLI → gh 登入 → claude CLI
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import pc from "picocolors";
import { HOME } from "../core/paths.mjs";
import {
	checkNvm,
	nvmVersion,
	resolveNodeManager,
	runFnm,
	runNvm,
} from "./node-manager.mjs";
import { findClaudeCli, has, run, ver } from "./shell-utils.mjs";

/**
 * 檢查並確保開發環境完整
 *
 * 依序檢查 Homebrew、Node 版本管理（fnm/nvm/n）、Node.js、pnpm、gh CLI、gh 登入、claude CLI。
 * 若有缺失，提示用戶確認後自動安裝。
 * 全部通過則顯示版本資訊並返回 true。
 *
 * @returns {Promise<boolean>} 環境就緒返回 true，安裝失敗返回 false
 */
export async function ensureEnvironment() {
	const fnmOk = has("fnm");
	const nvmOk = checkNvm();
	const nOk = has("n");
	const anyNodeMgr = fnmOk || nvmOk || nOk;
	const nodeMgrLabel = fnmOk ? "fnm" : nvmOk ? "nvm" : nOk ? "n" : null;
	const nodeMgrVer = fnmOk
		? ver("fnm")?.match(/[\d.]+/)?.[0]
		: nvmOk
			? nvmVersion()
			: nOk
				? ver("n")?.match(/[\d.]+/)?.[0]
				: null;

	const checks = [
		{
			name: "Homebrew",
			ok: has("brew"),
			ver: ver("brew", "-v")?.match(/[\d.]+/)?.[0],
			failLabel: "未安裝",
			actionLabel: "安裝 Homebrew",
		},
		{
			name: "Node 版本管理",
			ok: anyNodeMgr,
			ver: nodeMgrVer ? `${nodeMgrLabel} ${nodeMgrVer}` : null,
			failLabel: "未安裝（fnm / nvm / n）",
			actionLabel: "安裝 fnm",
		},
		{
			name: "Node.js",
			ok: has("node"),
			ver: ver("node"),
			failLabel: "未安裝",
			actionLabel: "安裝 Node.js",
		},
		{
			name: "pnpm",
			ok: has("pnpm"),
			ver: ver("pnpm"),
			failLabel: "未安裝",
			actionLabel: "安裝 pnpm",
		},
		{
			name: "gh CLI",
			ok: has("gh"),
			ver: ver("gh"),
			failLabel: "未安裝",
			actionLabel: "安裝 gh CLI",
		},
		{
			name: "gh 登入",
			ok: (() => {
				try {
					execSync("gh auth status", { stdio: "pipe" });
					return true;
				} catch {
					return false;
				}
			})(),
			ver: null,
			failLabel: "未登入",
			actionLabel: "GitHub 登入",
		},
		{
			name: "claude CLI",
			ok: has("claude"),
			ver: ver("claude"),
			failLabel: "未安裝",
			actionLabel: "安裝 Claude CLI",
		},
	];

	const missing = checks.filter((c) => !c.ok);

	// 全部通過
	if (isEmpty(missing)) {
		const cleanVer = (v) => v?.match(/[\d.]+/)?.[0] || "";
		const info = checks
			.map((c) =>
				c.ver
					? `${c.name} ${pc.dim(cleanVer(c.ver))}`
					: `${c.name} ${pc.dim("✔")}`,
			)
			.join(" · ");
		p.log.success(`✅ 環境檢查通過  ${info}`);

		// Node 版本管理策略（遷移提示）
		await resolveNodeManager();

		return true;
	}

	// 顯示狀態
	const checkLines = checks
		.map((c) => {
			let icon;
			let info;
			if (c.ok) {
				icon = pc.green("✔");
				info = pc.dim(c.ver?.slice(0, 25) || "OK");
			} else {
				icon = pc.red("✘");
				info = pc.red(c.failLabel);
			}
			return `  ${icon} ${c.name.padEnd(12)} ${info}`;
		})
		.join("\n");
	p.log.info(`🔍 環境檢查\n${checkLines}`);

	// 若有必須安裝的項目，確認安裝
	if (!isEmpty(missing)) {
		const confirm = await p.confirm({
			message: `⚙️ 需要處理 ${missing.map((m) => m.actionLabel).join("、")}，繼續？  Y 確認 · n 取消 · ESC 上一步`,
			initialValue: true,
		});
		if (p.isCancel(confirm) || !confirm) {
			p.log.warn("請手動安裝後重新執行");
			p.outro(pc.red("環境準備失敗"));
			process.exit(1);
		}
	}

	// 記錄哪些工具本次被安裝（影響後續步驟的判斷）
	const justInstalled = new Set();

	// 只安裝必須項目
	for (const m of missing) {
		const s = p.spinner();

		if (m.name === "Homebrew") {
			s.start("📦 安裝 Homebrew...");
			const ok = run(
				'/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
			);
			s.stop(
				ok ? `${pc.green("✔")} Homebrew 安裝完成` : pc.red("Homebrew 安裝失敗"),
			);
			if (!ok) {
				p.log.warn(
					`Homebrew 安裝失敗，請手動安裝後重新執行：\n  ${pc.cyan('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')}`,
				);
				return false;
			}
			run(
				'eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null',
			);
			justInstalled.add("brew");
		}

		if (m.name === "Node 版本管理") {
			s.start("📦 安裝 fnm（Node 版本管理）...");
			let fnmInstallOk = false;
			if (has("brew") || justInstalled.has("brew")) {
				fnmInstallOk = run("brew install fnm");
			}
			s.stop(
				fnmInstallOk ? `${pc.green("✔")} fnm 安裝完成` : pc.red("fnm 安裝失敗"),
			);
			if (!fnmInstallOk) {
				p.log.warn(
					`fnm 安裝失敗，請手動安裝後重新執行：\n  ${pc.cyan("brew install fnm")}`,
				);
				return false;
			}
			justInstalled.add("fnm");
		}

		if (m.name === "Node.js") {
			s.start("📦 安裝 Node.js...");
			let ok = false;
			const useFnm = has("fnm") || justInstalled.has("fnm");
			const useNvm = nvmOk || justInstalled.has("nvm");
			if (useFnm) {
				ok = runFnm("install --lts");
				if (ok) runFnm("default lts-latest");
			} else if (useNvm) {
				ok = runNvm("install --lts");
			} else if (nOk) {
				ok = run("n lts");
			} else if (has("brew")) {
				ok = run("brew install node");
			}
			s.stop(
				ok
					? `${pc.green("✔")} Node.js 安裝完成 ${pc.dim(ver("node") || "")}`
					: pc.red("Node.js 安裝失敗"),
			);
			if (!ok) {
				p.log.warn(
					`Node.js 安裝失敗，請手動安裝後重新執行：\n  ${pc.cyan("fnm install --lts")}  或  ${pc.cyan("brew install node")}`,
				);
				return false;
			}
		}

		if (m.name === "pnpm") {
			s.start("📦 安裝 pnpm...");
			let ok = false;
			if (has("corepack")) {
				run("corepack enable");
				ok = run("corepack prepare pnpm@latest --activate");
			}
			if (!ok) ok = run("npm install -g pnpm");
			s.stop(
				ok && has("pnpm")
					? `${pc.green("✔")} pnpm 安裝完成 ${pc.dim(ver("pnpm"))}`
					: pc.red("pnpm 安裝失敗"),
			);
			if (!has("pnpm")) {
				p.log.warn(
					`pnpm 安裝失敗，請手動安裝後重新執行：\n  ${pc.cyan("npm install -g pnpm")}`,
				);
				return false;
			}
		}

		if (m.name === "gh CLI") {
			s.start("📦 安裝 gh CLI...");
			let ok = false;
			if (has("brew")) {
				ok = run("brew install gh");
			}
			s.stop(
				ok
					? `${pc.green("✔")} gh CLI 安裝完成 ${pc.dim(ver("gh"))}`
					: pc.red("gh CLI 安裝失敗"),
			);
			if (!ok) {
				p.log.warn(
					`gh CLI 安裝失敗，請手動安裝後重新執行：\n  ${pc.cyan("brew install gh")}  或  ${pc.cyan("https://cli.github.com")}`,
				);
				p.outro(pc.red("環境準備失敗"));
				process.exit(1);
			}
		}

		if (m.name === "gh 登入") {
			p.log.info(
				`🔑 需要登入 GitHub，請在瀏覽器完成授權：\n  ${pc.dim("按 Enter 開啟瀏覽器 → 複製一次性驗證碼 → 完成授權")}`,
			);
			const ok = run("gh auth login --web");
			if (!ok) {
				p.log.warn(
					`GitHub 登入失敗，請手動執行後重新運行：\n` +
						`  ${pc.cyan("gh auth login")}          # 互動式（瀏覽器）\n` +
						`  ${pc.cyan("gh auth login --with-token")}  # 貼上 Personal Access Token`,
				);
				p.outro(pc.red("環境準備失敗"));
				process.exit(1);
			}
			p.log.success(`${pc.green("✔")} GitHub 登入完成`);
		}

		if (m.name === "claude CLI") {
			const existingPath = findClaudeCli();
			if (existingPath) {
				s.start("🔍 檢查 Claude CLI...");
				s.stop(`${pc.green("✔")} Claude CLI 已安裝（${pc.dim(existingPath)}）`);
				p.log.info(
					`若終端找不到 claude，請執行 ${pc.cyan("hash -r")} 或開新終端視窗`,
				);
			} else {
				const installMethods = [
					{
						label: "官方安裝器",
						cmd: "curl -fsSL https://claude.ai/install.sh | sh",
					},
					{ label: "Homebrew", cmd: "brew install claude-code" },
					{ label: "pnpm", cmd: "pnpm add -g @anthropic-ai/claude-code" },
				];
				let installed = false;
				for (const method of installMethods) {
					if (installed) break;
					s.start(`📦 安裝 Claude CLI（${method.label}）...`);
					const ok = run(method.cmd);
					const localBin = `${HOME}/.local/bin`;
					if (
						existsSync(`${localBin}/claude`) &&
						!process.env.PATH?.includes(localBin)
					) {
						process.env.PATH = `${localBin}:${process.env.PATH}`;
					}
					if (ok && (has("claude") || findClaudeCli())) {
						installed = true;
					} else {
						s.stop(`${method.label} 失敗，嘗試下一個方式...`);
					}
				}
				s.stop(
					installed
						? `${pc.green("✔")} Claude CLI 安裝完成 ${pc.dim(ver("claude") || findClaudeCli())}`
						: pc.red("Claude CLI 安裝失敗"),
				);
				if (!installed && !findClaudeCli()) {
					p.log.warn(
						`Claude CLI 安裝失敗，請手動安裝後重新執行：\n` +
							`  ${pc.cyan("curl -fsSL https://claude.ai/install.sh | sh")}  # 官方安裝器（推薦）\n` +
							`  ${pc.cyan("brew install claude-code")}                       # Homebrew\n` +
							`  ${pc.cyan("pnpm add -g @anthropic-ai/claude-code")}          # pnpm 全局\n` +
							`  ${pc.dim("安裝後請確保 ~/.local/bin 在 PATH 中（ab-tao 的 ZSH 模組會自動處理）")}`,
					);
					p.outro(pc.red("環境準備失敗"));
					process.exit(1);
				}
			}
		}
	}

	// Node 版本管理策略（遷移提示）
	await resolveNodeManager(justInstalled);

	p.log.success("✅ 環境就緒");
	return true;
}
