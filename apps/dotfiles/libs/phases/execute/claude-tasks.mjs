/**
 * Branch A: Claude Code 開發配置 + 專案配置
 *
 * 包含：
 *   [1] 全局配置（settings + hooks dispatch）
 *   [2] Claude 安裝（commands + agents + rules）
 *   [3] 專案配置（AI 資源 + Stacks）
 *
 * 提供 3 個可獨立呼叫的函式：
 *   - deployGlobalConfig  — 部署 settings + commands/agents/rules/hooks
 *   - deploySlackHooks    — 部署 Slack hooks（.env + hooks.json 合併）
 *   - installAiResources  — 安裝外部 AI 資源 + Commons 資源
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isEmpty } from "lodash-es";
import { listrLogger } from "../../cli/logger.mjs";
import { HOME } from "../../core/paths.mjs";
import { deploySettings } from "../../deploy/deploy-global.mjs";
import {
	buildSyncResult,
	writeSkillFiles,
	writeSyncedFiles,
} from "../../external/source-sync.mjs";
import { runTarget } from "../../install/index.mjs";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 獨立可呼叫函式（不依賴 Listr）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 部署全局配置 — settings + commands/agents/rules/hooks
 *
 * 包含兩階段：
 *   1. 合併 settings.json（模型、權限、自動記憶）
 *   2. 透過 runTarget 安裝 commands / agents / rules / hooks
 *
 * @param {Object} opts
 * @param {string} opts.repoDir - dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview
 * @param {Object} opts.targets - config.json targets
 * @param {string|null} opts.model - 用戶選擇的 model
 * @param {boolean} opts.isManual - 是否手動模式
 * @param {Array} [opts.targetKeys] - plan.targets（要安裝的 target 清單）
 * @param {Array} [opts.techStacks] - plan.techStacks（技術棧 ID）
 * @param {Object|null} [opts.prev] - session（傳遞給 runTarget）
 * @param {Object} [opts.logger] - 外部 logger（可選，給 runTarget 使用）
 * @returns {Promise<Object>} installSelections - { commands, agents, rules, hooks }
 */
export async function deployGlobalConfig(opts) {
	const {
		repoDir,
		previewDir,
		targets,
		model,
		isManual,
		targetKeys = [],
		techStacks = [],
		prev = null,
		logger = null,
	} = opts;

	const installSelections = {};

	// ── 階段 1：合併 settings.json ──
	const templatePath = path.join(repoDir, "claude", "settings.template.json");
	if (fs.existsSync(templatePath)) {
		let template;
		try {
			template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
		} catch {
			// settings.template.json 格式錯誤，跳過設定部署
			template = null;
		}
		if (template) {
			deploySettings(template, { model: model ?? undefined });
		}
	}

	// ── 階段 2：runTarget 安裝 commands/agents/rules/hooks ──
	const completed = new Set();
	for (const key of targetKeys.filter((t) => t !== "zsh")) {
		if (!targets[key]) continue;
		const result = await runTarget(repoDir, previewDir, key, targets[key], {
			selectedTargets: targetKeys,
			completed,
			flagAll: true,
			manual: isManual,
			skillIds: techStacks,
			session: prev,
			logger,
		});
		if (result) Object.assign(installSelections, result);
		completed.add(key);
	}

	return installSelections;
}

/**
 * 部署 Slack hooks — .env + hooks.json 合併
 *
 * 包含三步驟：
 *   1. 複製 slack-dispatch.sh 到 ~/.claude/hooks/
 *   2. 合併 hooks-slack.json 到 settings.json
 *   3. 同步 Slack 設定到 ~/.claude/.env 與 settings.json
 *
 * prev 為 Slack 配置的唯一來源（由呼叫端提供），不再從 .env 檔案讀取。
 *
 * @param {Object} opts
 * @param {string} opts.repoDir - dotfiles 根目錄
 * @param {Object|null} opts.prev - Slack 配置值
 * @param {string} opts.prev.slackChannel - 頻道 ID
 * @param {string} [opts.prev.slackMode] - 通知模式（channel / dm）
 * @param {string} [opts.prev.slackUserId] - 使用者 ID
 * @param {string} [opts.prev.minSessionSecs] - 最小 session 秒數（預設 300）
 * @returns {Promise<void>}
 */
