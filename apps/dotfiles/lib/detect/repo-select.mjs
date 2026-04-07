/**
 * GitHub 倉庫互動式選擇
 *
 * 職責：
 *   提供完整的互動流程讓用戶選擇 GitHub 倉庫：
 *   1. 檢查 gh CLI 登入狀態
 *   2. 選擇帳號 / 組織（有 session 時預選上次的）
 *   3. 載入倉庫列表（含 stars、issues、size、最近 push 時間）
 *   4. 分析用戶貢獻度（commit 數、佔比）
 *   5. 排序（有 session 時跳過排序選擇，預設貢獻度）
 *   6. 多選倉庫（session repos 排前 + 預選，再加有貢獻的）
 *
 * 依賴：lib/github.mjs（gh API）、lib/ui/prompts.mjs（互動元件）、lib/constants.mjs
 */

import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import { isEmpty, orderBy } from "lodash-es";
import pc from "picocolors";
import {
	BACK,
	handleCancel,
	multiselectWithAll,
	smartSelect,
} from "../cli/prompts.mjs";
import { pMap } from "../core/concurrency.mjs";
import {
	DESC_MAX_LENGTH,
	GH_CONCURRENCY,
	GH_PER_PAGE,
} from "../core/constants.mjs";
import { ghSync, ghSyncPaginate } from "../external/github.mjs";
import { ghAsync } from "./skill-detect.mjs";

/**
 * 互動式選擇 GitHub 倉庫
 *
 * @param {Object} [session] - 上次 session（有則預選 org/repos）
 * @param {string} [session.org] - 上次選的組織
 * @param {string[]} [session.repos] - 上次選的倉庫列表
 * @returns {Promise<string[]>} 選中的倉庫 full_name 陣列
 */
