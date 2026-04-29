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
import { HOME, P } from "../core/paths.mjs";

const CLAUDE_DIR = path.join(HOME, ".claude");

/**
 * 確保 P.abTao 命名空間下的所有子目錄存在。
 * 每次 install 時呼叫，保持冪等。
 */
function initAbTaoDirs() {
	for (const dir of Object.values(P.abTao)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

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
		for (const sub of ["commands", "agents", "rules", "skills"]) {
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

		const { isClaudeHudPluginInstalled } = await import(
			"../external/claude-hud.mjs"
		);
		const claudeHudPluginInstalled = isClaudeHudPluginInstalled();

		if (ctx.flags?.quick) {
			// 從 session 重建（使用上次的 model 設定）
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
					claudeHudPluginInstalled,
				},
				model: ctx.prev?.install?.model || "opusplan",
				claudeMdAction: "install",
				selectedCategories: [
					"commands",
					"agents",
					"rules",
					"hooks",
					"settings",
					"claude-md",
				],
			};
		}

		// Model 選擇
		const modelChoices = [
			{
				value: "opusplan",
				label: "opusplan Opus 規劃 + Sonnet 執行（推薦）",
			},
			{ value: "sonnet", label: "sonnet 全程 Sonnet" },
			{ value: "haiku", label: "haiku 快速低成本" },
			{ value: "opus", label: "opus 全程 Opus（最高品質）" },
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

		// CLAUDE.md 處理方式選擇 + 類別選擇（--all 模式跳過，使用預設值）
		const claudeMdExists = fs.existsSync(path.join(CLAUDE_DIR, "CLAUDE.md"));
		let claudeMdAction = "install";
		let selectedCategories = [
			"commands",
			"agents",
			"rules",
			"hooks",
			"settings",
			"claude-md",
		];

		if (!ctx.flags?.all) {
			const selectedClaudeMd = handleCancel(
				await p.select({
					message: "CLAUDE.md 處理方式",
					options: [
						{
							value: "install",
							label: claudeMdExists
								? "install — 覆蓋現有 CLAUDE.md（自動備份）"
								: "install — 安裝 CLAUDE.md",
						},
						{
							value: "merge",
							label: "merge 將缺少的 @import 行追加至現有 CLAUDE.md",
						},
						{
							value: "keep",
							label: "keep 跳過，保留現有 CLAUDE.md 不變",
						},
					],
					initialValue: claudeMdAction,
				}),
			);
			if (selectedClaudeMd === BACK) return null;
			claudeMdAction = selectedClaudeMd;

			const selectedCats = handleCancel(
				await p.multiselect({
					message: "選擇要安裝的類別",
					options: [
						{
							value: "commands",
							label: `commands（${ALL_COMMANDS.length} 個）`,
						},
						{
							value: "agents",
							label: `agents（${ALL_AGENTS.length} 個）`,
						},
						{ value: "rules", label: `rules（${ALL_RULES.length} 個）` },
						{ value: "hooks", label: `hooks（${ALL_HOOKS.length} 個）` },
						{
							value: "settings",
							label: "settings settings.json + permissions",
						},
						{
							value: "claude-md",
							label: "claude-md claude-md/ 子目錄模組",
						},
					],
					initialValues: selectedCategories,
				}),
			);
			if (selectedCats === BACK) return null;
			selectedCategories = selectedCats;
		}

		// Slack 通知設定（在 spinner 啟動前詢問，避免 UX 混亂）
		let slackEnv = null;
		if (selectedCategories.includes("settings")) {
			try {
				const { setupSlackNotify } = await import("../install/slack-setup.mjs");
				// 讀取現有 settings.json env 作為初始值
				let existingEnv = {};
				try {
					const settingsPath = path.join(CLAUDE_DIR, "settings.json");
					if (fs.existsSync(settingsPath)) {
						const s = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
						existingEnv = s.env ?? {};
					}
				} catch {
					/* 讀取失敗使用空物件 */
				}
				slackEnv = await setupSlackNotify(existingEnv);
			} catch {
				/* 非阻塞，Slack 設定失敗不影響主流程 */
			}
		}

		return {
			global: {
				commands: selectedCategories.includes("commands") ? ALL_COMMANDS : [],
				agents: selectedCategories.includes("agents") ? ALL_AGENTS : [],
				rules: selectedCategories.includes("rules") ? ALL_RULES : [],
				hooks: selectedCategories.includes("hooks") ? ALL_HOOKS : [],
				permissions: selectedCategories.includes("settings")
					? PERMISSION_PRESETS
					: null,
				settings: selectedCategories.includes("settings")
					? { ...SETTINGS_PRESETS, model }
					: null,
				claudeHudPluginInstalled,
			},
			model,
			claudeMdAction,
			selectedCategories,
			slackEnv,
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
			claudeMdAction: config.claudeMdAction ?? "keep",
			selectedCategories: config.selectedCategories ?? [
				"commands",
				"agents",
				"rules",
				"hooks",
				"settings",
				"claude-md",
			],
			slackEnv: config.slackEnv ?? null,
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
	 * 6. 安裝 — 委託 deployGlobalConfig 執行實際部署，並處理 CLAUDE.md
	 */
	async install(ctx, plan) {
		if (!plan) return null;

		const { deployGlobalConfig } = await import(
			"../phases/execute/claude-tasks.mjs"
		);

		const result = await deployGlobalConfig({
			repoDir: ctx.repoDir,
			previewDir: ctx.previewDir || path.join(ctx.repoDir, "dist", "preview"),
			targets: ctx.targets || {},
			model: plan.model,
			isManual: ctx.flags?.manual || false,
			targetKeys: plan.targets || [],
			preferences: ctx.preferences ?? null,
			slackEnv: plan.slackEnv ?? null,
		});

		// ── CLAUDE.md 處理 ──
		const claudeMdAction = plan.claudeMdAction ?? "keep";
		const srcMd = path.join(ctx.repoDir, "claude", "CLAUDE.md");
		const destMd = path.join(CLAUDE_DIR, "CLAUDE.md");

		if (claudeMdAction === "install" && fs.existsSync(srcMd)) {
			// install：內容相同時跳過（idempotency 保護）
			if (
				fs.existsSync(destMd) &&
				fs.readFileSync(srcMd).toString() === fs.readFileSync(destMd).toString()
			) {
				result.messages ??= [];
				result.messages.push("CLAUDE.md 已是最新，跳過");
				result.claudeMd = "skipped (已是最新)";
			} else {
				// 備份現有，直接覆蓋
				if (fs.existsSync(destMd)) {
					const { backupIfExists } = await import("../core/backup.mjs");
					await backupIfExists(destMd, "claude/CLAUDE.md");
				}
				fs.copyFileSync(srcMd, destMd);
				result.claudeMd = "installed";
			}
		} else if (claudeMdAction === "merge" && fs.existsSync(srcMd)) {
			// merge：讀取來源 @import 行，將目標缺少的行追加至末尾
			const srcLines = fs
				.readFileSync(srcMd, "utf8")
				.split("\n")
				.filter((l) => l.trimStart().startsWith("@"));
			if (fs.existsSync(destMd)) {
				const destContent = fs.readFileSync(destMd, "utf8");
				const destLines = new Set(destContent.split("\n").map((l) => l.trim()));
				const toAppend = srcLines.filter((l) => !destLines.has(l.trim()));
				if (toAppend.length > 0) {
					const sep = destContent.endsWith("\n") ? "" : "\n";
					fs.appendFileSync(destMd, `${sep}${toAppend.join("\n")}\n`);
				}
				result.claudeMd = `merged (${toAppend.length} 行)`;
			} else if (fs.existsSync(srcMd)) {
				// 目標不存在則直接複製
				fs.copyFileSync(srcMd, destMd);
				result.claudeMd = "installed (merge fallback)";
			}
		} else {
			result.claudeMd = "kept";
		}

		// 初始化 builtin profile yml（確保新增的 profile 部署到 ~/.claude/.ab-tao/profiles/）
		try {
			const { initDefaultProfiles } = await import("../install/profiles.mjs");
			initDefaultProfiles(path.join(ctx.repoDir, "claude", "profiles"));
		} catch {
			// profiles.mjs 不存在或 initDefaultProfiles 失敗不應中斷主流程
		}

		// 初始化 .ab-tao/ 子目錄（P.abTao.xxx 命名空間對應的實體目錄）
		initAbTaoDirs();

		// 部署 intent-cache seed（若 runtime 目錄尚無此檔案，從 commons resources 複製）
		try {
			const intentCacheDest = path.join(P.abTao.runtime, "intent-cache.json");
			if (!fs.existsSync(intentCacheDest)) {
				const intentCacheSrc = path.join(
					ctx.repoDir,
					"..",
					"..",
					"packages",
					"commons",
					"resources",
					"ai",
					"intent-cache.json",
				);
				if (fs.existsSync(intentCacheSrc)) {
					fs.copyFileSync(intentCacheSrc, intentCacheDest);
				}
			}
		} catch {
			// intent-cache 複製失敗不應中斷主流程
		}

		// M3.6.2 failure-patterns seed（若 corrections 目錄尚無此檔案，從 commons template 複製）
		try {
			const failurePatternsDest = path.join(
				P.abTao.corrections,
				"failure-patterns.md",
			);
			if (!fs.existsSync(failurePatternsDest)) {
				const failurePatternsSrc = path.join(
					ctx.repoDir,
					"..",
					"..",
					"packages",
					"commons",
					"resources",
					"ai",
					"failure-patterns-template.md",
				);
				if (fs.existsSync(failurePatternsSrc)) {
					fs.copyFileSync(failurePatternsSrc, failurePatternsDest);
				}
			}
		} catch {
			// failure-patterns 複製失敗不應中斷主流程
		}

		return result;
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

		const wrapperOk = results.claudeHudWrapperDeployed;
		const pluginOk = results.claudeHudPluginInstalled;
		const hudLabel = wrapperOk
			? `claude-hud: wrapper ✅ + plugin ${pluginOk ? "✅" : "⏳ 待 Claude Code 重啟自動安裝"}`
			: "claude-hud ⚠️（wrapper 部署失敗）";

		const lines = parts.length
			? [
					"🤖 Claude 配置",
					`  已安裝：${parts.join(" · ")}`,
					`  Model: ${results.model || "opusplan"}`,
					`  StatusLine: ${hudLabel}`,
				]
			: [];

		return lines;
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
			claudeHudWrapperDeployed: results?.claudeHudWrapperDeployed ?? false,
			claudeHudPluginInstalled: results?.claudeHudPluginInstalled ?? false,
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
