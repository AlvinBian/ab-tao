/**
 * Branch A: Claude Code 開發配置 + 專案配置
 *
 * 包含：
 *   [1] 全局配置（settings + hooks dispatch）
 *   [2] Claude 安裝（commands + agents + rules）
 *   [3] 專案配置（ECC + Stacks + CLAUDE.md）
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isEmpty } from "lodash-es";
import { listrLogger } from "../../cli/logger.mjs";
import { HOME } from "../../core/paths.mjs";
import { deploySettings } from "../../deploy/deploy-global.mjs";
import { deployAllProjectClaudeMd } from "../../deploy/deploy-project.mjs";
import { generateClaudeMd } from "../../deploy/generate-claude-md.mjs";
import {
	buildSyncResult,
	writeSkillFiles,
	writeSyncedFiles,
} from "../../external/source-sync.mjs";
import { runTarget } from "../../install/index.mjs";

/**
 * 構建 Claude 安裝任務陣列
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
	const features = new Set(
		plan.features || ["claude", "claudemd", "ecc", "slack", "zsh"],
	);
	const has = (f) => features.has(f);

	return [
		// Branch A: Claude Code 開發配置 + 專案配置（順序執行，共用 ~/.claude/）
		{
			title: "🤖 Claude Code + 📁 專案配置",
			enabled: () =>
				has("claude") || has("slack") || has("claudemd") || has("ecc"),
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
															const templatePath = path.join(
																repoDir,
																"claude",
																"settings.template.json",
															);
															if (fs.existsSync(templatePath)) {
																let template;
																try {
																	template = JSON.parse(
																		fs.readFileSync(templatePath, "utf8"),
																	);
																} catch {
																	sub.output =
																		"settings.template.json 格式錯誤，跳過設定部署";
																	return;
																}
																const result = deploySettings(template);
																sub.output =
																	result.permissionsAdded > 0
																		? `新增 ${result.permissionsAdded} 條 permission 規則`
																		: "permissions 已是最新";
															}
														},
													},
													{
														title: "hooks/slack-dispatch.sh — Slack 通知分發器",
														enabled: () => has("slack"),
														task: async (_, sub) => {
															const src = path.join(
																repoDir,
																"claude",
																"hooks",
																"slack-dispatch.sh",
															);
															const destDir = path.join(
																HOME,
																".claude",
																"hooks",
															);
															const dest = path.join(
																destDir,
																"slack-dispatch.sh",
															);
															if (fs.existsSync(src)) {
																fs.mkdirSync(destDir, {
																	recursive: true,
																});
																fs.copyFileSync(src, dest);
																fs.chmodSync(dest, 0o755);
																sub.output = "已安裝 → ~/.claude/hooks/";
															} else {
																sub.skip("來源檔案不存在");
															}
															// 同步 Slack 設定到 ~/.claude/.env 和 settings.json
															const repoEnv = path.join(repoDir, ".env");
															if (fs.existsSync(repoEnv)) {
																const repoEnvContent = fs.readFileSync(
																	repoEnv,
																	"utf8",
																);
																const channel =
																	repoEnvContent.match(
																		/^SLACK_NOTIFY_CHANNEL=(.*)$/m,
																	)?.[1] ?? "";
																const mode =
																	repoEnvContent.match(
																		/^SLACK_NOTIFY_MODE=(.*)$/m,
																	)?.[1] ?? "";
																const channelName =
																	repoEnvContent.match(
																		/^SLACK_NOTIFY_CHANNEL_NAME=(.*)$/m,
																	)?.[1] ?? "";
																const userId =
																	repoEnvContent.match(
																		/^SLACK_NOTIFY_USER_ID=(.*)$/m,
																	)?.[1] ?? "";
																if (channel) {
																	// 寫 ~/.claude/.env（供 commands / hooks 讀取）
																	const claudeEnvPath = path.join(
																		HOME,
																		".claude",
																		".env",
																	);
																	let content = fs.existsSync(claudeEnvPath)
																		? fs.readFileSync(claudeEnvPath, "utf8")
																		: "";
																	content = content
																		.replace(/^SLACK_[A-Z_]+=.*/gm, "") // 清除所有 SLACK_ 開頭變數
																		.replace(
																			/^CLAUDE_SLACK_MIN_SESSION_SECS=.*/gm,
																			"",
																		) // 清除 session 閾值（重寫）
																		.replace(/\n{3,}/g, "\n\n")
																		.trim();
																	const minSession =
																		repoEnvContent.match(
																			/^CLAUDE_SLACK_MIN_SESSION_SECS=(.*)$/m,
																		)?.[1] ?? "300";
																	content += `\nSLACK_NOTIFY_CHANNEL=${channel}\nSLACK_NOTIFY_MODE=${mode}\n`;
																	if (channelName)
																		content += `SLACK_NOTIFY_CHANNEL_NAME=${channelName}\n`;
																	if (userId)
																		content += `SLACK_NOTIFY_USER_ID=${userId}\n`;
																	content += `CLAUDE_SLACK_MIN_SESSION_SECS=${minSession}\n`;
																	fs.writeFileSync(claudeEnvPath, content);
																	// 寫 ~/.claude/settings.json env（讓 Claude session 直接取得變數）
																	const settingsPath = path.join(
																		HOME,
																		".claude",
																		"settings.json",
																	);
																	let settings = {};
																	try {
																		settings = JSON.parse(
																			fs.readFileSync(settingsPath, "utf8"),
																		);
																	} catch {
																		/* 檔案不存在或格式錯誤則略過，使用空物件 */
																	}
																	settings.env = {
																		...settings.env,
																		SLACK_NOTIFY_CHANNEL: channel,
																		SLACK_NOTIFY_MODE: mode,
																		...(channelName && {
																			SLACK_NOTIFY_CHANNEL_NAME: channelName,
																		}),
																		...(userId && {
																			SLACK_NOTIFY_USER_ID: userId,
																		}),
																	};
																	fs.writeFileSync(
																		settingsPath,
																		`${JSON.stringify(settings, null, 2)}\n`,
																	);
																}
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
												const completed = new Set();
												const taskLogger = listrLogger(subtask);
												for (const key of (plan.targets || []).filter(
													(t) => t !== "zsh",
												)) {
													if (!targets[key]) continue;
													const result = await runTarget(
														repoDir,
														previewDir,
														key,
														targets[key],
														{
															selectedTargets: plan.targets,
															completed,
															flagAll: true,
															manual: isManual,
															skillIds: plan.techStacks,
															session: prev,
															logger: taskLogger,
														},
													);
													if (result) Object.assign(installSelections, result);
													completed.add(key);
												}
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
							enabled: () => has("claudemd") || has("ecc"),
							task: (_, task) =>
								task.newListr(
									[
										// [3] AI 外部資源 + 技術棧 Stacks
										{
											title: `🌐 AI 資源（${plan.ecc?.length ?? 0}）+ Stacks（${plan.techStacks?.length ?? 0}）`,
											enabled: () =>
												has("ecc") &&
												((plan.ecc?.length ?? 0) > 0 ||
													(plan.techStacks?.length ?? 0) > 0),
											task: (_, subtask) =>
												subtask.newListr(
													[
														{
															title: `🌐 AI 資源融合 — ${plan.ecc?.length ?? 0} 個外部 commands/agents/rules`,
															task: async (_, sub) => {
																if (
																	(plan.ecc?.length ?? 0) > 0 &&
																	!isEmpty(fetchedSources?.sources)
																) {
																	try {
																		const eccTypeMap =
																			fetchedSources.eccTypeMap || {};
																		const eccByType = {
																			commands: new Set(),
																			agents: new Set(),
																			rules: new Set(),
																		};
																		for (const name of plan.ecc) {
																			const type =
																				eccTypeMap[name.replace(".md", "")] ||
																				"commands";
																			eccByType[type]?.add(name);
																		}
																		shared.syncResult = buildSyncResult(
																			fetchedSources,
																			eccByType,
																		);
																		const claudePreview = path.join(
																			previewDir,
																			"claude",
																		);
																		await writeSyncedFiles(
																			shared.syncResult.downloaded,
																			claudePreview,
																		);
																		let skipped = [];
																		if (!isManual)
																			skipped = await writeSyncedFiles(
																				shared.syncResult.downloaded,
																				path.join(HOME, ".claude"),
																			);
																		const added =
																			shared.syncResult.downloaded?.length || 0;
																		sub.output = skipped.length
																			? `ECC 已融合 ${added} 個（跳過 ${skipped.length} 個自訂）`
																			: `ECC 已融合 ${added} 個`;
																	} catch (eccErr) {
																		sub.output = `ECC 融合失敗（${eccErr.message?.slice(0, 60)}）`;
																	}
																}

																// 安裝 commons 篩選後的資源（技術棧匹配）
																const commSources =
																	pipelineResult?.commonsResources?.sources ||
																	[];
																if (!isEmpty(commSources))
																	try {
																		// 過濾掉 name 或 content 為空的資源
																		const validFile = (f) =>
																			f?.name && f.content;
																		const downloaded = commSources.map(
																			(src) => ({
																				source: src.name,
																				commands: (src.commands || []).filter(
																					validFile,
																				),
																				agents: (src.agents || []).filter(
																					validFile,
																				),
																				rules: (src.rules || []).filter(
																					validFile,
																				),
																				hooks: null,
																			}),
																		);
																		const claudePreview = path.join(
																			previewDir,
																			"claude",
																		);
																		await writeSyncedFiles(
																			downloaded,
																			claudePreview,
																		);
																		if (!isManual) {
																			await writeSyncedFiles(
																				downloaded,
																				path.join(HOME, ".claude"),
																			);
																		}

																		// 安裝 skills（SKILL.md 格式）
																		const skillSources = commSources.filter(
																			(s) => !isEmpty(s.skills),
																		);
																		if (!isEmpty(skillSources)) {
																			await writeSkillFiles(
																				skillSources,
																				path.join(previewDir, "claude"),
																			);
																			if (!isManual) {
																				await writeSkillFiles(
																					skillSources,
																					path.join(HOME, ".claude"),
																				);
																			}
																		}

																		const commTotal = commSources.reduce(
																			(s, src) =>
																				s +
																				src.commands.length +
																				src.agents.length +
																				src.rules.length +
																				src.skills.length,
																			0,
																		);
																		sub.output = `${sub.output || ""}${sub.output ? " · " : ""}已安裝 ${commSources.length} 個 AI 來源（${commTotal} 個資源）`;
																	} catch (commErr) {
																		sub.output = `${sub.output || ""}${sub.output ? " · " : ""}commons 安裝失敗（${commErr.message?.slice(0, 60)}）`;
																	}
																if (!sub.output) sub.output = "無 AI 資源";
															},
														},
														{
															title: `🧬 Stacks 生成（${plan.techStacks?.length ?? 0} 個技術棧）`,
															task: async (_, sub) => {
																if ((plan.techStacks?.length ?? 0) > 0) {
																	try {
																		await new Promise((resolve, reject) => {
																			const child = spawn(
																				"node",
																				[
																					"bin/scan.mjs",
																					"--init",
																					"--no-ai",
																					"--skills",
																					plan.techStacks.join(","),
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
																		sub.output = `已生成 ${plan.techStacks?.length ?? 0} 個技術棧規則`;
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

										// [4] CLAUDE.md 生成 → ~/.claude/projects/
										{
											title: `📝 CLAUDE.md → ~/.claude/projects/（${plan.projects?.length ?? 0} 個 repo）`,
											enabled: () =>
												has("claudemd") &&
												(plan.projects?.length ?? 0) > 0 &&
												!isManual,
											task: async (_, subtask) => {
												const aiWarnings = [];
												const items = await Promise.all(
													(plan.projects || []).map(async (proj) => {
														const perRepo =
															pipelineResult?.perRepo instanceof Map
																? pipelineResult.perRepo.get(proj.repo)
																: null;
														const content = await generateClaudeMd({
															repoName: proj.repo,
															role: proj.role,
															reasoning: perRepo?.reasoning || "",
															stacks: perRepo?.techStacks || {},
															meta: { description: "" },
															onWarn: (msg) => aiWarnings.push(msg),
														});
														return {
															localPath: proj.localPath,
															content,
															repo: proj.repo,
														};
													}),
												);
												const result = deployAllProjectClaudeMd(items);
												const parts = [];
												if (result.deployed.length)
													parts.push(
														`已生成：${result.deployed.map((r) => r.split("/").pop()).join("、")}`,
													);
												if (result.repoDeployed.length)
													parts.push(
														`寫入 repo 根目錄：${result.repoDeployed.map((r) => r.split("/").pop()).join("、")}`,
													);
												if (result.claudeignoreCount > 0)
													parts.push(
														`.claudeignore：${result.claudeignoreCount} 個 repo`,
													);
												if (result.skipped.length)
													parts.push(`跳過：${result.skipped.join("、")}`);
												if (aiWarnings.length)
													parts.push(
														`⚠️ ${aiWarnings.length} 個 AI 生成失敗（靜態模板替代）`,
													);
												subtask.output = parts.join("\n") || "無需生成";
											},
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
