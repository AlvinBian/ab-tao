/**
 * Phase: 安裝執行（協調器）
 *
 * 流程：
 *   [0] 統一備份（Claude + ZSH 一次完成）
 *   ┌─ 並行 ──────────────────────────────┐
 *   │ Branch A: Claude + 專案配置          │
 *   │ Branch B: Plugin 打包               │
 *   │ Branch C: ZSH 模組                  │
 *   └────────────────────────────────────┘
 *   [1] 驗證安裝完整性
 *
 * 子模組責任分離：
 *   - execute/claude-tasks.mjs — Branch A（全局配置 + Claude 安裝 + 專案配置）
 *   - execute/install-plugin.mjs — Branch B（Plugin 打包）
 *   - execute/install-zsh.mjs — Branch C（ZSH 模組）
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Listr } from "listr2";
import { isEmpty } from "lodash-es";
import { backupIfExists } from "../core/backup.mjs";
import { HOME } from "../core/paths.mjs";
import { updateSessionProgress } from "../core/session.mjs";
import { buildClaudeTasks } from "./execute/claude-tasks.mjs";
import { buildPluginTasks } from "./execute/install-plugin.mjs";
import { buildZshTasks } from "./execute/install-zsh.mjs";

/**
 * 執行安裝計畫
 *
 * @param {Object} plan - generateInstallPlan 產出
 * @param {Object} opts
 * @param {string} opts.repoDir - @ab-tao/dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview 路徑
 * @param {Object} opts.targets - config.json targets 定義
 * @param {Object|null} opts.prev - session
 * @param {Object|null} opts.pipelineResult
 * @param {Object|null} opts.fetchedSources
 * @returns {Promise<Object>} { installSelections, syncResult, startTime }
 */
