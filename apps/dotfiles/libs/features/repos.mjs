/**
 * Repos Feature — 倉庫選擇 + 角色分類 + 本機路徑偵測
 *
 * 內部功能（visible: false），不在使用者選單中顯示。
 * 由 project-install / tech-analysis 透過依賴鏈自動拉入。
 *
 * 純資料功能 — 只選取 repos、指派角色、偵測本機路徑，不安裝任何檔案。
 * 結果透過 ctx.deps.repos 供下游 feature 消費。
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 */

import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import { countBy, isEmpty } from "lodash-es";
import pc from "picocolors";
import { BACK, handleCancel, smartSelect } from "../cli/prompts.mjs";

/** 角色排序權重 */
const ROLE_ORDER = { main: 0, temp: 1, tool: 2 };

/** 角色圖示對照 */
const ROLE_ICON = { main: "⭐", temp: "🔄", tool: "🔧" };

/** 角色中文標籤 */
const ROLE_LABEL = { main: "主力", temp: "臨時", tool: "工具" };

/**
 * 降級映射 — 使用者從某角色移除 repo 時，自動降級到哪個角色
 * main → temp、temp → tool、tool → temp
 */
const DEMOTE_MAP = { main: "temp", temp: "tool", tool: "temp" };

export default {
	id: "repos",
	label: "📁 Repos 選擇",
	hint: "組織 · repos · 角色分配",
	dependsOn: [],
	conflicts: [],

	/**
	 * 1. 環境檢查 — 確認 gh CLI 已安裝且已登入
	 */
	async envCheck() {
		const checks = [];
		let ok = true;

		// gh CLI 安裝
		try {
			execSync("which gh", { stdio: "pipe" });
			checks.push("gh CLI ✔");
		} catch {
			checks.push("gh CLI ✗（brew install gh）");
			ok = false;
		}

		// gh 登入狀態
		if (ok) {
			try {
				execSync("gh auth status", {
					stdio: ["pipe", "pipe", "pipe"],
				});
				checks.push("gh 登入 ✔");
			} catch {
				checks.push("gh 登入 ✗（gh auth login）");
				ok = false;
			}
		}

		return { ok, message: `📁 ${checks.join(" · ")}` };
	},

	/**
	 * 2. 備份 — 無需備份（純資料功能）
	 */
	async backup() {
		return { files: [], dir: "" };
	},

	/**
	 * 3. 互動配置 — 選擇倉庫 + 角色分類
	 *
	 * 流程：
	 *   a) 呼叫 interactiveRepoSelect 選擇 repos
	 *   b) 用 determineRole 自動分類角色
	 *   c) 顯示角色分配，讓使用者確認或調整
	 */
	async configure(ctx) {
		if (ctx.flags?.quick) {
			// 從 session 重建 repos
			const prevRepos = ctx.prev?.repos;
			const prevRoles = ctx.prev?.roles || {};
			if (!prevRepos?.length) return null;
			const repos = prevRepos.map((r) => ({
				fullName: typeof r === "string" ? r : r.fullName || r,
				commits: 10,
				pct: 0,
				_roleOverride:
					prevRoles[typeof r === "string" ? r : r.fullName] || "temp",
			}));
			return { repos, roles: prevRoles };
		}

		const { interactiveRepoSelect } = await import("../detect/repo-select.mjs");
		const { determineRole } = await import("../config/config-classifier.mjs");

		// — a) 選擇倉庫 —
		const repos = await interactiveRepoSelect(ctx.prev);

		if (repos === BACK || isEmpty(repos)) {
			return null;
		}

		// — b) 自動角色分類（session 優先） —
		const roles = {};
		for (const r of repos) {
			roles[r.fullName] = ctx.prev?.roles?.[r.fullName] || determineRole(r);
		}

		// --all 模式跳過互動
		if (ctx.flags?.all) {
			return { repos, roles };
		}

		// — c) 角色分類互動迴圈 —
		let roleConfirmed = false;
		while (!roleConfirmed) {
			// 計算各角色數量
			const roleCounts = countBy(Object.values(roles));
			const mc = roleCounts.main || 0;
			const tc = roleCounts.temp || 0;
			const toolc = roleCounts.tool || 0;

			// 按組織分組，組內按角色排序
			const byOrg = {};
			for (const r of repos) {
				const org = r.fullName.split("/")[0];
				if (!byOrg[org]) byOrg[org] = [];
				byOrg[org].push(r);
			}
			for (const org of Object.keys(byOrg)) {
				byOrg[org].sort(
					(a, b) =>
						(ROLE_ORDER[roles[a.fullName]] ?? 9) -
						(ROLE_ORDER[roles[b.fullName]] ?? 9),
				);
			}

			// 組裝摘要行
			const summaryLines = [];
			for (const [org, orgRepos] of Object.entries(byOrg)) {
				summaryLines.push(`  ${org}`);
				for (const r of orgRepos) {
					const icon = ROLE_ICON[roles[r.fullName]] || "🔄";
					summaryLines.push(`    ${icon} ${r.fullName.split("/")[1]}`);
				}
			}

			p.log.info(
				[
					`角色分配（${mc} ⭐ 主力 · ${tc} 🔄 臨時${toolc ? ` · ${toolc} 🔧 工具` : ""}）`,
					"  角色決定每個 repo 會安裝哪種 CLAUDE.md：",
					"  ⭐ 主力 — 完整 AI 分析 + 技術棧感知 CLAUDE.md（每天在用的主力 repo）",
					"  🔄 臨時 — 精簡 CLAUDE.md，無 AI 分析（偶爾開啟的 repo）",
					"  🔧 工具 — 最小配置，僅基礎 context（依賴庫、腳手架等工具 repo）",
					"",
					...summaryLines,
				].join("\n"),
			);

			// 角色調整選單
			const action = handleCancel(
				await p.select({
					message: "角色分配",
					options: [
						{ value: "confirm", label: "✅ 確認 繼續安裝" },
						{
							value: "main",
							label: "⭐ 調整主力 完整 CLAUDE.md + AI 生成",
						},
						{
							value: "temp",
							label: "🔄 調整臨時 精簡 CLAUDE.md",
						},
						{
							value: "tool",
							label: "🔧 調整工具 最小配置",
						},
						{ value: "back", label: "← 上一步" },
					],
				}),
			);

			if (action === BACK || action === "back") {
				return null; // 返回上一步
			}

			if (action === "confirm") {
				roleConfirmed = true;
				break;
			}

			// 調整某個角色：選中 = 歸入該角色，未選 = 保持原角色
			const targetRole = action;
			const items = repos.map((r) => ({
				value: r.fullName,
				label:
					r.commits > 0
						? `${r.fullName.split("/")[1]} — ${r.commits} commits`
						: r.fullName.split("/")[1],
			}));
			const currentInRole = repos
				.filter((r) => roles[r.fullName] === targetRole)
				.map((r) => r.fullName);
			const icon = ROLE_ICON[targetRole];
			const label = ROLE_LABEL[targetRole];

			const selected = await smartSelect({
				title: `${icon} ${label} repos`,
				items,
				preselected: currentInRole,
				autoSelectThreshold: 0,
			});
			if (selected === BACK) continue;

			// 選中的歸入 targetRole，從該角色移除的降級
			const selectedSet = new Set(selected);
			for (const r of repos) {
				if (selectedSet.has(r.fullName)) {
					roles[r.fullName] = targetRole;
				} else if (roles[r.fullName] === targetRole) {
					// 使用者明確移除，降級而非重新自動判定
					roles[r.fullName] = DEMOTE_MAP[targetRole];
				}
			}
		}

		return { repos, roles };
	},

	/**
	 * 4. 生成計畫 — 偵測本機路徑、組裝 repos 陣列與 projects
	 */
	async plan(ctx, config) {
		if (!config) return null;

		const { detectLocalRepos } = await import("../detect/repo-detect.mjs");
		const { getClaudeMdType } = await import("../config/config-classifier.mjs");

		const { repos, roles } = config;

		// 寫入角色到 repo 物件
		for (const r of repos) {
			r._roleOverride = roles[r.fullName];
		}

		// 偵測本機路徑
		const s = p.spinner();
		s.start("掃描本地 repos...");
		const detected = await detectLocalRepos(repos, ctx.projectFolders || []);
		s.stop(
			`偵測到 ${detected.paths ? Object.keys(detected.paths).length : 0} 個本地 repos`,
		);
		const localPaths = detected?.paths ?? {};

		// 組裝完整 repos 陣列（含角色 + 本機路徑）
		const reposWithMeta = repos.map((r) => ({
			...r,
			role: roles[r.fullName],
			localPath: localPaths[r.fullName] || null,
		}));

		// 計算各角色數量
		const roleCounts = countBy(reposWithMeta, "role");
		const mainCount = roleCounts.main || 0;
		const tempCount = roleCounts.temp || 0;
		const toolCount = roleCounts.tool || 0;

		// 組裝 projects（只有找到 localPath 的才生成 CLAUDE.md）
		const projects = reposWithMeta
			.filter((r) => r.localPath)
			.map((r) => ({
				repo: r.fullName,
				role: r.role,
				localPath: r.localPath,
				claudeMdType: getClaudeMdType(r.role),
			}));

		return {
			features: ["repos"],
			targets: ["repos"],
			repos: reposWithMeta,
			roles,
			localPaths,
			mainCount,
			tempCount,
			toolCount,
			projects,
		};
	},

	/**
	 * 5. 確認 — 顯示最終角色摘要
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		const { mainCount, tempCount, toolCount, projects } = plan;

		// 有本機路徑的 repos 摘要
		const localCount = projects.length;
		const remoteCount = plan.repos.length - localCount;

		const lines = [
			`${plan.repos.length} 個 repos（${mainCount} ⭐ 主力 · ${tempCount} 🔄 臨時${toolCount ? ` · ${toolCount} 🔧 工具` : ""}）`,
			`  本機偵測：${localCount} 個找到路徑${remoteCount ? `，${remoteCount} 個僅遠端` : ""}`,
		];

		if (localCount > 0) {
			lines.push(
				"",
				...projects.map(
					(proj) =>
						`  ${ROLE_ICON[proj.role]} ${proj.repo} → ${pc.dim(proj.localPath)}`,
				),
			);
		}

		p.log.info(lines.join("\n"));

		const ok = handleCancel(
			await p.confirm({
				message: "確認 repos 選擇？",
				initialValue: true,
			}),
		);

		return ok === true;
	},

	/**
	 * 6. 安裝 — 無操作（純資料功能）
	 */
	async install(_ctx, plan) {
		if (!plan) return null;
		// 資料已在 plan 階段準備完成，不需安裝任何檔案
		return {
			repos: plan.repos,
			roles: plan.roles,
			localPaths: plan.localPaths,
			mainCount: plan.mainCount,
			tempCount: plan.tempCount,
			toolCount: plan.toolCount,
			projects: plan.projects,
		};
	},

	/**
	 * 7. 驗證 — 無操作（純資料功能）
	 */
	async verify() {
		return { passed: 0, total: 0, missing: [] };
	},

	/**
	 * 8. 完成輸出
	 */
	complete(results) {
		if (!results) return [];
		const { repos, mainCount, tempCount } = results;
		return [
			`📁 Repos 選擇`,
			`  ${repos?.length || 0} repos（${mainCount} ⭐ 主力 · ${tempCount} 🔄 臨時）`,
		];
	},

	/**
	 * 9. 回滾 — 無操作（純資料功能，無檔案可回滾）
	 */
	async rollback() {},

	/**
	 * 10. Session 數據 — 保存選擇的 repos 與角色，供下次 session 使用
	 */
	session(results) {
		if (!results) return {};
		return {
			repos: results.repos?.map((r) => r.fullName) || [],
			roles: results.roles || {},
			localPaths: results.localPaths || {},
		};
	},

	/**
	 * 11. 清理 — 無操作
	 */
	async cleanup() {},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		if (!results) return { feature: "repos" };
		return {
			feature: "repos",
			repoCount: results.repos?.length || 0,
			mainCount: results.mainCount || 0,
			tempCount: results.tempCount || 0,
			toolCount: results.toolCount || 0,
			projectCount: results.projects?.length || 0,
		};
	},
};