export async function deploySlackHooks(opts) {
	const { repoDir, prev } = opts;

	// ── 步驟 1：複製 slack-dispatch.sh ──
	const src = path.join(repoDir, "claude", "hooks", "slack-dispatch.sh");
	const destDir = path.join(HOME, ".claude", "hooks");
	const dest = path.join(destDir, "slack-dispatch.sh");
	if (fs.existsSync(src)) {
		fs.mkdirSync(destDir, { recursive: true });
		fs.copyFileSync(src, dest);
		fs.chmodSync(dest, 0o755);
	}

	// ── 步驟 2：合併 Slack hooks 到 settings.json ──
	const slackHooksPath = path.join(repoDir, "claude", "hooks-slack.json");
	if (fs.existsSync(slackHooksPath)) {
		const settingsPath = path.join(HOME, ".claude", "settings.json");
		let settings = {};
		try {
			settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
		} catch {
			/* 略 */
		}
		const slackHooks = JSON.parse(
			fs.readFileSync(slackHooksPath, "utf8"),
		).hooks;
		if (!settings.hooks) settings.hooks = {};
		for (const [event, newMatchers] of Object.entries(slackHooks)) {
			if (!settings.hooks[event]) {
				settings.hooks[event] = newMatchers;
			} else {
				const existingCmds = new Set(
					settings.hooks[event].flatMap((m) =>
						(m.hooks || []).map((h) => h.command || ""),
					),
				);
				for (const m of newMatchers) {
					const cmds = (m.hooks || []).map((h) => h.command || "");
					if (cmds.some((c) => !existingCmds.has(c)))
						settings.hooks[event].push(m);
				}
			}
		}
		fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
	}

	// ── 步驟 3：使用 prev 值同步 Slack 設定到 ~/.claude/.env 和 settings.json ──
	const channel = prev?.slackChannel ?? "";
	const mode = prev?.slackMode ?? "";
	const userId = prev?.slackUserId ?? "";
	const minSession = prev?.minSessionSecs ?? "300";
	if (channel) {
		// 寫 ~/.claude/.env（供 commands / hooks 讀取）
		const claudeEnvPath = path.join(HOME, ".claude", ".env");
		let content = fs.existsSync(claudeEnvPath)
			? fs.readFileSync(claudeEnvPath, "utf8")
			: "";
		content = content
			.replace(/^SLACK_[A-Z_]+=.*/gm, "") // 清除所有 SLACK_ 開頭變數
			.replace(/^CLAUDE_SLACK_MIN_SESSION_SECS=.*/gm, "") // 清除 session 閾值（重寫）
			.replace(/\n{3,}/g, "\n\n")
			.trim();
		content += `\nSLACK_NOTIFY_CHANNEL=${channel}\nSLACK_NOTIFY_MODE=${mode}\n`;
		if (userId) content += `SLACK_NOTIFY_USER_ID=${userId}\n`;
		content += `CLAUDE_SLACK_MIN_SESSION_SECS=${minSession}\n`;
		fs.writeFileSync(claudeEnvPath, content);
		// 寫 ~/.claude/settings.json env（讓 Claude session 直接取得變數）
		const settingsPath = path.join(HOME, ".claude", "settings.json");
		let settings = {};
		try {
			settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
		} catch {
			/* 檔案不存在或格式錯誤則略過，使用空物件 */
		}
		settings.env = {
			...settings.env,
			SLACK_NOTIFY_CHANNEL: channel,
			SLACK_NOTIFY_MODE: mode,
			...(userId && {
				SLACK_NOTIFY_USER_ID: userId,
			}),
		};
		fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
	}
}

/**
 * 安裝 AI 資源 — 外部源融合 + Commons 安裝
 *
 * 包含三部分：
 *   1. 外部 AI 資源融合（buildSyncResult + writeSyncedFiles）
 *   2. Commons 資源逐來源安裝（含 commands/agents/rules）
 *   3. Skills 安裝（writeSkillFiles）
 *
 * @param {Object} opts
 * @param {string} opts.repoDir - dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview
 * @param {Object} opts.plan - 含 aiRes, commonsSelections, techStacks
 * @param {Object|null} opts.pipelineResult - 含 commonsResources
 * @param {Object|null} opts.fetchedSources - fetchAllSources 結果
 * @param {boolean} opts.isManual
 * @returns {Promise<Object>} { installSelections, syncResult, commonsSummary }
 */
