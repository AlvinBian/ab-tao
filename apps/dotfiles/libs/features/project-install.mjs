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
import {
	formatClaudeMd,
	formatTechStacks,
	formatUnifiedAiResources,
} from "../cli/plan-view.mjs";
import { BACK, handleCancel, smartSelect } from "../cli/prompts.mjs";
import { generateInstallPlan } from "../config/auto-plan.mjs";
import { getDescription, getRating } from "../config/descriptions.mjs";
import { HOME } from "../core/paths.mjs";

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

		// 從 repos 依賴取得本機路徑映射與角色覆寫
		const reposDep = ctx.deps?.repos;
		const localPaths = {};
		if (reposDep?.repos) {
			for (const r of reposDep.repos) {
				if (r.localPath) localPaths[r.fullName] = r.localPath;
			}
		}
		// 優先使用使用者確認的角色（repos feature 產出），避免因 commit 數為 0 全部誤判為「臨時」
		const roleOverrides = reposDep?.roles || null;

		if (ctx.flags?.quick) {
			// 從 session 重建計畫，跳過互動
			const plan = generateInstallPlan({
				repos,
				pipelineResult,
				aiResResult,
				localPaths,
				roleOverrides,
				profile: dep.profile || null,
			});

			// 還原上次的 skills 選擇，避免 --quick 安裝所有 skills
			const prevCommons = ctx.prev?.installCommonsSelections;
			if (prevCommons && Object.keys(prevCommons).length > 0) {
				plan.commonsSelections = prevCommons;
			}

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
			roleOverrides,
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
	 * 5. 確認 — 新流程：技術棧 → CLAUDE.md → 星級閾值 → 統一 AI 資源 → 安裝方式 → 分類調整
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		const claudeDir = path.join(HOME, ".claude");
		const commSources = plan._commonsResources?.sources || [];

		// ── Step 1: 技術棧 ──
		const techLines = formatTechStacks(plan);
		if (techLines.length) {
			p.log.info(techLines.join("\n"));
		}

		// ── Step 2: CLAUDE.md ──
		const mdLines = formatClaudeMd(plan);
		if (mdLines.length) {
			p.log.info(mdLines.join("\n"));
		}

		// ── Step 3: 星級閾值選擇 ──
		const thresholdOptions = [
			{ value: 5, label: "★★★★★ 只選最高品質", hint: "推薦" },
			{ value: 4, label: "★★★★☆ 四星以上" },
			{ value: 3, label: "★★★☆☆ 三星以上" },
			{ value: 2, label: "★★☆☆☆ 二星以上" },
			{ value: 1, label: "★☆☆☆☆ 一星以上" },
			{ value: 0, label: "全部預選" },
		];

		const minStars = handleCancel(
			await p.select({
				message: "◆ AI 資源預選門檻（按星級篩選）",
				options: thresholdOptions,
				initialValue: 5,
			}),
		);

		if (minStars === BACK) return false;

		// ── 收集並組織統一資源 ──
		const unified = { commands: [], agents: [], rules: [], skills: [] };
		const itemsMap = {}; // 用於去重

		// 外部資源
		const aiResTypeMap = plan._fetchedSources?.aiResTypeMap || {};
		for (const name of plan.aiRes || []) {
			const clean = name.replace(".md", "");
			const type =
				aiResTypeMap[clean] ||
				(fs.existsSync(path.join(claudeDir, "agents", `${clean}.md`))
					? "agents"
					: null) ||
				(fs.existsSync(path.join(claudeDir, "rules", `${clean}.md`))
					? "rules"
					: null) ||
				"commands";

			const rating = getRating(clean, type) || 0;
			const desc = getDescription(clean, type, claudeDir);
			const key = `${type}:${clean}`;

			itemsMap[key] = {
				name: clean,
				source: "ecc",
				type,
				rating,
				desc,
				isPreselected: rating >= minStars,
			};
		}

		// Commons 資源
		for (const src of commSources) {
			for (const type of ["commands", "agents", "rules"]) {
				for (const item of src[type] || []) {
					const clean = item.name?.replace(".md", "") || item;
					const rating = getRating(clean, type) || 0;
					const desc = getDescription(clean, type, claudeDir);
					const key = `${type}:${clean}`;

					if (itemsMap[key] && itemsMap[key].rating >= rating) continue;

					itemsMap[key] = {
						name: clean,
						source: src.name,
						type,
						rating,
						desc,
						isPreselected: rating >= minStars,
					};
				}
			}

			// Skills
			for (const sk of src.skills || []) {
				const name = typeof sk === "string" ? sk : sk.name;
				const rating = getRating(name, "skills") || 0;
				const transDesc = getDescription(name, "skills", null);
				const desc = transDesc || "";
				const key = `skills:${name}`;

				if (itemsMap[key] && itemsMap[key].rating >= rating) continue;

				itemsMap[key] = {
					name,
					source: src.name,
					type: "skills",
					rating,
					desc,
					isPreselected: rating >= minStars,
				};
			}
		}

		// 按類型分組
		for (const key of Object.keys(itemsMap)) {
			const item = itemsMap[key];
			if (!unified[item.type]) unified[item.type] = [];
			unified[item.type].push(item);
		}

		// 每個類型按星級降序排序
		for (const type of Object.keys(unified)) {
			unified[type].sort((a, b) => b.rating - a.rating);
		}

		// ── 初始化選擇（基於星級閾值）──
		const selected = {
			commands: new Set(),
			agents: new Set(),
			rules: new Set(),
			skills: new Set(),
		};

		for (const type of Object.keys(unified)) {
			for (const item of unified[type]) {
				if (item.isPreselected) {
					selected[type].add(item.name);
				}
			}
		}

		// ── Step 4: 顯示統一 AI 資源 ──
		const unifiedLines = formatUnifiedAiResources(
			plan,
			claudeDir,
			selected,
			minStars,
		);
		if (unifiedLines.length) {
			p.log.info(unifiedLines.join("\n"));
		}

		// ── Step 5: 安裝方式選擇 ──
		const action = handleCancel(
			await p.select({
				message: "◆ AI 資源安裝方式",
				options: [
					{
						value: "confirm",
						label: "確認安裝預選項目",
						hint: "推薦",
					},
					{
						value: "adjust",
						label: "調整選擇",
						hint: "按分類微調",
					},
					{
						value: "skip",
						label: "跳過 AI 資源",
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

		// ── Step 6: 分類調整流程（若選擇「調整選擇」）──
		if (action === "adjust") {
			let adjusting = true;
			while (adjusting) {
				// 計算各分類的選中 / 可用數量
				const categoryCounts = {
					commands: [selected.commands.size, unified.commands.length],
					agents: [selected.agents.size, unified.agents.length],
					rules: [selected.rules.size, unified.rules.length],
					skills: [selected.skills.size, unified.skills.length],
				};

				const categoryOptions = [
					...(unified.commands.length > 0
						? [
								{
									value: "commands",
									label: `Commands（${categoryCounts.commands[0]} 個已選 / ${categoryCounts.commands[1]} 個可用）`,
								},
							]
						: []),
					...(unified.agents.length > 0
						? [
								{
									value: "agents",
									label: `Agents（${categoryCounts.agents[0]} 個已選 / ${categoryCounts.agents[1]} 個可用）`,
								},
							]
						: []),
					...(unified.rules.length > 0
						? [
								{
									value: "rules",
									label: `Rules（${categoryCounts.rules[0]} 個已選 / ${categoryCounts.rules[1]} 個可用）`,
								},
							]
						: []),
					...(unified.skills.length > 0
						? [
								{
									value: "skills",
									label: `Skills（${categoryCounts.skills[0]} 個已選 / ${categoryCounts.skills[1]} 個可用）`,
								},
							]
						: []),
					{
						value: "done",
						label: "← 返回確認",
					},
				];

				const categoryToAdjust = handleCancel(
					await p.select({
						message: "◆ 調整哪個分類？",
						options: categoryOptions,
					}),
				);

				if (categoryToAdjust === BACK) return false;

				if (categoryToAdjust === "done") {
					adjusting = false;
					break;
				}

				// 該分類的項目轉成選擇選項
				const categoryItems = unified[categoryToAdjust];
				const categorySelected = selected[categoryToAdjust];
				const items = categoryItems.map((item) => ({
					value: item.name,
					label: item.name,
					hint: item.desc ? item.desc.slice(0, 40) : "",
				}));

				const preselected = Array.from(categorySelected);
				const selectedInCategory = await smartSelect({
					title: `調整 ${categoryToAdjust}`,
					items,
					preselected,
					autoSelectThreshold: 0,
				});

				if (selectedInCategory === BACK) {
					// 返回分類選擇菜單
					continue;
				}

				// 更新該分類的選擇
				selected[categoryToAdjust] = new Set(selectedInCategory);
			}

			// 重新顯示統一 AI 資源，反映調整後的選擇
			const updatedLines = formatUnifiedAiResources(
				plan,
				claudeDir,
				selected,
				minStars,
			);
			if (updatedLines.length) {
				p.log.info(updatedLines.join("\n"));
			}
		}

		// ── Step 7: 最終確認 ──
		const confirmed = handleCancel(
			await p.confirm({
				message: "確認安裝？",
				initialValue: true,
			}),
		);

		if (confirmed !== true) return false;

		// ── Step 8: 寫回選擇到 plan ──

		// 外部資源（aiRes）
		plan.aiRes = [
			...selected.commands,
			...selected.agents,
			...selected.rules,
		].filter((name) =>
			(plan.aiRes || []).some((n) => n.replace(".md", "") === name),
		);

		// Commons 資源選擇
		plan.commonsSelections = {};
		for (const src of commSources) {
			const srcSelections = {
				commands: [],
				agents: [],
				rules: [],
				skills: [],
			};

			for (const type of ["commands", "agents", "rules", "skills"]) {
				const srcItems = type === "skills" ? src.skills || [] : src[type] || [];
				for (const item of srcItems) {
					const name = (item.name?.replace(".md", "") || item).replace(
						".md",
						"",
					);
					if (!selected[type].has(name)) continue;
					// Skills dedup：只寫入 itemsMap 中勝出的來源，避免同名 skill 多來源安裝
					if (type === "skills") {
						const winner = itemsMap[`skills:${name}`];
						if (winner && winner.source !== src.name) continue;
					}
					srcSelections[type].push(name);
				}
			}

			plan.commonsSelections[src.name] = srcSelections;
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
			skillsSkipped: result.installSelections?.skillsSkipped || [],
			skillsFailed: result.installSelections?.skillsFailed || [],
			commonsSelections: plan.commonsSelections || {}, // 供 --quick 回放 skills 選擇
		};
	},

	/**
	 * 7. 驗證 — 核對實際安裝的 AI 資源是否存在於 ~/.claude/
	 *   有 installSelections → 逐項核對（精確模式）
	 *   無 installSelections → 目錄非空檢查（fallback 模式）
	 */
	async verify(_ctx, installResult) {
		const claudeDir = path.join(HOME, ".claude");
		let passed = 0;
		let total = 0;
		const missing = [];

		const sel = installResult?.installSelections;
		const hasSelections =
			sel &&
			typeof sel === "object" &&
			(sel.commands?.length ?? 0) +
				(sel.agents?.length ?? 0) +
				(sel.rules?.length ?? 0) +
				(sel.skills?.length ?? 0) >
				0;

		if (hasSelections) {
			// ── 精確模式：逐項核對 ──
			// commands → ~/.claude/commands/{name}.md
			for (const name of sel.commands || []) {
				total++;
				if (fs.existsSync(path.join(claudeDir, "commands", `${name}.md`))) {
					passed++;
				} else {
					missing.push(`commands/${name}.md`);
				}
			}
			// agents → ~/.claude/agents/{name}.md
			for (const name of sel.agents || []) {
				total++;
				if (fs.existsSync(path.join(claudeDir, "agents", `${name}.md`))) {
					passed++;
				} else {
					missing.push(`agents/${name}.md`);
				}
			}
			// rules → ~/.claude/rules/{name}.md（flat 結構）
			for (const name of sel.rules || []) {
				total++;
				if (fs.existsSync(path.join(claudeDir, "rules", `${name}.md`))) {
					passed++;
				} else {
					missing.push(`rules/${name}.md`);
				}
			}
			// skills → ~/.claude/skills/{name}/SKILL.md（含 .disabled）
			for (const name of sel.skills || []) {
				total++;
				const skillBase = path.join(claudeDir, "skills", name);
				if (
					fs.existsSync(path.join(skillBase, "SKILL.md")) ||
					fs.existsSync(path.join(skillBase, "SKILL.md.disabled"))
				) {
					passed++;
				} else {
					missing.push(`skills/${name}/SKILL.md`);
				}
			}
		} else {
			// ── Fallback 模式：目錄非空檢查 ──
			const cmdsDir = path.join(claudeDir, "commands");
			total++;
			if (fs.existsSync(cmdsDir) && fs.readdirSync(cmdsDir).length > 0) {
				passed++;
			} else {
				missing.push("commands/");
			}

			const agentsDir = path.join(claudeDir, "agents");
			total++;
			if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length > 0) {
				passed++;
			} else {
				missing.push("agents/");
			}
		}

		// 統計已安裝的 skills 數量（二層結構：skills/{name}/SKILL.md）
		const skillsDir = path.join(claudeDir, "skills");
		let skillCount = 0;
		if (fs.existsSync(skillsDir)) {
			function countSkillLeafs(dir, depth) {
				if (depth > 3) return;
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const e of entries) {
					if (!e.isDirectory()) continue;
					const sub = path.join(dir, e.name);
					if (
						fs.existsSync(path.join(sub, "SKILL.md")) ||
						fs.existsSync(path.join(sub, "SKILL.md.disabled"))
					) {
						skillCount++;
					} else {
						countSkillLeafs(sub, depth + 1);
					}
				}
			}
			countSkillLeafs(skillsDir, 0);
		}

		return { passed, total, missing, skillCount };
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

		if ((results.installSelections?.skills?.length || 0) > 0) {
			lines.push("  💡 Skills 在對話中輸入相關任務描述即可自動觸發");
		}

		if (results.skillsFailed?.length > 0) {
			lines.push(
				`  ⚠ ${results.skillsFailed.length} 個 skills 寫入失敗（可重新執行 d:setup 修復）`,
			);
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