export async function phaseExecute(
	plan,
	{ repoDir, previewDir, targets, prev, pipelineResult, fetchedSources },
) {
	const isManual = plan.mode === "manual";
	const features = new Set(plan.features || ["claude", "slack", "zsh"]);
	const has = (f) => features.has(f);
	const startTime = Date.now();

	await updateSessionProgress({
		lastPhase: "execute",
		completedTargets: [],
		pendingTargets: plan.targets,
	});

	// 共享狀態
	const installSelections = {};
	const shared = { syncResult: null };

	// 子模組傳參
	const commonOpts = {
		repoDir,
		previewDir,
		targets,
		prev,
		pipelineResult,
		fetchedSources,
		isManual,
		installSelections,
		shared,
	};

	// 構建子模組任務
	const claudeTasks = buildClaudeTasks(plan, commonOpts);
	const pluginTasks = buildPluginTasks(plan, { repoDir });
	const zshTasks = buildZshTasks(plan, commonOpts);

	const tasks = new Listr(
		[
			// [0] 統一備份（Claude + ZSH 一次完成）
			{
				title: "🗂️ 備份現有配置 → dist/backup/",
				task: async (_, subtask) => {
					const cd = path.join(HOME, ".claude");
					const feats = new Set(plan.features || []);
					const has = (f) => feats.has(f);
					const backupTasks = [
						// Claude 配置（僅選了 claude 或 slack 時備份）
						...(has("claude") || has("slack")
							? [
									...["commands", "agents", "rules"].map((sub) =>
										backupIfExists(path.join(cd, sub), `claude/${sub}`),
									),
									backupIfExists(
										path.join(cd, "hooks.json"),
										"claude/hooks.json",
									),
									backupIfExists(
										path.join(cd, "settings.json"),
										"claude/settings.json",
									),
								]
							: []),
						// ZSH 配置（僅選了 zsh 時備份）
						...(has("zsh")
							? [
									backupIfExists(path.join(HOME, ".zshrc"), "zshrc"),
									backupIfExists(path.join(HOME, ".zshrc.d"), "zshrc.d"),
									backupIfExists(path.join(HOME, ".ripgreprc"), "ripgreprc"),
								]
							: []),
					];
					const results = (await Promise.all(backupTasks)).filter(Boolean);
					subtask.output = !isEmpty(results)
						? `已備份 ${results.length} 項：${results.join("、")}`
						: "無需備份";
				},
			},

			// ── 並行安裝：Branch A（Claude）、Branch B（Plugin）、Branch C（ZSH）──
			{
				task: (_, outerTask) => {
					// 確保 syncResult 在並行任務開始前已初始化（避免 undefined 競爭）
					shared.syncResult = null;
					return outerTask.newListr(
						[...claudeTasks, ...pluginTasks, ...zshTasks],
						{
							concurrent: true,
							exitOnError: false,
						},
					);
				},
			},

			// [1] 官方 Plugins 安裝（plan.plugins 由 phasePlan 選擇）
			{
				title: `🔌 官方 Plugins（${plan.plugins?.length || 0}）`,
				enabled: () => !isEmpty(plan.plugins),
				task: async (_, subtask) => {
					const MARKETPLACE_REPO = "anthropics/claude-plugins-official";
					// 確保 marketplace 已加入
					try {
						const out = execSync("claude plugin marketplace list --json", {
							stdio: ["pipe", "pipe", "pipe"],
							timeout: 10000,
						}).toString();
						const list = JSON.parse(out);
						if (!list.some((m) => m.repo === MARKETPLACE_REPO)) {
							execSync(`claude plugin marketplace add ${MARKETPLACE_REPO}`, {
								stdio: ["pipe", "pipe", "pipe"],
								timeout: 120000,
							});
						}
					} catch {
						subtask.output = "marketplace 加入失敗，跳過";
						return;
					}
					const installed = [];
					const failed = [];
					for (const name of plan.plugins) {
						try {
							execSync(
								`claude plugin install ${name}@claude-plugins-official`,
								{ stdio: ["pipe", "pipe", "pipe"], timeout: 60000 },
							);
							installed.push(name);
						} catch {
							failed.push(name);
						}
					}
					const parts = [];
					if (installed.length) parts.push(`✔ ${installed.length} 個已安裝`);
					if (failed.length) parts.push(`✘ ${failed.length} 個失敗`);
					subtask.output = parts.join(" · ") || "完成";
					// 記錄到 installSelections
					if (installed.length) installSelections.plugins = installed;
					if (failed.length) installSelections.pluginsFailed = failed;
				},
			},

			// [2] 驗證安裝完整性
			{
				title: "✅ 驗證",
				task: (_, task) =>
					task.newListr([
						{
							title: "🔍 驗證安裝完整性",
							task: async (_, subtask) => {
								let passed = 0;
								let total = 0;
								const missing = [];
								const checkDir = (dir, items, ext = ".md") => {
									for (const name of items) {
										total++;
										if (fs.existsSync(path.join(dir, `${name}${ext}`))) {
											passed++;
										} else {
											missing.push(name);
										}
									}
								};
								// Claude 檔案驗證（僅選了 claude 時）
								if (has("claude")) {
									if (installSelections.commands?.length)
										checkDir(
											path.join(HOME, ".claude/commands"),
											installSelections.commands,
										);
									if (installSelections.agents?.length)
										checkDir(
											path.join(HOME, ".claude/agents"),
											installSelections.agents,
										);
									if (installSelections.rules?.length)
										checkDir(
											path.join(HOME, ".claude/rules"),
											installSelections.rules,
										);
								}

								// 驗證 settings.json（有 Claude 或 Slack 才檢查）
								if (has("claude") || has("slack")) {
									if (fs.existsSync(path.join(HOME, ".claude/settings.json"))) {
										total++;
										passed++;
									} else {
										total++;
										missing.push("settings.json");
									}
								}
								// 驗證 hooks.json（有 Slack 才檢查）
								if (has("slack")) {
									if (fs.existsSync(path.join(HOME, ".claude/hooks.json"))) {
										total++;
										passed++;
									} else {
										total++;
										missing.push("hooks.json");
									}
								}

								if (!isEmpty(missing)) {
									subtask.output = `${passed}/${total} 就位，缺少：${missing.join("、")}`;
								} else {
									subtask.output = `${passed}/${total} 檔案全部就位 ✓`;
								}
							},
						},
					]),
			},
		],
		{
			concurrent: false,
			rendererOptions: {
				showTimer: true,
				collapseSubtasks: false,
				showSubtasks: true,
			},
		},
	);

	await tasks.run();

	return { installSelections, syncResult: shared.syncResult, startTime };
}
