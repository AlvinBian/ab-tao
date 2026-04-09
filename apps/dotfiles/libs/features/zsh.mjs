/**
 * ZSH Feature — 完全獨立的 ZSH 環境模組安裝 pipeline
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 * 不依賴任何其他 feature，不碰 ~/.claude/，不呼叫 GitHub API。
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import { BACK, handleCancel } from "../cli/prompts.mjs";
import { HOME } from "../core/paths.mjs";

const MODULE_DESCRIPTIONS = {
	history: "歷史記錄（50K + 去重 + 專案歷史自動切換）",
	keys: "按鍵綁定（Option+←/→ 跳單詞 · ↑↓ 前綴搜尋）",
	aliases: "編輯器偵測 + gh / uv + 通用命令縮寫",
	git: "Git aliases + delta diff + lazygit 整合",
	tools: "bat/eza/zoxide/fd/rg/tldr + FZF 環境（sheldon 管理插件）",
};

export default {
	id: "zsh",
	label: "🐚 ZSH 環境模組",
	hint: "history · keys · aliases · git · tools + sheldon 插件",
	dependsOn: [],
	conflicts: [],

	/**
	 * 1. 環境檢查（只查 brew + sheldon）
	 */
	async envCheck() {
		const checks = [];
		const ok = true;

		// Homebrew
		try {
			const { execFileSync } = await import("node:child_process");
			const ver = execFileSync("brew", ["--version"], { stdio: "pipe" })
				.toString()
				.match(/Homebrew ([\d.]+)/)?.[1];
			checks.push(`Homebrew ${ver || "✔"}`);
		} catch {
			checks.push("Homebrew ✗（安裝 CLI 工具需要）");
		}

		// sheldon
		try {
			const { execFileSync } = await import("node:child_process");
			execFileSync("which", ["sheldon"], { stdio: "pipe" });
			checks.push("sheldon ✔");
		} catch {
			checks.push("sheldon ✗（安裝時會自動安裝）");
		}

		return { ok, message: checks.join(" · ") };
	},

	/**
	 * 2. 備份（只備份 ZSH 相關）
	 */
	async backup(ctx) {
		const backupDir = ctx.backupDir;
		fs.mkdirSync(backupDir, { recursive: true });
		const backed = [];

		const tryBackup = (src, name) => {
			if (fs.existsSync(src)) {
				const dest = path.join(backupDir, name);
				fs.mkdirSync(path.dirname(dest), { recursive: true });
				fs.cpSync(src, dest, { recursive: true });
				backed.push(name);
			}
		};

		tryBackup(path.join(HOME, ".zshrc"), "zshrc");
		tryBackup(path.join(HOME, ".zshrc.d"), "zshrc.d");
		tryBackup(path.join(HOME, ".ripgreprc"), "ripgreprc");

		return { files: backed, dir: backupDir };
	},

	/**
	 * 3. 互動配置（模組選擇）
	 */
	async configure(ctx) {
		// 發現可選模組（排除恆常部署的 00-env、90-plugins）
		const confDir = path.join(ctx.repoDir, "zsh", ".zshrc.d", "conf");
		const allFiles = fs.existsSync(confDir)
			? fs.readdirSync(confDir).filter((f) => f.endsWith(".zsh"))
			: [];
		const selectableModules = allFiles
			.map((f) => f.replace(".zsh", ""))
			.filter((name) => !name.startsWith("00-") && !name.startsWith("90-"));

		const items = selectableModules.map((name) => {
			const shortName = name.replace(/^\d+-/, "");
			return {
				value: name,
				label: shortName,
				hint: MODULE_DESCRIPTIONS[shortName] || shortName,
			};
		});

		if (ctx.flags?.all) {
			return { modules: selectableModules };
		}

		const selected = handleCancel(
			await p.multiselect({
				message: "選擇要安裝的 ZSH 模組",
				options: items,
				initialValues: selectableModules,
				required: false,
			}),
		);

		if (selected === BACK || isEmpty(selected)) {
			return null;
		}

		return { modules: selected };
	},

	/**
	 * 4. 生成計畫
	 */
	async plan(ctx, config) {
		if (!config) return null;
		const moduleNames = config.modules.map((m) => m.replace(/^\d+-/, ""));
		return {
			features: ["zsh"],
			targets: ["zsh"],
			zshModules: moduleNames,
			mode: ctx.flags?.manual ? "manual" : "auto",
		};
	},

	/**
	 * 5. 確認
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		const lines = [
			`ZSH 模組 → ~/.zshrc.d/（${plan.zshModules.length} 可選 + 2 恆常 + sheldon 插件）`,
			...plan.zshModules.map(
				(m) => `  · ${m} — ${MODULE_DESCRIPTIONS[m] || ""}`,
			),
		];

		p.log.info(lines.join("\n"));

		const ok = handleCancel(
			await p.confirm({
				message: "確認安裝？",
				initialValue: true,
			}),
		);

		return ok === true;
	},

	/**
	 * 6. 安裝
	 */
	async install(ctx, plan) {
		if (!plan) return null;

		const { runWithProgress } = await import("../cli/progress.mjs");
		const { CLACK_LOGGER } = await import("../cli/logger.mjs");

		const moduleNames = plan.zshModules;
		const script = "zsh zsh/install.sh";

		CLACK_LOGGER.info(`安裝 ${moduleNames.length} 個 ZSH 模組 → ~/.zshrc.d/`);

		// total 由 install.sh 動態輸出 TOTAL:XX（fallback 30）
		await runWithProgress(`${script} --modules ${moduleNames.join(",")}`, {
			cwd: ctx.repoDir,
			total: 30,
			logger: CLACK_LOGGER,
			parseProgress(line) {
				// 匹配所有 ✔/▶/⚠ 開頭的進度行
				if (/^\s+[✔▶⚠]/.test(line)) {
					// 提取關鍵字作為 label
					const match = line.match(/[✔▶⚠]\s+(.+)/);
					const label = match?.[1]?.trim() || "...";
					// 截短到 40 字
					return label.length > 40 ? `${label.slice(0, 37)}...` : label;
				}
				return null;
			},
		});

		return { modules: moduleNames };
	},

	/**
	 * 7. 驗證
	 */
	async verify() {
		const confDir = path.join(HOME, ".zshrc.d", "conf");
		let passed = 0;
		let total = 0;
		const missing = [];

		// 檢查恆常模組
		for (const core of ["00-env.zsh", "90-plugins.zsh"]) {
			total++;
			if (fs.existsSync(path.join(confDir, core))) passed++;
			else missing.push(core);
		}

		// 檢查 sheldon
		const toml = path.join(HOME, ".zshrc.d", "sheldon", "plugins.toml");
		total++;
		if (fs.existsSync(toml)) passed++;
		else missing.push("plugins.toml");

		// 檢查 loader
		try {
			const zshrc = fs.readFileSync(path.join(HOME, ".zshrc"), "utf8");
			total++;
			if (zshrc.includes("ab-tao:loader")) passed++;
			else missing.push("loader in .zshrc");
		} catch {
			total++;
			missing.push(".zshrc");
		}

		return { passed, total, missing };
	},

	/**
	 * 8. 完成輸出
	 */
	complete(results) {
		if (!results) return [];
		return [
			"── ZSH 模組（~/.zshrc.d/ + sheldon）──",
			`  已安裝：${results.modules?.join("、") || "無"}`,
			"  執行 exec zsh 立即套用",
		];
	},

	/**
	 * 9. 回滾
	 */
	async rollback(ctx) {
		const backupDir = ctx.backupDir;
		if (!fs.existsSync(backupDir)) return;

		const restore = (name, dest) => {
			const src = path.join(backupDir, name);
			if (fs.existsSync(src)) {
				fs.cpSync(src, dest, { recursive: true });
			}
		};

		restore("zshrc", path.join(HOME, ".zshrc"));
		restore("zshrc.d", path.join(HOME, ".zshrc.d"));
		restore("ripgreprc", path.join(HOME, ".ripgreprc"));
	},

	/**
	 * 10. Session 數據
	 */
	session(results) {
		return {
			modules: results?.modules || [],
			installedAt: new Date().toISOString(),
		};
	},

	/**
	 * 11. 清理
	 */
	async cleanup(ctx) {
		// 清理 preview 目錄
		if (fs.existsSync(ctx.previewDir)) {
			fs.rmSync(ctx.previewDir, { recursive: true, force: true });
		}
	},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		return {
			feature: "zsh",
			modules: results?.modules || [],
			target: "~/.zshrc.d/",
		};
	},
};
