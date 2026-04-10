/**
 * Claude Base Feature — 全局 Claude Code 配置部署
 *
 * 部署 commands · agents · rules · hooks · settings 到 ~/.claude/
 * 純模板部署，不需要 repos 或技術棧分析。
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { BACK, handleCancel } from "../cli/prompts.mjs";
import { HOME } from "../core/paths.mjs";

const CLAUDE_DIR = path.join(HOME, ".claude");

export default {
	id: "claude-base",
	label: "🤖 Claude Code 配置",
	hint: "commands · agents · rules · hooks · settings",
	dependsOn: [],
	conflicts: [],

	/**
	 * 1. 環境檢查 — 確認 claude CLI 可用
	 */
	async envCheck() {
		try {
			const { warmupCli } = await import("../external/claude-cli.mjs");
			warmupCli();
			return { ok: true, message: "🤖 Claude CLI ✔" };
		} catch {
			return { ok: false, message: "🤖 Claude CLI 不可用" };
		}
	},

	/**
	 * 2. 備份 — 備份 ~/.claude/ 下的 commands/agents/rules + hooks.json + settings.json
	 */
	async backup(ctx) {
		const { backupIfExists } = await import("../core/backup.mjs");
		const backed = [];

		// 備份子目錄
		for (const sub of ["commands", "agents", "rules"]) {
			const r = await backupIfExists(
				path.join(CLAUDE_DIR, sub),
				`claude/${sub}`,
			);
			if (r) backed.push(r);
		}

		// 備份獨立檔案
		for (const f of ["hooks.json", "settings.json"]) {
			const r = await backupIfExists(path.join(CLAUDE_DIR, f), `claude/${f}`);
			if (r) backed.push(r);
		}

		return { files: backed, dir: ctx.backupDir || "" };
	},

	/**
	 * 3. 互動配置 — 從靜態全局配置 + model 選擇
	 */
	async configure(ctx) {
		const { ALL_COMMANDS, ALL_AGENTS, ALL_RULES } = await import(
			"../config/config-classifier.mjs"
		);
		const { ALL_HOOKS, PERMISSION_PRESETS, SETTINGS_PRESETS } = await import(
			"../config/auto-plan.mjs"
		);

		const { isCclineInstalled } = await import("../external/ccline.mjs");
		const cclineInstalled = isCclineInstalled();

		if (ctx.flags?.quick) {
			// 從 session 重建（使用上次的 model）
			return {
				global: {
					commands: ALL_COMMANDS,
					agents: ALL_AGENTS,
					rules: ALL_RULES,
					hooks: ALL_HOOKS,
					permissions: PERMISSION_PRESETS,
					settings: {
						...SETTINGS_PRESETS,
						model: ctx.prev?.install?.model || "opusplan",
					},
					cclineInstalled,
				},
				model: ctx.prev?.install?.model || "opusplan",
			};
		}

		// Model 選擇
		const modelChoices = [
			{
				value: "opusplan",
				label: "opusplan",
				hint: "Opus 規劃 + Sonnet 執行（推薦）",
			},
			{ value: "sonnet", label: "sonnet", hint: "全程 Sonnet" },
			{ value: "haiku", label: "haiku", hint: "快速低成本" },
			{ value: "opus", label: "opus", hint: "全程 Opus（最高品質）" },
		];

		let model = SETTINGS_PRESETS.model || "opusplan";

		if (!ctx.flags?.all) {
			// 偵測現有 model 設定
			try {
				const settingsPath = path.join(CLAUDE_DIR, "settings.json");
				if (fs.existsSync(settingsPath)) {
					const existing = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
					if (existing.model) model = existing.model;
				}
			} catch {
				// 讀取失敗則使用預設值
			}

			const selected = handleCancel(
				await p.select({
					message: "選擇 AI Model",
					options: modelChoices,
					initialValue: model,
				}),
			);
			if (selected === BACK) return null;
			model = selected;
		}

		return {
			global: {
				commands: ALL_COMMANDS,
				agents: ALL_AGENTS,
				rules: ALL_RULES,
				hooks: ALL_HOOKS,
				permissions: PERMISSION_PRESETS,
				settings: { ...SETTINGS_PRESETS, model },
				cclineInstalled,
			},
			model,
		};
	},

	/**
	 * 4. 生成計畫
	 */
	async plan(_ctx, config) {
		if (!config) return null;
		return {
			global: config.global,
			model: config.model,
			features: ["claude-base"],
			targets: ["claude-dev"],
		};
	},

	/**
	 * 5. 確認 — 顯示全局配置摘要並請求確認
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		const { formatGlobalConfig } = await import("../cli/plan-view.mjs");
		const lines = formatGlobalConfig(plan.global);
		p.log.info(lines.join("\n"));

		return (
			handleCancel(
				await p.confirm({
					message: "確認安裝 Claude 配置？",
					initialValue: true,
				}),
			) === true
		);
	},

	/**
	 * 6. 安裝 — 委託 deployGlobalConfig 執行實際部署
	 */
	async install(ctx, plan) {
		if (!plan) return null;

		const { deployGlobalConfig } = await import(
			"../phases/execute/claude-tasks.mjs"
		);

		const installSelections = await deployGlobalConfig({
			repoDir: ctx.repoDir,
			previewDir: ctx.previewDir || path.join(ctx.repoDir, "dist", "preview"),
			targets: ctx.targets || {},
			model: plan.model,
			isManual: ctx.flags?.manual || false,
			targetKeys: plan.targets || [],
		});

		return installSelections;
	},

	/**
	 * 7. 驗證 — 檢查 ~/.claude/ 下的資源是否存在
	 */
	async verify() {
		let passed = 0;
		let total = 0;
		const missing = [];

		// 檢查子目錄（至少要有 .md 檔案）
		for (const sub of ["commands", "agents", "rules"]) {
			total++;
			const dir = path.join(CLAUDE_DIR, sub);
			if (
				fs.existsSync(dir) &&
				fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length > 0
			) {
				passed++;
			} else {
				missing.push(sub);
			}
		}

		// 檢查獨立檔案（hooks.json 由 Slack feature 負責）
		for (const f of ["settings.json"]) {
			total++;
			if (fs.existsSync(path.join(CLAUDE_DIR, f))) {
				passed++;
			} else {
				missing.push(f);
			}
		}

		return { passed, total, missing };
	},

	/**
	 * 8. 完成輸出 — 格式化安裝結果摘要
	 */
	complete(results) {
		if (!results) return [];

		const parts = [];
		if (results.commands?.length)
			parts.push(`${results.commands.length} commands`);
		if (results.agents?.length) parts.push(`${results.agents.length} agents`);
		if (results.rules?.length) parts.push(`${results.rules.length} rules`);
		if (results.hooks?.length) parts.push(`${results.hooks.length} hooks`);

		const cclineLabel = results.cclineInstalled
			? "CCometixLine ✅"
			: "CCometixLine ⚠️（安裝失敗，statusLine 未配置）";

		return parts.length
			? [
					"🤖 Claude 配置",
					`  已安裝：${parts.join(" · ")}`,
					`  Model: ${results.model || "opusplan"}`,
					`  StatusLine: ${cclineLabel}`,
				]
			: [];
	},

	/**
	 * 9. 回滾（目前由 backup 機制覆蓋，保留接口）
	 */
	async rollback() {},

	/**
	 * 10. Session 數據 — 供後續 feature 讀取安裝結果
	 */
	session(results) {
		return {
			commands: results?.commands || [],
			agents: results?.agents || [],
			rules: results?.rules || [],
			hooks: results?.hooks || [],
			model: results?.model || "opusplan",
			cclineInstalled: results?.cclineInstalled ?? false,
		};
	},

	/**
	 * 11. 清理
	 */
	async cleanup() {},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		return { feature: "claude-base", ...results };
	},
};
