/**
 * Project Install Feature — AI 資源融合 + Commons 安裝 + CLAUDE.md 引導
 *
 * 依賴 tech-analysis 提供的分析結果，負責：
 *   1. AI 外部資源選擇與安裝（推薦的 commands/agents/rules）
 *   2. Commons 資源逐來源多選安裝（含 skills）
 *   3. CLAUDE.md 生成引導（提示使用者在各 repo 執行 /init）
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import {
	formatAiResResources,
	formatClaudeMd,
	formatCommonsResources,
	formatTechStacks,
} from "../cli/plan-view.mjs";
import { BACK, handleCancel, smartSelect } from "../cli/prompts.mjs";
import { generateInstallPlan } from "../config/auto-plan.mjs";
import { HOME } from "../core/paths.mjs";

/** AI 來源圖示對照 */
const SOURCE_ICONS = {
	ecc: "🌐",
	anthropic: "📚",
	superpowers: "🚀",
	"context-engineering": "🧠",
};

export default {
	id: "project-install",
	label: "📁 專案配置",
	hint: "repos + AI 資源 + 技術棧 + CLAUDE.md",
	dependsOn: ["tech-analysis"],
	conflicts: [],

	/**
	 * 1. 環境檢查 — AI 資源為附加安裝，無額外環境需求
	 */
	async envCheck() {
		return { ok: true, message: "📦 AI 資源安裝就緒" };
	},

	/**
	 * 2. 備份 — AI 資源為附加性質，不覆蓋既有檔案，無需備份
	 */
	async backup() {
		return { files: [], dir: "" };
	},

	/**
	 * 3. 互動配置 — 從 tech-analysis 依賴取得分析結果，生成安裝計畫
	 */
	async configure(ctx) {
		const dep = ctx.deps?.["tech-analysis"];
		if (!dep) {
			p.log.warn("缺少技術分析結果，跳過專案配置");
			return null;
		}

		const {
			pipelineResult,
			fetchedSources,
			aiResResult,
			techStacks,
			repos,
			selectedAiSources,
		} = dep;

		if (!repos?.length) {
			p.log.warn("沒有可配置的 repos，跳過專案配置");
			return null;
		}

		// 從 repos 依賴取得本機路徑映射
		const reposDep = ctx.deps?.repos;
		const localPaths = {};
		if (reposDep?.repos) {
			for (const r of reposDep.repos) {
				if (r.localPath) localPaths[r.fullName] = r.localPath;
			}
		}

		if (ctx.flags?.quick) {
			// 從 session 重建計畫，跳過互動
			const plan = generateInstallPlan({
				repos,
				pipelineResult,
				aiResResult,
				localPaths,
				roleOverrides: null,
				profile: dep.profile || null,
			});

			return {
				plan,
				pipelineResult,
				fetchedSources,
				aiResResult,
				techStacks,
				repos,
				selectedAiSources,
			};
		}

		// 生成完整安裝計畫以取得結構化資料
		const plan = generateInstallPlan({
			repos,
			pipelineResult,
			aiResResult,
			localPaths,
			roleOverrides: null,
			profile: dep.profile || null,
		});

		return {
			plan,
			pipelineResult,
			fetchedSources,
			aiResResult,
			techStacks,
			repos,
			selectedAiSources,
		};
	},

	/**
	 * 4. 生成計畫 — 從 config 建構安裝計畫物件
	 */
	async plan(_ctx, config) {
		if (!config) return null;

		const { plan, pipelineResult, fetchedSources } = config;

		return {
			aiRes: plan.aiRes || [],
			techStacks: plan.techStacks || [],
			repos: plan.repos || [],
			projects: plan.projects || [],
			commonsSelections: {},
			// 附帶 pipeline 資料供下游顯示與安裝使用
			_pipelineResult: pipelineResult,
			_fetchedSources: fetchedSources,
			_commonsResources: pipelineResult?.commonsResources || null,
		};
	},

	/**
	 * 5. 確認 — 顯示計畫摘要，使用者可選擇全裝 / 逐項確認 / 跳過
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		// ── 顯示計畫摘要 ──
		const summaryLines = [];

		const techLines = formatTechStacks(plan);
		if (techLines.length) summaryLines.push(...techLines);

		const claudeDir = path.join(HOME, ".claude");
		const aiLines = formatAiResResources(plan, claudeDir);
		if (aiLines.length) summaryLines.push(...aiLines);

		const commLines = formatCommonsResources(plan);
		if (commLines.length) summaryLines.push(...commLines);

		const mdLines = formatClaudeMd(plan);
		if (mdLines.length) summaryLines.push(...mdLines);

		if (summaryLines.length) {
			p.log.info(summaryLines.join("\n"));
		}

		// ── 選擇安裝方式 ──
		const hasAiRes = !isEmpty(plan.aiRes);
		const commSources = plan._commonsResources?.sources || [];
		const hasCommons = !isEmpty(commSources);

		// 如果沒有可選項目，直接確認
		if (!hasAiRes && !hasCommons) {
			const ok = handleCancel(
				await p.confirm({
					message: "確認安裝？",
					initialValue: true,
				}),
			);
			return ok === true;
		}

		const action = handleCancel(
			await p.select({
				message: "AI 資源安裝方式",
				options: [
					{
						value: "all",
						label: "安裝全部",
						hint: "推薦",
					},
					{
						value: "detail",
						label: "逐項確認",
						hint: "手動選擇 AI 資源與 Commons",
					},
					{
						value: "skip",
						label: "跳過",
						hint: "不安裝 AI 資源",
					},
				],
			}),
		);

		if (action === BACK) return false;

		if (action === "skip") {
			plan.aiRes = [];
			plan.commonsSelections = {};
			return true;
		}

		if (action === "all") {
			return true;
		}

		// ── 逐項確認模式 ──

		// AI 外部資源選擇
		if (hasAiRes) {
			const aiItems = plan.aiRes.map((name) => ({
				value: name,
				label: name,
				hint: "",
			}));
			const selectedAiRes = await smartSelect({
				title: "🌐 AI 資源",
				items: aiItems,
				preselected: plan.aiRes,
				autoSelectThreshold: 0,
			});
			if (selectedAiRes === BACK) return false;
			plan.aiRes = selectedAiRes;
		}

		// Commons 資源逐來源多選
		if (hasCommons) {
			plan.commonsSelections = {};

			for (const src of commSources) {
				const icon = SOURCE_ICONS[src.name] || "📦";
				const types = [
					{ key: "commands", items: src.commands || [], label: "commands" },
					{ key: "agents", items: src.agents || [], label: "agents" },
					{ key: "rules", items: src.rules || [], label: "rules" },
					{ key: "skills", items: src.skills || [], label: "skills" },
				].filter((t) => t.items.length > 0);

				if (isEmpty(types)) continue;

				// 合併所有資源類型為一個選擇清單（帶類型前綴）
				const allItems = [];
				const allPreselected = [];
				for (const t of types) {
					for (const item of t.items) {
						const name = item.name?.replace(".md", "") || item.name;
						const key = `${t.key}:${name}`;
						allItems.push({
							value: key,
							label: name,
							hint: t.label,
						});
						allPreselected.push(key);
					}
				}

				const typeSummary = types
					.map((t) => `${t.items.length} ${t.label}`)
					.join(" · ");
				const selected = await smartSelect({
					title: `${icon} ${src.name}（${typeSummary}）`,
					items: allItems,
					preselected: allPreselected,
					autoSelectThreshold: 0,
				});
				if (selected === BACK) return false;

				// 解析選擇結果回各類型
				const selections = {
					commands: [],
					agents: [],
					rules: [],
					skills: [],
				};
				for (const key of selected) {
					const [type, ...nameParts] = key.split(":");
					const name = nameParts.join(":");
					if (selections[type]) selections[type].push(name);
				}
				plan.commonsSelections[src.name] = selections;
			}
		}

		return true;
	},

	/**
	 * 6. 安裝 — 委託給 installAiResources 執行融合與寫入
	 */
	async install(ctx, plan) {
		if (!plan) return null;

		const { installAiResources } = await import(
			"../phases/execute/claude-tasks.mjs"
		);

		const previewDir =
			ctx.previewDir ||
			path.join(ctx.repoDir, "dist", "preview", "project-install");

		const result = await installAiResources({
			repoDir: ctx.repoDir,
			previewDir,
			plan,
			pipelineResult: plan._pipelineResult,
			fetchedSources: plan._fetchedSources,
			isManual: ctx.flags?.manual || false,
		});

		return {
			installSelections: result.installSelections,
			syncResult: result.syncResult,
			repos: plan.repos,
			techStacks: plan.techStacks,
			projects: plan.projects,
			pipelineResult: plan._pipelineResult,
			selectedAiSources: plan._fetchedSources?.selectedSources || [],
		};
	},

	/**
	 * 7. 驗證 — 檢查是否有 AI 資源被寫入 ~/.claude/
	 */
	async verify() {
		const claudeDir = path.join(HOME, ".claude");
		let passed = 0;
		let total = 0;
		const missing = [];

		// 檢查 commands 目錄
		const cmdsDir = path.join(claudeDir, "commands");
		total++;
		if (fs.existsSync(cmdsDir) && fs.readdirSync(cmdsDir).length > 0) {
			passed++;
		} else {
			missing.push("commands/");
		}

		// 檢查 agents 目錄
		const agentsDir = path.join(claudeDir, "agents");
		total++;
		if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length > 0) {
			passed++;
		} else {
			missing.push("agents/");
		}

		return { passed, total, missing };
	},

	/**
	 * 8. 完成輸出 — 顯示安裝統計與 CLAUDE.md 引導
	 */
	complete(results) {
		if (!results) return [];
		const lines = [];

		lines.push("📦 專案配置");

		// 安裝統計
		const sel = results.installSelections || {};
		const counts = [];
		if (sel.commands?.length) counts.push(`${sel.commands.length} commands`);
		if (sel.agents?.length) counts.push(`${sel.agents.length} agents`);
		if (sel.rules?.length) counts.push(`${sel.rules.length} rules`);
		if (sel.skills?.length) counts.push(`${sel.skills.length} skills`);
		if (counts.length) {
			lines.push(`  已安裝：${counts.join(" · ")}`);
		} else {
			lines.push("  已安裝：無 AI 資源");
		}

		// 技術棧
		if (results.techStacks?.length) {
			lines.push(`  技術棧：${results.techStacks.length} 項`);
		}

		// CLAUDE.md 引導
		if (results.projects?.length) {
			lines.push(
				`  CLAUDE.md：執行 claude /init 在各 repo 中生成（${results.projects.length} 個專案）`,
			);
		}

		return lines;
	},

	/**
	 * 9. 回滾 — AI 資源為附加性質，回滾時清除已安裝的外部資源
	 */
	async rollback(ctx) {
		// 清理 preview 目錄即可；~/.claude 中的資源由使用者手動管理
		const previewDir =
			ctx.previewDir ||
			path.join(ctx.repoDir, "dist", "preview", "project-install");
		if (fs.existsSync(previewDir)) {
			fs.rmSync(previewDir, { recursive: true, force: true });
		}
	},

	/**
	 * 10. Session 數據 — 保存安裝快照
	 */
	session(results) {
		if (!results) return {};
		return {
			installSelections: results.installSelections || {},
			techStacks: results.techStacks || [],
			projectCount: results.projects?.length || 0,
			selectedAiSources: results.selectedAiSources || [],
			installedAt: new Date().toISOString(),
		};
	},

	/**
	 * 11. 清理 — 移除暫存的 preview 目錄
	 */
	async cleanup(ctx) {
		const previewDir =
			ctx.previewDir ||
			path.join(ctx.repoDir, "dist", "preview", "project-install");
		if (fs.existsSync(previewDir)) {
			fs.rmSync(previewDir, { recursive: true, force: true });
		}
	},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		if (!results) return { feature: "project-install" };
		const sel = results.installSelections || {};
		return {
			feature: "project-install",
			commands: sel.commands || [],
			agents: sel.agents || [],
			rules: sel.rules || [],
			skills: sel.skills || [],
			techStacks: results.techStacks || [],
			projects: results.projects?.map((proj) => proj.repo) || [],
		};
	},
};
