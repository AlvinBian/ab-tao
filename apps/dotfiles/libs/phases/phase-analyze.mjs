/**
 * Phase: 自動分析
 *
 * Pipeline 分析 + Spotlight 偵測 + 計畫生成
 * 全部自動，不需用戶互動。
 *
 * 執行順序：
 *   1. 並行執行：repos fetch（AI 分析）+ 偵測本機路徑（fd/Spotlight）
 *   2. 產生開發者畫像（AI，依賴步驟 1 的 pipeline 結果）
 *   3. 呼叫 generateInstallPlan 組裝完整計畫
 */

import { Listr } from "listr2";
import { generateInstallPlan } from "../config/auto-plan.mjs";
import {
	AI_CONCURRENCY,
	AI_REPO_CACHE,
	AI_REPO_EFFORT,
	AI_REPO_MAX_CATEGORIES,
	AI_REPO_MAX_TECHS,
	AI_REPO_MODEL,
	AI_REPO_TIMEOUT,
} from "../core/constants.mjs";
import { detectLocalRepos } from "../detect/repo-detect.mjs";
import { runAnalysisPipeline } from "../pipeline/pipeline-runner.mjs";
import { generateProfile } from "../pipeline/profile-generator.mjs";

/**
 * 自動執行分析並生成安裝計畫
 *
 * 以 Listr2 顯示四個子任務的進度，完成後組裝 plan 物件。
 * 不需要任何用戶互動，適合全自動安裝模式。
 *
 * @param {Object} opts
 * @param {Object[]} opts.repos - 含 fullName/commits/pct 的完整 repo 物件陣列
 * @param {Object[]} opts.sources - AI 資源來源配置（來自 config.json）
 * @param {string} opts.baseDir - @ab-tao/dotfiles 根目錄（快取和審計儲存位置）
 * @param {Array} [opts.projectFolders] - 專案文件夾映射（name → localPath）
 * @returns {Promise<Object>} plan - 完整安裝計畫，附帶 _pipelineResult 和 _fetchedSources
 */
export async function phaseAnalyze({
	repos,
	sources,
	selectedAiSources = [],
	baseDir,
	projectFolders,
}) {
	let pipelineResult = null;
	let detectResult = { paths: {}, roleOverrides: {} };
	let profile = null;
	let aiResResult = { recommended: [] };

	const tasks = new Listr(
		[
			// ── 步驟 1：AI 分析 + 路徑偵測（並行，互不依賴）──
			{
				title: "🔍 Repos + AI 資源 / 偵測本機路徑",
				task: (_, task) =>
					task.newListr(
						[
							{
								title: "📡 Repos + AI 資源",
								task: async (_, subtask) => {
									pipelineResult = await runAnalysisPipeline({
										repos: repos.map((r) => r.fullName),
										sources,
										selectedAiSources,
										baseDir,
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

									// 提取預選技術棧
									const allTechs = [
										...(pipelineResult.categorizedTechs?.values() || []),
									].flatMap((m) => [...m.keys()]);
									pipelineResult.detectedSkills = allTechs;
									pipelineResult.preselectedTechs = allTechs;

									// AI 資源匹配（從 pipeline 結果取）
									if (pipelineResult.aiResAiPromise) {
										try {
											aiResResult = (await pipelineResult.aiResAiPromise) || {
												recommended: [],
											};
										} catch (e) {
											aiResResult = { recommended: [] };
											subtask.output = `AI 資源匹配失敗：${e.message?.slice(0, 40) || "未知錯誤"}`;
										}
									}

									subtask.output = `${repos.length} repos · ${allTechs.length} 技術棧 · ${aiResResult.recommended?.length || 0} AI 資源`;
								},
							},
							{
								title: "🗺️ 偵測本機路徑",
								task: async (_, subtask) => {
									detectResult = await detectLocalRepos(repos, projectFolders);
									const found = Object.keys(detectResult.paths).length;
									const methodLabel = {
										fd: "fd + git remote",
										folder: "文件夾映射",
										spotlight: "Spotlight",
									};
									subtask.output = `${found}/${repos.length} 找到（${methodLabel[detectResult.method] || "auto"}）`;
								},
							},
						],
						{ concurrent: true },
					),
			},
			// ── 步驟 2：開發者畫像（依賴 pipelineResult）──
			{
				title: "👤 開發者畫像",
				task: async (_, task) => {
					if (pipelineResult) {
						profile = await generateProfile(pipelineResult);
						task.output = profile?.role || "分析完成";
					}
				},
			},
			// ── 步驟 3：生成安裝計畫 ──
			{
				title: "📋 生成安裝計畫",
				task: async (_, task) => {
					task.output = "就緒";
				},
			},
		],
		{
			concurrent: false,
			exitOnError: false,
			rendererOptions: {
				showTimer: true,
				collapseSubtasks: false,
			},
		},
	);

	await tasks.run();

	// 所有子任務完成後，整合結果生成計畫
	const plan = generateInstallPlan({
		repos,
		pipelineResult,
		aiResResult,
		localPaths: detectResult.paths,
		roleOverrides: detectResult.roleOverrides,
		profile,
	});

	// 附帶 pipelineResult 供後續階段使用（phaseComplete 的報告、AI 資源融合等）
	plan._pipelineResult = pipelineResult;
	// 將 commons AI 來源附到 plan，供 phasePlan 逐來源確認
	plan._commonsResources = pipelineResult?.commonsResources || { sources: [] };
	const fetchResult = pipelineResult?.aiResFetchResult || null;
	// 建立 AI 資源 type map（name → commands/agents/rules），供 phasePlan 顯示分組用
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
		if (fetchResult) fetchResult.aiResTypeMap = aiResTypeMap;
	}
	plan._fetchedSources = fetchResult;

	return plan;
}