export async function installAiResources(opts) {
	const { previewDir, plan, pipelineResult, fetchedSources, isManual } = opts;

	const installSelections = {};
	let syncResult = null;

	// ── 部分 1：外部 AI 資源融合 ──
	if ((plan.aiRes?.length ?? 0) > 0 && !isEmpty(fetchedSources?.sources)) {
		const aiResTypeMap = fetchedSources.aiResTypeMap || {};
		const aiResByType = {
			commands: new Set(),
			agents: new Set(),
			rules: new Set(),
		};
		for (const name of plan.aiRes) {
			const type = aiResTypeMap[name.replace(".md", "")] || "commands";
			aiResByType[type]?.add(name);
		}
		syncResult = buildSyncResult(fetchedSources, aiResByType);
		const claudePreview = path.join(previewDir, "claude");
		await writeSyncedFiles(syncResult.downloaded, claudePreview);
		if (!isManual)
			await writeSyncedFiles(syncResult.downloaded, path.join(HOME, ".claude"));
		// 更新 installSelections 以反映 AI 資源安裝
		for (const [type, names] of Object.entries(aiResByType)) {
			for (const name of names) {
				const n = name.replace(".md", "");
				if (!installSelections[type]) installSelections[type] = [];
				if (!installSelections[type].includes(n))
					installSelections[type].push(n);
			}
		}
	}

	// ── 部分 2 & 3：Commons 資源 + Skills 安裝 ──
	const commSources = pipelineResult?.commonsResources?.sources || [];
	if (!isEmpty(commSources)) {
		const validFile = (f) => f?.name && f.content;
		const selections = plan.commonsSelections || {};
		const filterBySelection = (items, srcName, type) => {
			const sel = selections[srcName]?.[type];
			if (!sel) return items.filter(validFile);
			const nameSet = new Set(sel);
			return items
				.filter(validFile)
				.filter((f) => nameSet.has(f.name.replace(".md", "")));
		};
		const downloaded = commSources.map((src) => ({
			source: src.name,
			commands: filterBySelection(src.commands || [], src.name, "commands"),
			agents: filterBySelection(src.agents || [], src.name, "agents"),
			rules: filterBySelection(src.rules || [], src.name, "rules"),
			hooks: null,
		}));
		const claudePreview = path.join(previewDir, "claude");
		await writeSyncedFiles(downloaded, claudePreview);
		if (!isManual) {
			await writeSyncedFiles(downloaded, path.join(HOME, ".claude"));
		}

		// 安裝 skills（SKILL.md 格式，按用戶選擇過濾）
		// 注意：writeSkillFiles 使用 src.source 作為目錄名，commons 物件用 src.name
		const skillSources = commSources
			.map((s) => {
				const sel = selections[s.name]?.skills;
				const filtered = sel
					? s.skills.filter((sk) => new Set(sel).has(sk.name))
					: s.skills;
				return { ...s, source: s.name, skills: filtered || [] };
			})
			.filter((s) => !isEmpty(s.skills));
		if (!isEmpty(skillSources)) {
			await writeSkillFiles(skillSources, path.join(previewDir, "claude"));
			if (!isManual) {
				await writeSkillFiles(skillSources, path.join(HOME, ".claude"));
			}
		}

		// 更新 installSelections 以反映實際安裝
		for (const d of downloaded) {
			for (const cmd of d.commands || []) {
				const n = cmd.name.replace(".md", "");
				if (!installSelections.commands) installSelections.commands = [];
				if (!installSelections.commands.includes(n))
					installSelections.commands.push(n);
			}
			for (const a of d.agents || []) {
				const n = a.name.replace(".md", "");
				if (!installSelections.agents) installSelections.agents = [];
				if (!installSelections.agents.includes(n))
					installSelections.agents.push(n);
			}
			for (const r of d.rules || []) {
				const n = r.name.replace(".md", "");
				if (!installSelections.rules) installSelections.rules = [];
				if (!installSelections.rules.includes(n))
					installSelections.rules.push(n);
			}
		}
		for (const s of skillSources) {
			for (const sk of s.skills || []) {
				if (!installSelections.skills) installSelections.skills = [];
				if (!installSelections.skills.includes(sk.name))
					installSelections.skills.push(sk.name);
			}
		}
	}

	// 彙總 commons 安裝摘要（供呼叫端顯示，避免重複讀取 pipelineResult）
	const commonsSummary = {
		sourceCount: commSources.length,
		totalResources: commSources.reduce(
			(s, src) =>
				s +
				(src.commands?.length ?? 0) +
				(src.agents?.length ?? 0) +
				(src.rules?.length ?? 0) +
				(src.skills?.length ?? 0),
			0,
		),
	};

	return { installSelections, syncResult, commonsSummary };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Listr 包裝層（向後相容）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 構建 Claude 安裝任務陣列
 *
 * 內部委託給 deployGlobalConfig / deploySlackHooks / installAiResources，
 * 保留原有 Listr 任務結構以維持 phaseExecute 相容性。
 *
 * @param {Object} plan - generateInstallPlan 產出
 * @param {Object} opts
 * @param {string} opts.repoDir - @ab-tao/dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview 路徑
 * @param {Object} opts.targets - config.json targets 定義
 * @param {Object|null} opts.prev - session
 * @param {Object|null} opts.pipelineResult
 * @param {Object|null} opts.fetchedSources
 * @param {boolean} opts.isManual - 是否手動模式
 * @param {Object} opts.installSelections - 共享狀態（寫入）
 * @param {Object} opts.shared - 共享狀態物件 { syncResult }（寫入）
 * @returns {Array} Listr2 task 陣列
 */
export function buildClaudeTasks(
	plan,
	{
		repoDir,
		previewDir,
		targets,
		prev,
		pipelineResult,
		fetchedSources,
		isManual,
		installSelections,
		shared,
	},
) {
	// 預先提取 plan 屬性，避免子任務回呼透過閉包直接存取 plan 物件
	const features = new Set(plan.features || ["claude", "slack", "zsh"]);
	const has = (f) => features.has(f);
	const planModel = plan.model ?? null;
	const planTargets = plan.targets || [];
	const planTechStacks = plan.techStacks || [];
	const planAiRes = plan.aiRes || [];
	const planAiResCount = planAiRes.length;
	const planTechStacksCount = planTechStacks.length;

	return [
		// Branch A: Claude Code 開發配置 + 專案配置（順序執行，共用 ~/.claude/）
		{
			title: "🤖 Claude Code + 📁 專案配置",
			enabled: () =>
				has("claude") || has("slack") || has("claudemd") || has("project"),
			task: (_, branchTask) =>
				branchTask.newListr(
					[
						// ━━━ Group 1: Claude Code 開發配置 ━━━
						{
							title: "🤖 Claude Code 開發配置",
							enabled: () => has("claude") || has("slack"),
							task: (_, task) =>
								task.newListr(
									[
										// [1] 全局配置（settings + hooks dispatch）
										{
											title: "⚙️ 全局配置 → ~/.claude/",
											task: (_, subtask) =>
												subtask.newListr([
													{
														title: "⚙️ settings.json — 合併權限、模型與自動記憶",
														task: async (_, sub) => {
															// 實際部署由 deployGlobalConfig 統一處理（避免重複呼叫 deploySettings）
															const templatePath = path.join(
																repoDir,
																"claude",
																"settings.template.json",
															);
															if (fs.existsSync(templatePath)) {
																sub.output =
																	"將由 Claude 安裝步驟統一部署 settings";
															} else {
																sub.skip("settings.template.json 不存在");
															}
														},
													},
													{
														title: "hooks/slack-dispatch.sh — Slack 通知分發器",
														enabled: () => has("slack"),
														task: async (_, sub) => {
															// 委託給 deploySlackHooks
															await deploySlackHooks({ repoDir, prev });
															// 回報狀態（判斷來源檔案是否存在）
															const src = path.join(
																repoDir,
																"claude",
																"hooks",
																"slack-dispatch.sh",
															);
															if (fs.existsSync(src)) {
																sub.output = "已安裝 → ~/.claude/hooks/";
															} else {
																sub.skip("來源檔案不存在");
															}
														},
													},
												]),
										},

										// [2] Claude 安裝（commands + agents + rules + hooks → ~/.claude/）
										{
											title:
												"📦 Claude 安裝 → ~/.claude/commands + agents + rules + hooks",
											enabled: () => has("claude"),
											task: async (_, subtask) => {
												// 委託給 deployGlobalConfig 中的 runTarget 邏輯
												const taskLogger = listrLogger(subtask);
												const result = await deployGlobalConfig({
													repoDir,
													previewDir,
													targets,
													model: planModel,
													isManual,
													targetKeys: planTargets,
													techStacks: planTechStacks,
													prev,
													logger: taskLogger,
												});
												Object.assign(installSelections, result);
												const parts = [];
												if (installSelections.commands?.length)
													parts.push(
														`${installSelections.commands.length} commands`,
													);
												if (installSelections.agents?.length)
													parts.push(
														`${installSelections.agents.length} agents`,
													);
												if (installSelections.rules?.length)
													parts.push(`${installSelections.rules.length} rules`);
												if (installSelections.hooks?.length)
													parts.push(`${installSelections.hooks.length} hooks`);
												subtask.output = parts.join(" · ") || "完成";
											},
										},
									],
									{ concurrent: false },
								),
						},

						// ━━━ Group 2: 專案配置（repos + AI）━━━
						{
							title: "📁 專案配置（repos + AI）",
							enabled: () => has("claudemd") || has("project"),
							task: (_, task) =>
								task.newListr(
									[
										// [3] AI 資源 + 技術棧 Stacks
										{
											title: `🌐 AI 資源（${planAiResCount}）+ Stacks（${planTechStacksCount}）`,
											enabled: () =>
												has("project") &&
												(planAiResCount > 0 || planTechStacksCount > 0),
											task: (_, subtask) =>
												subtask.newListr(
													[
														{
															title: `🌐 AI 資源融合 — ${planAiResCount} 個外部 commands/agents/rules`,
															task: async (_, sub) => {
																// 委託給 installAiResources
																try {
																	const aiResult = await installAiResources({
																		repoDir,
																		previewDir,
																		plan,
																		pipelineResult,
																		fetchedSources,
																		isManual,
																	});
																	// 回寫共享狀態
																	if (aiResult.syncResult)
																		shared.syncResult = aiResult.syncResult;
																	for (const [type, names] of Object.entries(
																		aiResult.installSelections,
																	)) {
																		if (!installSelections[type])
																			installSelections[type] = [];
																		for (const n of names) {
																			if (!installSelections[type].includes(n))
																				installSelections[type].push(n);
																		}
																	}

																	// 組合輸出訊息（使用 aiResult.commonsSummary，避免直接存取閉包 pipelineResult）
																	const msgParts = [];
																	const added =
																		aiResult.syncResult?.downloaded?.length ||
																		0;
																	if (added > 0)
																		msgParts.push(`AI 資源已融合 ${added} 個`);
																	const { sourceCount, totalResources } =
																		aiResult.commonsSummary;
																	if (sourceCount > 0) {
																		msgParts.push(
																			`已安裝 ${sourceCount} 個 AI 來源（${totalResources} 個資源）`,
																		);
																	}
																	sub.output =
																		msgParts.join(" · ") || "無 AI 資源";
																} catch (err) {
																	sub.output = `AI 資源安裝失敗（${err.message?.slice(0, 60)}）`;
																}
															},
														},
														{
															title: `🧬 Stacks 生成（${planTechStacksCount} 個技術棧）`,
															task: async (_, sub) => {
																if (planTechStacksCount > 0) {
																	try {
																		await new Promise((resolve, reject) => {
																			const child = spawn(
																				"node",
																				[
																					"bin/scan.mjs",
																					"--init",
																					"--no-ai",
																					"--skills",
																					planTechStacks.join(","),
																				],
																				{ cwd: repoDir },
																			);
																			child.on("close", (code) => {
																				if (code === 0) resolve();
																				else
																					reject(
																						new Error(`scan.mjs exit ${code}`),
																					);
																			});
																			child.on("error", reject);
																		});
																		sub.output = `已生成 ${planTechStacksCount} 個技術棧規則`;
																	} catch (e) {
																		sub.output = `生成失敗：${e.message?.slice(0, 50) || "未知錯誤"}`;
																		throw e;
																	}
																}
															},
														},
													],
													{ concurrent: true, exitOnError: false },
												),
										},
									],
									{ concurrent: false },
								),
						},
					],
					{ concurrent: false },
				),
		},
	];
}