export async function interactiveRepoSelect(session = null) {
	// 1. 檢查 gh 登入
	try {
		execSync("gh auth status", { stdio: ["pipe", "pipe", "pipe"] });
	} catch {
		p.log.warn(
			`GitHub CLI 未登入，請先執行：\n` +
				`  ${pc.cyan("gh auth login")}          # 互動式（瀏覽器）\n` +
				`  ${pc.cyan("gh auth login --with-token")}  # 貼上 Personal Access Token\n` +
				`完成後重新執行 pnpm setup`,
		);
		process.exit(1);
	}

	// 2. 取得用戶名 + 組織
	const s0 = p.spinner();
	s0.start("🔗 取得 GitHub 帳號資訊...");
	const username = ghSync("user", ".login");
	const orgsRaw = ghSync("user/orgs", ".[].login");
	const orgs = orgsRaw ? orgsRaw.split("\n").filter(Boolean) : [];
	s0.stop(
		`已連結 ${pc.cyan(username)}${orgs.length ? ` · ${orgs.length} 個組織` : ""}`,
	);

	// 3. 選擇來源（有 session 且只有一個匹配時自動選）
	const sources = [
		{ value: username, label: `${username}  ${pc.dim("個人倉庫")}` },
		...orgs.map((o) => ({ value: o, label: `${o}  ${pc.dim("組織")}` })),
	];

	// 支持多選帳號/組織
	let selectedSources;
	const prevOrgs = Array.isArray(session?.org)
		? session.org
		: session?.org
			? [session.org]
			: [];
	if (
		!isEmpty(prevOrgs) &&
		prevOrgs.some((o) => sources.some((s) => s.value === o))
	) {
		// 有 session → 自動選擇上次的（支持單個或多個）
		selectedSources = prevOrgs.filter((o) =>
			sources.some((s) => s.value === o),
		);
		if (!isEmpty(selectedSources)) {
			p.log.success(
				`已連結 ${pc.cyan(selectedSources.join(" + "))}（上次選擇）`,
			);
		}
	}

	if (!selectedSources?.length) {
		const chosen = handleCancel(
			await p.multiselect({
				message: "👥 選擇 GitHub 帳號/組織（可多選）  Space 切換 · Enter 確認",
				options: sources,
				required: true,
			}),
		);
		if (chosen === BACK) return BACK;
		selectedSources = chosen;
		p.log.success(`已選擇：${pc.cyan(selectedSources.join(" + "))}`);
	}

	// 4. 載入所有選中帳號的倉庫列表
	const s1 = p.spinner();
	s1.start(`📂 載入 ${selectedSources.join(" + ")} 的倉庫列表...`);

	const allRepos = [];
	for (const selectedSource of selectedSources) {
		const isPersonal = selectedSource === username;
		const repoJq = isPersonal
			? '.[] | [.full_name, .description // "", .pushed_at[:10], (.stargazers_count|tostring), (.open_issues_count|tostring), (.size|tostring)] | @tsv'
			: '.[] | select(.archived == false and .fork == false) | [.full_name, .description // "", .pushed_at[:10], (.stargazers_count|tostring), (.open_issues_count|tostring), (.size|tostring)] | @tsv';
		const repoUrl = isPersonal
			? `user/repos?sort=pushed&per_page=${GH_PER_PAGE}&affiliation=owner`
			: `orgs/${selectedSource}/repos?sort=pushed&per_page=${GH_PER_PAGE}`;

		const reposRaw = ghSyncPaginate(repoUrl, repoJq);
		if (reposRaw) {
			allRepos.push(
				...reposRaw
					.split("\n")
					.filter(Boolean)
					.map((line) => {
						const [fullName, desc, pushedAt, stars, issues, size] =
							line.split("\t");
						return {
							fullName,
							desc: desc?.slice(0, DESC_MAX_LENGTH),
							pushedAt,
							stars: parseInt(stars, 10) || 0,
							issues: parseInt(issues, 10) || 0,
							size: parseInt(size, 10) || 0,
							commits: 0,
							pct: 0,
						};
					}),
			);
		}
	}
	if (isEmpty(allRepos)) {
		s1.stop("無法取得倉庫列表");
		return BACK;
	}
	s1.stop(
		`找到 ${pc.green(allRepos.length)} 個倉庫（${selectedSources.join(" + ")}）`,
	);

	// 5. 分析貢獻度 — 直接查每個 repo 的 contributors（全時間，無遺漏）
	const s2 = p.spinner();
	s2.start(
		`📊 分析 ${pc.cyan(username)} 的貢獻度（${allRepos.length} 個 repo）...`,
	);

	await pMap(
		allRepos,
		async (repo) => {
			try {
				const count = await ghAsync(
					`repos/${repo.fullName}/contributors?per_page=100`,
					`.[] | select(.login=="${username}") | .contributions`,
				);
				if (count) repo.commits = parseInt(count, 10) || 0;
			} catch {
				/* skip failed repos */
			}
		},
		{ concurrency: GH_CONCURRENCY },
	);

	const totalCommits = allRepos.reduce((sum, r) => sum + r.commits, 0);
	if (totalCommits > 0) {
		allRepos.forEach((r) => {
			r.pct = Math.round((r.commits / totalCommits) * 100);
		});
	}
	const contribCount = allRepos.filter((r) => r.commits > 0).length;
	s2.stop(
		`貢獻分析完成：${pc.green(contribCount)} 個有貢獻（共 ${pc.cyan(totalCommits)} commits）`,
	);

	if (isEmpty(allRepos)) {
		p.log.warn("沒有找到倉庫");
		return BACK;
	}

	// 6. 按組織分組，組內按貢獻度排序
	const repoOrgs = [...new Set(allRepos.map((r) => r.fullName.split("/")[0]))];
	const sorted = [];
	for (const org of repoOrgs) {
		const orgRepos = orderBy(
			allRepos.filter((r) => r.fullName.startsWith(`${org}/`)),
			["pct", "commits"],
			["desc", "desc"],
		);
		sorted.push(...orgRepos);
	}

	function repoOpt(r, showOrg) {
		const org = r.fullName.split("/")[0];
		const name = r.fullName.split("/")[1];
		const parts = [];
		if (r.pct > 0) parts.push(`${r.pct}%`);
		if (r.commits > 0) parts.push(`${r.commits} commits`);
		if (r.stars > 0) parts.push(`★${r.stars}`);
		if (r.desc) parts.push(r.desc.slice(0, 30));
		const meta = parts.length ? `  ${pc.dim(parts.join(" · "))}` : "";
		const prefix = showOrg ? `${pc.dim(`${org}/`)}` : "";
		return { value: r.fullName, label: `${prefix}${name}${meta}` };
	}

	// 7. 統一用 smartSelect（有 session 預選上次，無 session 預選有貢獻的）
	const sessionRepoSet = new Set(session?.repos || []);
	const contributed = sorted.filter((r) => r.commits > 0);
	const multiOrg = repoOrgs.length > 1;

	// 預選：session 有就用 session，否則用有貢獻的
	const preselected =
		sessionRepoSet.size > 0
			? session.repos.filter((r) => allRepos.some((x) => x.fullName === r))
			: contributed.map((r) => r.fullName);

	const allItems = sorted.map((r) => repoOpt(r, multiOrg));
	const preLabel =
		sessionRepoSet.size > 0
			? `上次選了 ${preselected.length} 個`
			: `${contributed.length} 個有貢獻已預選`;

	const selectTitle = `📁 選擇倉庫（${allRepos.length} 個，${preLabel}）`;

	// preview log：按組織分組顯示，不加序號
	const showSummary = (pre) => {
		const preRepos = pre
			.map((v) => allRepos.find((r) => r.fullName === v))
			.filter(Boolean);
		const lines = [];
		for (const org of repoOrgs) {
			const orgPre = preRepos.filter((r) => r.fullName.startsWith(`${org}/`));
			if (!orgPre.length) continue;
			lines.push(`  ${pc.bold(org)}`);
			for (const r of orgPre) {
				const name = r.fullName.split("/")[1];
				const parts = [];
				if (r.pct > 0) parts.push(`${r.pct}%`);
				if (r.commits > 0) parts.push(`${r.commits} commits`);
				if (r.stars > 0) parts.push(`★${r.stars}`);
				if (r.desc) parts.push(r.desc.slice(0, 40));
				lines.push(`    ${name}  ${pc.dim(parts.join(" · "))}`);
			}
		}
		return `${selectTitle}（預選 ${pre.length}/${allRepos.length}）：\n${lines.join("\n")}`;
	};

	let selected;
	if (multiOrg) {
		// 顯示分組預覽
		if (!isEmpty(preselected)) p.log.info(showSummary(preselected));

		// confirm / edit / back
		const preCount = preselected.length;
		const actionOpts = [];
		if (preCount > 0)
			actionOpts.push({
				value: "accept",
				label: `✅ 確認預選 (${preCount})`,
				hint: "推薦",
			});
		actionOpts.push({
			value: "edit",
			label:
				preCount > 0 ? "✏️ 調整選擇" : `📁 選擇（${allRepos.length} 個可選）`,
		});
		actionOpts.push({
			value: "back",
			label: `⬅️ 上一步  ${pc.dim("ESC 也可以")}`,
		});

		const action = handleCancel(
			await p.select({ message: selectTitle, options: actionOpts }),
		);
		if (action === BACK || action === "back") return BACK;

		if (action === "accept") {
			selected = preselected;
			p.log.success(`${selectTitle}：${preCount} 個`);
		} else {
			// 每個 org 獨立一輪 multiselect
			const allSelected = [];
			for (let oi = 0; oi < repoOrgs.length; oi++) {
				const org = repoOrgs[oi];
				const orgRepos = sorted.filter((r) => r.fullName.startsWith(`${org}/`));
				const orgPre = preselected.filter((v) => v.startsWith(`${org}/`));
				const orgItems = orgRepos.map((r) => repoOpt(r, false));
				const orgResult = await multiselectWithAll({
					message: `${org}（${oi + 1}/${repoOrgs.length}）`,
					options: orgItems,
					initialValues: orgPre,
					required: false,
				});
				if (orgResult === BACK) return BACK;
				allSelected.push(...orgResult);
			}
			selected = allSelected;
			if (!isEmpty(selected)) {
				const lines = selected.map((r, i) => `  ${i + 1}. ${r}`);
				p.log.success(
					`${selectTitle}：${selected.length} 個\n${lines.join("\n")}`,
				);
			}
		}
	} else {
		// 單一 org — 走原本 smartSelect 流程
		const result = await smartSelect({
			title: selectTitle,
			items: allItems,
			preselected,
			required: false,
			autoSelectThreshold: 0,
			showSummary,
		});
		if (result === BACK) return BACK;
		selected = result;
	}

	if (!selected || isEmpty(selected)) {
		p.log.warn("未選擇倉庫");
		return BACK;
	}

	// 返回完整 repo 物件（含 commits/pct/stars），而非純 fullName 字串
	const selectedSet = new Set(selected);
	return allRepos.filter((r) => selectedSet.has(r.fullName));
}
