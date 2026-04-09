/**
 * Tech Analysis Feature — 技術棧分析 pipeline（內部功能，不顯示於選單）
 *
 * 執行分析 pipeline 產生技術棧、開發者畫像、AI 資源候選清單。
 * 本身不安裝任何東西（data-only），結果由 project-install 透過 ctx.deps["tech-analysis"] 消費。
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { BACK, handleCancel } from "../cli/prompts.mjs";
import {
	AI_CONCURRENCY,
	AI_REPO_CACHE,
	AI_REPO_EFFORT,
	AI_REPO_MAX_CATEGORIES,
	AI_REPO_MAX_TECHS,
	AI_REPO_MODEL,
	AI_REPO_TIMEOUT,
} from "../core/constants.mjs";
import { runAnalysisPipeline } from "../pipeline/pipeline-runner.mjs";
import { generateProfile } from "../pipeline/profile-generator.mjs";

export default {
	id: "tech-analysis",
	label: "🔬 技術分析",
	hint: "技術棧 · AI 分析 · 開發者畫像",
	dependsOn: ["repos"],
	conflicts: [],

	/**
	 * 1. 環境檢查 — 分析不需要額外工具（repos 已檢查過 GitHub CLI）
	 */
	async envCheck() {
		return { ok: true, message: "🔬 分析 pipeline 就緒" };
	},

	/**
	 * 2. 備份 — 純資料功能，無需備份
	 */
	async backup() {
		return { files: [], dir: "" };
	},

	/**
	 * 3. 互動配置 — 從 deps.repos 取得 repos，並讓使用者選擇 AI 來源
	 */
	async configure(ctx) {
		const reposDep = ctx.deps?.repos;
		if (!reposDep?.repos?.length) {
			p.log.warn("沒有可分析的 repos，跳過技術分析");
			return null;
		}

		const depsRepos = reposDep.repos;
		const sources = reposDep.sources || [];

		// Quick 模式仍需執行分析，但跳過 AI 來源互動選擇
		if (ctx.flags?.quick) {
			return {
				repos: depsRepos,
				sources: ctx.sources || [],
				selectedAiSources: ctx.prev?.selectedAiSources || [],
			};
		}

		// AI 來源互動選擇
		const { selectAiSources } = await import(
			"../external/ai-source-select.mjs"
		);
		const selected = await selectAiSources();
		if (selected === BACK) return null;

		return {
			repos: depsRepos,
			sources,
			selectedAiSources: selected || [],
		};
	},

	/**
	 * 4. 生成計畫 — 執行分析 pipeline（核心重邏輯）
	 *
	 * 呼叫 runAnalysisPipeline 取得技術棧分類，
	 * 等待 AI 資源匹配結果，產生開發者畫像。
	 * 錯誤時提供重試 / 跳過 / 返回選項。
	 */
	async plan(ctx, config) {
		if (!config) return null;

		const { repos, sources, selectedAiSources } = config;

		/** 嘗試執行分析（支援重試） */
		const attemptAnalysis = async () => {
			let pipelineResult = null;
			let profile = null;
			let aiResResult = { recommended: [] };

			// ── 執行分析 pipeline ──
			const spinner = p.spinner();
			spinner.start(`分析 ${repos.length} 個 repos 的技術棧（約 10–30 秒）...`);

			pipelineResult = await runAnalysisPipeline({
				repos: repos.map((r) => r.fullName),
				sources,
				selectedAiSources,
				baseDir: ctx.repoDir,
				aiConfig: {
					model: AI_REPO_MODEL,
					effort: AI_REPO_EFFORT,
					timeout: AI_REPO_TIMEOUT,
					maxCategories: AI_REPO_MAX_CATEGORIES,
					maxTechs: AI_REPO_MAX_TECHS,
					cacheEnabled: AI_REPO_CACHE,
					concurrency: AI_CONCURRENCY,
				},
				onPhase: () => {},
				onRepoProgress: () => {},
			});

			// 提取所有偵測到的技術棧
			const allTechs = [
				...(pipelineResult.categorizedTechs?.values() || []),
			].flatMap((m) => [...m.keys()]);
			pipelineResult.detectedSkills = allTechs;
			pipelineResult.preselectedTechs = allTechs;

			spinner.stop(
				`分析完成：${repos.length} repos · ${allTechs.length} 技術棧`,
			);

			// ── 等待 AI 資源匹配（非阻塞 promise）──
			if (pipelineResult.aiResAiPromise) {
				const aiSpinner = p.spinner();
				aiSpinner.start("AI 資源匹配中...");
				try {
					aiResResult = (await pipelineResult.aiResAiPromise) || {
						recommended: [],
					};
					aiSpinner.stop(
						`AI 資源匹配完成：${aiResResult.recommended?.length || 0} 個候選`,
					);
				} catch (e) {
					aiResResult = { recommended: [] };
					aiSpinner.stop(
						pc.yellow(
							`AI 資源匹配失敗：${e.message?.slice(0, 40) || "未知錯誤"}`,
						),
					);
				}
			}

			// ── 開發者畫像 ──
			if (pipelineResult) {
				try {
					profile = await generateProfile(pipelineResult);
				} catch {
					profile = null;
				}
			}

			// ── 組裝 fetchedSources 與 AI 資源 type map ──
			const fetchResult = pipelineResult?.aiResFetchResult || null;
			if (fetchResult?.sources) {
				const aiResTypeMap = {};
				for (const src of fetchResult.sources) {
					for (const f of src.allFiles?.commands || [])
						aiResTypeMap[f.name.replace(".md", "")] = "commands";
					for (const f of src.allFiles?.agents || [])
						aiResTypeMap[f.name.replace(".md", "")] = "agents";
					for (const f of src.allFiles?.rules || [])
						aiResTypeMap[f.name.replace(".md", "")] = "rules";
				}
				fetchResult.aiResTypeMap = aiResTypeMap;
			}

			return {
				techStacks: allTechs,
				profile: profile
					? { role: profile.role, coreSkills: profile.coreSkills }
					: null,
				pipelineResult,
				fetchedSources: fetchResult,
				aiResResult,
				repos,
				selectedAiSources,
			};
		};

		// ── 錯誤處理迴圈（重試 / 跳過 / 返回）──
		while (true) {
			try {
				return await attemptAnalysis();
			} catch (err) {
				p.log.error(
					`❌ 分析失敗（${err.message}）\n   提示：檢查網路連線（GitHub API）或執行 pnpm run d:doctor 診斷環境`,
				);
				const action = handleCancel(
					await p.select({
						message: "如何繼續？",
						options: [
							{ value: "retry", label: "🔄 重試", hint: "重新執行分析" },
							{
								value: "skip",
								label: "⏭️ 跳過",
								hint: "跳過 AI 分析，使用空結果",
							},
							{ value: "back", label: "← 上一步", hint: "返回上一步" },
						],
					}),
				);

				if (action === "back" || action === BACK) return null;
				if (action === "skip") {
					// 跳過分析，返回空殼結果
					return {
						techStacks: [],
						profile: null,
						pipelineResult: null,
						fetchedSources: null,
						aiResResult: { recommended: [] },
						repos,
						selectedAiSources,
					};
				}
				// action === 'retry' → 繼續迴圈
			}
		}
	},

	/**
	 * 5. 確認 — 顯示分析摘要，使用者確認或跳過
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		const techCount = plan.techStacks?.length || 0;
		const aiCount = plan.aiResResult?.recommended?.length || 0;
		const profileRole = plan.profile?.role || "未偵測";

		// 組裝技術棧分類摘要
		const categories = new Set();
		if (plan.pipelineResult?.categorizedTechs) {
			for (const key of plan.pipelineResult.categorizedTechs.keys()) {
				categories.add(key);
			}
		}

		const lines = [
			`技術分析結果（${plan.repos.length} repos）`,
			`  技術棧：${techCount} 項${categories.size ? `（${categories.size} 分類）` : ""}`,
			`  AI 資源候選：${aiCount} 項`,
			`  開發者角色：${profileRole}`,
		];

		if (plan.profile?.coreSkills?.length) {
			lines.push(
				`  核心技能：${plan.profile.coreSkills.slice(0, 5).join("、")}`,
			);
		}

		p.log.info(lines.join("\n"));

		const ok = handleCancel(
			await p.confirm({
				message: "確認分析結果？",
				initialValue: true,
			}),
		);

		return ok === true;
	},

	/**
	 * 6. 安裝 — 純資料功能，無需安裝
	 */
	async install() {
		return null;
	},

	/**
	 * 7. 驗證 — 純資料功能，無需驗證
	 */
	async verify() {
		return { passed: 0, total: 0, missing: [] };
	},

	/**
	 * 8. 完成輸出 — 顯示分析結果摘要
	 */
	complete(results) {
		if (!results) return [];
		const repoCount = results.repos?.length || 0;
		const techCount = results.techStacks?.length || 0;
		const aiCount = results.aiResResult?.recommended?.length || 0;
		return [
			`🔬 技術分析`,
			`  ${repoCount} repos · ${techCount} 技術棧 · ${aiCount} AI 資源候選`,
		];
	},

	/**
	 * 9. 回滾 — 純資料功能，無需回滾
	 */
	async rollback() {},

	/**
	 * 10. Session 數據 — 保存分析快照供後續使用
	 */
	session(results) {
		if (!results) return {};
		return {
			techStacks: results.techStacks || [],
			profileRole: results.profile?.role || null,
			aiResCandidateCount: results.aiResResult?.recommended?.length || 0,
			selectedAiSources: results.selectedAiSources || [],
			analyzedAt: new Date().toISOString(),
		};
	},

	/**
	 * 11. 清理 — 無暫存資源需清理
	 */
	async cleanup() {},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		if (!results) return { feature: "tech-analysis" };
		return {
			feature: "tech-analysis",
			techStacks: results.techStacks || [],
			profile: results.profile || null,
			aiResCandidates: results.aiResResult?.recommended?.length || 0,
			repos: results.repos?.map((r) => r.fullName) || [],
		};
	},
};
