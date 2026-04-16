/**
 * 報告渲染引擎
 *
 * 職責：組織 HTML 報告的結構，包括 Tab 導航、圖表、搜尋功能。
 * 匯出：generateReport(data) / saveReport(html, dir) / openInBrowser(path)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isEmpty } from "lodash-es";
import { getDescription } from "../config/descriptions.mjs";
import { CATEGORY_ORDER } from "../config/npm-classify.mjs";
import { HOME } from "../core/paths.mjs";
import { classifyBatch } from "../taxonomy/classify.mjs";
import {
	badge,
	esc,
	estimateTokenSize,
	getStyles,
	renderAiRes,
	renderBackup,
	renderCleanup,
	renderInstalled,
	renderOverview,
	renderPlugins,
	renderTokenChart,
	section,
} from "./formatters.mjs";

// ── Tab 區塊渲染 ────────────────────────────────────────────────

/**
 * 渲染 Tab 概覽頁籤
 */
function renderTabOverview(data) {
	const installed = data.installed || {};

	return `
<div id="tab-overview" class="tab-content active">
  ${renderOverview(data)}
  <div class="card" style="margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">
    <div style="flex:1;min-width:280px">
      <h2 class="section-title">安裝概覽</h2>
      <div id="chart-overview-pie" style="height:260px"></div>
    </div>
    <div style="flex:1;min-width:280px">
      <h2 class="section-title">數量統計</h2>
      <div id="chart-overview-bar" style="height:260px"></div>
    </div>
  </div>
  ${renderTokenChart()}
  ${renderCleanup(installed, data.auditSummary)}
  ${renderPlugins(installed)}
  <div class="card" style="margin-bottom:16px">
    <p class="section-desc" style="margin:0">概覽顯示安裝的總體統計。使用頂部 Tab 導航查看技術棧、專案、安裝詳情、審計日誌。</p>
  </div>
</div>`;
}

/**
 * 渲染 Tab 技術棧頁籤
 */
function renderTabTechStacks(data) {
	const stacks = data.stacks || [];
	const techStacks = data.techStacks || {};
	const perRepoReasoning = data.perRepoReasoning || {};

	// 每個技術棧出現在多少個 repo 中
	const stackRepoCount = {};
	if (data.repos && !isEmpty(data.repos)) {
		for (const repo of data.repos) {
			const stackData = perRepoReasoning[repo]?.stacks || {};
			for (const techs of Object.values(stackData)) {
				for (const tech of techs || []) {
					stackRepoCount[tech] = (stackRepoCount[tech] || 0) + 1;
				}
			}
		}
	}

	// 是否有每個 Repo 的分析資料（決定是否啟用點擊篩選）
	const hasPerRepoData = Object.keys(stackRepoCount).length > 0;

	// 用 CATEGORY_ORDER 排序分類，未知分類排到最後
	const orderIndex = Object.fromEntries(CATEGORY_ORDER.map((c, i) => [c, i]));

	// 優先使用 pipeline 產出的 techStacks，否則用 taxonomy 分類器補分類
	let sortedCategories = Object.entries(techStacks)
		.filter(([, techs]) => techs?.length > 0)
		.sort((a, b) => (orderIndex[a[0]] ?? 999) - (orderIndex[b[0]] ?? 999));

	let uncategorized = [];
	if (sortedCategories.length === 0 && stacks.length > 0) {
		// Fallback：用 taxonomy 確定性分類器對已知技術棧補分類
		try {
			const { classified, unclassified } = classifyBatch(stacks);
			sortedCategories = [...classified.entries()]
				.filter(([, techs]) => techs.length > 0)
				.sort((a, b) => (orderIndex[a[0]] ?? 999) - (orderIndex[b[0]] ?? 999));
			uncategorized = unclassified;
		} catch {
			// 分類器失敗時退化為未分類列表
			uncategorized = stacks;
		}
	} else {
		const categorized = new Set(sortedCategories.flatMap(([, t]) => t));
		uncategorized = stacks.filter((s) => !categorized.has(s));
	}

	const totalTechCount =
		sortedCategories.reduce((s, [, t]) => s + t.length, 0) +
		uncategorized.length;
	const totalCatCount =
		sortedCategories.length + (uncategorized.length > 0 ? 1 : 0);

	const topCount = Math.min(20, Object.keys(stackRepoCount).length);
	const freqHeight = Math.max(300, 100 + topCount * 20);

	// 渲染分類區塊
	const renderBadge = (t) => {
		const count = stackRepoCount[t] || 0;
		const desc = getDescription(t);
		const tooltip = desc
			? `${esc(desc)}${count > 0 ? `（${count} repos）` : ""}`
			: count > 0
				? `${count} repos`
				: "";
		// 永遠啟用點擊導覽（有 per-repo 資料時可精確篩選，否則仍可跳轉專案 Tab 全覽）
		return `<span class="badge badge-blue tech-link" title="${tooltip}" data-tech="${esc(t)}" style="cursor:pointer">${esc(t)}</span>`;
	};

	let categoryHtml = "";
	if (sortedCategories.length > 0) {
		categoryHtml = sortedCategories
			.map(([cat, techs]) => {
				const sorted = [...techs].sort((a, b) => {
					const diff = (stackRepoCount[b] || 0) - (stackRepoCount[a] || 0);
					return diff !== 0 ? diff : a.localeCompare(b);
				});
				return `<div style="margin-bottom:16px"><h3 style="font-size:.9rem;color:#8b949e;margin:0 0 8px">${esc(cat)} <span style="font-size:.78rem;opacity:.7">(${techs.length})</span></h3>${sorted.map(renderBadge).join("")}</div>`;
			})
			.join("");
		if (uncategorized.length > 0) {
			categoryHtml += `<div style="margin-bottom:16px"><h3 style="font-size:.9rem;color:#8b949e;margin:0 0 8px">其他 <span style="font-size:.78rem;opacity:.7">(${uncategorized.length})</span></h3>${uncategorized.map(renderBadge).join("")}</div>`;
		}
	} else if (!isEmpty(stacks)) {
		categoryHtml = `<div>${stacks.map(renderBadge).join("")}</div>`;
	}

	const clickHint = hasPerRepoData
		? "點擊技術棧可跳轉到專案頁籤篩選對應 Repo。"
		: "點擊技術棧可跳轉到專案頁籤（本次未執行完整分析，無每 Repo 精確篩選；執行 d:setup 完整流程可獲取明細）。";

	return `
<div id="tab-stacks" class="tab-content">
  <div class="card" style="margin-bottom:16px">
    <p class="section-desc" style="margin:0">技術棧統計（${totalTechCount} 個，${totalCatCount} 類）。${clickHint}</p>
  </div>
  <div class="card">
    <h2 class="section-title">所有技術棧</h2>
    ${categoryHtml || '<p style="color:#8b949e">無技術棧資料</p>'}
  </div>
  ${
		topCount > 0
			? `
  <div class="card">
    <h2 class="section-title">技術棧使用頻率（Top 20）</h2>
    <p class="section-desc">統計每個技術出現在多少個 repo 中，頻率越高表示該技術在團隊中越普及。</p>
    <div id="chart-tech-freq" style="height:${freqHeight}px"></div>
  </div>`
			: ""
	}
</div>`;
}

/**
 * 渲染 Tab 專案頁籤
 */
function renderTabRepos(data) {
	const perRepoReasoning = data.perRepoReasoning || {};
	const repos = data.repos || [];
	const roles = data.repoRoles || {};
	const projects = data.projects || [];

	const repoKeys = !isEmpty(repos) ? repos : Object.keys(perRepoReasoning);
	if (!repoKeys.length)
		return '<div id="tab-repos" class="tab-content"><p style="color:#8b949e">無 Repo 資料</p></div>';

	const roleIcon = { main: "⭐ 主力", temp: "🔄 臨時", tool: "🔧 工具" };
	const typeLabel = { full: "AI 生成", concise: "靜態模板", minimal: "最小" };

	const cards = repoKeys
		.map((repo) => {
			const shortName = repo.split("/")[1];
			const repoData =
				perRepoReasoning[repo] || perRepoReasoning[shortName] || {};
			const roleInfo = roles[repo] || {};
			const proj = projects.find((p) => p.repo === repo);
			const role = roleInfo.role || "temp";
			const categories = Object.keys(repoData.stacks || {}).join(",");

			const roleBadge = badge(
				roleIcon[role] || role,
				role === "main" ? "green" : "grey",
			);

			let stackBadges = "";
			for (const [cat, techs] of Object.entries(repoData.stacks || {})) {
				if (!techs?.length) continue;
				stackBadges += `<div style="margin-top:6px"><span style="font-size:.78rem;color:#8b949e;margin-right:4px">${esc(cat)}:</span>${techs
					.map((t) => {
						const d = getDescription(t);
						return d ? badge(t, "blue", d) : badge(t, "blue");
					})
					.join("")}</div>`;
			}

			const localPath = roleInfo.localPath
				? roleInfo.localPath.replace(HOME, "~")
				: "—";
			const claudeMd = proj ? typeLabel[proj.claudeMdType] || "—" : "—";
			const roleDesc =
				role === "main"
					? "完整 AI 分析 + 技術棧上下文"
					: role === "tool"
						? "最小配置"
						: "精簡模板";

			return `<div class="repo-card" data-categories="${esc(categories)}">
      <div class="name">${roleBadge} ${esc(repo)}</div>
      ${repoData.reasoning ? `<div class="reasoning">${esc(repoData.reasoning)}</div>` : ""}
      <table style="margin-top:8px;font-size:.85rem">
        <tr><td style="color:#8b949e;width:90px">路徑</td><td class="mono">${esc(localPath)}</td></tr>
        <tr><td style="color:#8b949e">CLAUDE.md</td><td>${esc(claudeMd)}</td></tr>
        <tr><td style="color:#8b949e">配置</td><td>${esc(roleDesc)}</td></tr>
      </table>
      ${stackBadges}
    </div>`;
		})
		.join("");

	const hasAnalysisData = Object.keys(perRepoReasoning).length > 0;
	const reposDesc = hasAnalysisData
		? "每個 Repo 卡片顯示角色、本機路徑、CLAUDE.md 狀態和 AI 分析的技術棧。使用搜尋框過濾，或從技術棧 Tab 點擊分類來篩選。"
		: '本次安裝未執行完整分析，路徑與技術棧欄位需執行 <code style="background:#0d1117;padding:1px 5px;border-radius:3px">d:setup</code> 完整流程後才會填充。';

	return `
<div id="tab-repos" class="tab-content">
  <div class="card" style="margin-bottom:16px">
    <p class="section-desc" style="margin:0">${reposDesc}</p>
  </div>
  <input type="text" id="search" class="search-box" placeholder="搜尋 Repo...">
  <div id="repos-filter-hint" class="filter-hint"></div>
  ${cards}
</div>`;
}

/**
 * 渲染 Tab 安裝頁籤
 */
function renderTabInstall(data) {
	const hasAiRes = (data.aiRes?.sources?.length || 0) > 0;

	return `
<div id="tab-install" class="tab-content">
  <div class="card" style="margin-bottom:16px">
    <p class="section-desc" style="margin:0">所有安裝到 ~/.claude/ 的配置項目。每個 Command 是一個 Slash 指令（/xxx），Agent 是一個可 @mention 的 AI 助手，Rule 是自動載入的行為規範。</p>
  </div>
  ${renderInstalled(data.installed)}
  ${
		hasAiRes
			? `
  <div class="card">
    <h2 class="section-title">Source 融合統計圖表</h2>
    <div class="chart-box" id="chart-aiRes-install"></div>
  </div>`
			: ""
	}
  ${renderAiRes(data.aiRes)}
</div>`;
}

/**
 * 渲染 Tab 審計頁籤
 */
function renderTabAudit(data) {
	const installed = data.installed || {};

	// 安裝摘要
	const summaryRows = [
		["模式", data.mode === "auto" ? "自動" : "手動"],
		["時間戳", data.timestamp || "—"],
		["Commands", installed.commands?.length || 0],
		["Agents", installed.agents?.length || 0],
		["Rules", installed.rules?.length || 0],
		["ZSH 模組", installed.modules?.length || 0],
		["Hooks", installed.hooks ? "已啟用" : "未啟用"],
		["技術棧", data.stacks?.length || 0],
		["Repos", data.repos?.length || 0],
	];
	const summaryHtml = section(
		"安裝摘要",
		`<table style="font-size:.88rem">${summaryRows
			.map(
				([k, v]) =>
					`<tr><td style="color:#8b949e;width:120px">${esc(k)}</td><td style="font-weight:500">${esc(String(v))}</td></tr>`,
			)
			.join("")}</table>`,
	);

	// 分析管道日誌
	const auditEntries = Array.isArray(data.auditSummary)
		? data.auditSummary
		: [];
	let pipelineHtml;
	if (auditEntries.length > 0) {
		const rows = auditEntries
			.map((entry) => {
				const parts = entry.split(" | ");
				const phase = parts[0] || "";
				const rest = parts.slice(1).join(" | ");
				return `<tr>
          <td style="color:#58a6ff;white-space:nowrap;padding-right:12px">${esc(phase)}</td>
          <td style="color:#8b949e;font-size:.82rem">${esc(rest)}</td>
        </tr>`;
			})
			.join("");
		pipelineHtml = section(
			"分析管道日誌",
			`<p class="section-desc">記錄每步技術棧分析的執行過程、AI 推理與 token 消耗。</p>
      <table style="font-size:.85rem">${rows}</table>`,
		);
	} else {
		pipelineHtml = `<div class="card">
      <h2 class="section-title">分析管道日誌</h2>
      <p class="section-desc">本次安裝未執行技術棧分析管道（Repo 掃描已跳過或未選擇 AI 分析）。<br>執行 <code style="background:#0d1117;padding:1px 6px;border-radius:3px">pnpm run d:setup</code> 並選擇完整分析可獲取詳細日誌。</p>
    </div>`;
	}

	// 已安裝 Commands / Agents 清單
	let installedDetailHtml = "";
	if (
		(installed.commands?.length || 0) +
			(installed.agents?.length || 0) +
			(installed.rules?.length || 0) >
		0
	) {
		const groups = [
			["Commands", installed.commands, "badge-blue", "/"],
			["Agents", installed.agents, "badge-purple", "@"],
			["Rules", installed.rules, "badge-blue", ""],
		].filter(([, items]) => items?.length);

		const groupsHtml = groups
			.map(
				([label, items, cls, prefix]) =>
					`<div style="margin-bottom:12px">
            <div class="group-label">${esc(label)}（${items.length}）</div>
            <div>${items.map((v) => `<span class="badge ${cls}">${prefix}${esc(v)}</span>`).join("")}</div>
          </div>`,
			)
			.join("");

		installedDetailHtml = section("已安裝明細", groupsHtml);
	}

	const backupHtml = renderBackup(data.backupDir);

	return `
<div id="tab-audit" class="tab-content">
  ${summaryHtml}
  ${pipelineHtml}
  ${installedDetailHtml}
  ${backupHtml}
</div>`;
}

// ── 圖表及互動腳本 ────────────────────────────────────────────────

/**
 * 渲染 ECharts 圖表及互動腳本
 */
function renderCharts(data) {
	const stacks = data.stacks || [];
	const perRepoReasoning = data.perRepoReasoning || {};
	const repos = data.repos || [];
	const installed = data.installed || {};

	const stackRepoCount = {};
	if (!isEmpty(repos)) {
		for (const repo of repos) {
			const stackData = perRepoReasoning[repo]?.stacks || {};
			for (const techs of Object.values(stackData)) {
				for (const tech of techs || []) {
					stackRepoCount[tech] = (stackRepoCount[tech] || 0) + 1;
				}
			}
		}
	}

	const topCount = Math.min(20, Object.keys(stackRepoCount).length);
	const topStacks = Object.entries(stackRepoCount)
		.sort((a, b) => b[1] - a[1])
		.slice(0, topCount);

	// 計算 Token 消耗分佈（估算值）
	// 假設文件大小估算：rules ~50KB，commands ~10KB，agents ~15KB，CLAUDE.md ~5KB，memory ~5KB
	const tokenData = [
		{ name: "Rules", value: estimateTokenSize(50000), percentage: 0 },
		{ name: "Agents", value: estimateTokenSize(15000), percentage: 0 },
		{ name: "Commands", value: estimateTokenSize(10000), percentage: 0 },
		{ name: "CLAUDE.md", value: estimateTokenSize(5000), percentage: 0 },
		{ name: "Memory", value: estimateTokenSize(5000), percentage: 0 },
	].filter((d) => d.value > 0);

	const totalTokens = tokenData.reduce((sum, item) => sum + item.value, 0);
	tokenData.forEach((item) => {
		item.percentage =
			totalTokens > 0 ? ((item.value / totalTokens) * 100).toFixed(1) : 0;
	});

	const chartConfig = {
		techFreq: topStacks.map(([name, count]) => ({ name, value: count })),
		overview: [
			{ name: "Commands", value: installed.commands?.length || 0 },
			{ name: "Agents", value: installed.agents?.length || 0 },
			{ name: "Rules", value: installed.rules?.length || 0 },
			{ name: "ZSH 模組", value: installed.modules?.length || 0 },
			{ name: "技術棧", value: stacks.length },
			{ name: "Repos", value: repos.length },
		].filter((d) => d.value > 0),
		aiResInstall: [
			...(data.aiRes?.sources || []).map((s) => ({
				name: s.name,
				added:
					(s.added?.commands?.length || 0) +
					(s.added?.agents?.length || 0) +
					(s.added?.rules?.length || 0),
				skipped: Object.values(s.skipped || {}).reduce(
					(a, b) => a + (b?.length || 0),
					0,
				),
			})),
		],
		tokenDistribution: tokenData,
	};

	return `
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script>
const chartConfig = ${JSON.stringify(chartConfig)};

const tabButtons = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    
    setTimeout(() => {
      if (btn.dataset.tab === 'stacks') initTechFreqChart();
      if (btn.dataset.tab === 'install') initAiResInstallChart();
    }, 100);
  });
});

function initTechFreqChart() {
  const dom = document.getElementById('chart-tech-freq');
  if (!dom || dom._echarts) return;
  const chart = echarts.init(dom);
  dom._echarts = chart;
  const option = {
    backgroundColor: 'transparent',
    textStyle: { color: '#8b949e' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { color: '#8b949e' } },
    yAxis: { type: 'category', data: chartConfig.techFreq.map(d => d.name), axisLabel: { color: '#8b949e' } },
    series: [{
      type: 'bar',
      data: chartConfig.techFreq.map(d => d.value),
      itemStyle: { color: '#58a6ff' },
      label: { show: true, position: 'right', color: '#8b949e' }
    }]
  };
  chart.setOption(option);
  window.addEventListener('resize', () => chart.resize());
}

function initAiResInstallChart() {
  const dom = document.getElementById('chart-aiRes-install');
  if (!dom || !dom.offsetParent || dom._echarts) return;
  if (!chartConfig.aiResInstall || isEmpty(chartConfig.aiResInstall)) return;
  const chart = echarts.init(dom);
  dom._echarts = chart;
  const option = {
    backgroundColor: 'transparent',
    textStyle: { color: '#8b949e' },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#8b949e' } },
    series: [{
      type: 'pie',
      radius: ['30%', '55%'],
      data: chartConfig.aiResInstall.map(s => ({ value: s.added, name: s.name + ' (+' + s.added + ')' })),
      label: { color: '#c9d1d9' },
      itemStyle: { borderColor: '#0d1117', borderWidth: 2 }
    }]
  };
  chart.setOption(option);
  window.addEventListener('resize', () => chart.resize());
}

function initOverviewPie() {
  const dom = document.getElementById('chart-overview-pie');
  if (!dom || dom._echarts) return;
  const chart = echarts.init(dom);
  dom._echarts = chart;
  const colors = ['#58a6ff','#bc8cff','#3fb950','#f0883e','#f778ba','#79c0ff'];
  const option = {
    backgroundColor: 'transparent',
    textStyle: { color: '#8b949e' },
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [{
      type: 'pie',
      radius: ['35%', '60%'],
      data: chartConfig.overview,
      label: { color: '#c9d1d9', formatter: '{b}\\n{c}' },
      itemStyle: { borderColor: '#0d1117', borderWidth: 2 },
      color: colors
    }]
  };
  chart.setOption(option);
  window.addEventListener('resize', () => chart.resize());
}

function initOverviewBar() {
  const dom = document.getElementById('chart-overview-bar');
  if (!dom || dom._echarts) return;
  const chart = echarts.init(dom);
  dom._echarts = chart;
  const option = {
    backgroundColor: 'transparent',
    textStyle: { color: '#8b949e' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { color: '#8b949e' } },
    yAxis: { type: 'category', data: chartConfig.overview.map(d => d.name), axisLabel: { color: '#8b949e' } },
    series: [{
      type: 'bar',
      data: chartConfig.overview.map(d => d.value),
      itemStyle: { color: '#58a6ff' },
      label: { show: true, position: 'right', color: '#8b949e' }
    }]
  };
  chart.setOption(option);
  window.addEventListener('resize', () => chart.resize());
}

function initTokenChart() {
  const dom = document.getElementById('chart-token-distribution');
  if (!dom || !dom.offsetParent || dom._echarts) return;
  if (!chartConfig.tokenDistribution || isEmpty(chartConfig.tokenDistribution)) return;
  const chart = echarts.init(dom);
  dom._echarts = chart;
  const colors = ['#58a6ff', '#bc8cff', '#3fb950', '#f0883e', '#f778ba'];
  const option = {
    backgroundColor: 'transparent',
    textStyle: { color: '#8b949e' },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        if (params.data) {
          return params.data.name + ': ' + params.data.value + ' Tokens (' + params.data.percentage + '%)';
        }
        return params.name;
      }
    },
    legend: { bottom: 0, textStyle: { color: '#8b949e' } },
    series: [{
      type: 'pie',
      radius: ['35%', '60%'],
      data: chartConfig.tokenDistribution.map(d => ({
        value: d.value,
        name: d.name,
        percentage: d.percentage
      })),
      label: {
        color: '#c9d1d9',
        formatter: function(params) {
          return params.name + '\\n' + params.value + 'T';
        }
      },
      itemStyle: { borderColor: '#0d1117', borderWidth: 2 },
      color: colors
    }]
  };
  chart.setOption(option);
  window.addEventListener('resize', () => chart.resize());
}

// 搜尋功能
const searchInput = document.getElementById('search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.repo-card');
    let matched = 0;
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      const cats = (card.dataset.categories || '').toLowerCase();
      if (text.includes(query) || cats.includes(query)) {
        card.classList.remove('hidden');
        matched++;
      } else {
        card.classList.add('hidden');
      }
    });
    const hint = document.getElementById('repos-filter-hint');
    if (hint) hint.textContent = query ? \`找到 \${matched} 個匹配\` : '';
  });
}

// 技術棧點擊 → 跳轉專案 Tab 並篩選
document.querySelectorAll('.tech-link').forEach(el => {
  el.addEventListener('click', () => {
    const tech = el.dataset.tech;
    if (!tech) return;
    // 切到專案 Tab
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    const reposBtn = document.querySelector('[data-tab="repos"]');
    if (reposBtn) reposBtn.classList.add('active');
    const reposTab = document.getElementById('tab-repos');
    if (reposTab) reposTab.classList.add('active');
    // 填入搜尋框並觸發篩選
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.value = tech;
      searchInput.dispatchEvent(new Event('input'));
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// 初始化概覽 Tab 圖表（首屏）
initOverviewPie();
initOverviewBar();
initTokenChart();
</script>`;
}

/**
 * 渲染 Tab 切換腳本（基礎版本）
 */
function renderTabScript() {
	return "";
}

// ── 主要匯出 ────────────────────────────────────────────────────

/**
 * 從本機 package.json 建立每個 Repo 的技術棧（perRepoReasoning 為空時的 fallback）
 *
 * @param {Object} repoRoles - { [fullName]: { role, localPath } }
 * @returns {Object} - { [fullName]: { stacks: { [category]: string[] } } }
 */
function buildPerRepoStacksFromLocal(repoRoles) {
	const result = {};
	for (const [repo, info] of Object.entries(repoRoles || {})) {
		if (!info.localPath) continue;
		const pkgPath = path.join(info.localPath, "package.json");
		if (!fs.existsSync(pkgPath)) continue;
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
			const allDeps = [
				...Object.keys(pkg.dependencies || {}),
				...Object.keys(pkg.devDependencies || {}),
			];
			if (!allDeps.length) continue;
			const { classified } = classifyBatch(allDeps);
			const stacks = {};
			for (const [cat, techs] of classified.entries()) {
				if (techs.length) stacks[cat] = techs;
			}
			if (Object.keys(stacks).length) {
				result[repo] = { stacks, reasoning: null };
			}
		} catch {
			// 讀取失敗跳過該 repo
		}
	}
	return result;
}

/**
 * 產生完整 HTML 報告
 * @param {Object} data - 安裝資料
 * @returns {string} HTML
 */
export function generateReport(data) {
	const ts =
		data.timestamp ?? new Date().toISOString().replace("T", " ").slice(0, 19);

	// 若沒有 per-repo AI 分析，用本機 package.json 補齊技術棧
	if (isEmpty(data.perRepoReasoning) && !isEmpty(data.repoRoles)) {
		const localStacks = buildPerRepoStacksFromLocal(data.repoRoles);
		if (!isEmpty(localStacks)) {
			data = { ...data, perRepoReasoning: localStacks };
		}
	}

	const tabNav = `
<nav class="tabs">
  <button class="tab active" data-tab="overview">概覽</button>
  <button class="tab" data-tab="stacks">技術棧</button>
  <button class="tab" data-tab="repos">專案</button>
  <button class="tab" data-tab="install">安裝</button>
  <button class="tab" data-tab="audit">審計</button>
</nav>`;

	const body = [
		tabNav,
		renderTabOverview(data),
		renderTabTechStacks(data),
		renderTabRepos(data),
		renderTabInstall(data),
		renderTabAudit(data),
		renderCharts(data),
		renderTabScript(),
	].join("\n");

	return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ab-tao 安裝報告</title>
<style>${getStyles()}</style>
</head>
<body>
<div class="container">
<header>
  <h1>ab-tao 安裝報告</h1>
  <div class="ts">${esc(ts)}</div>
</header>
${body}
<footer>Generated by ab-tao · Powered by ECharts</footer>
</div>
</body>
</html>`;
}

// ── 統一 Dashboard 渲染器（re-export） ─────────────────────────
export {
	generateUnifiedReport,
	saveAndOpenReport,
} from "./unified-renderer.mjs";

/** 儲存報告到檔案 */
export function saveReport(html, outputDir) {
	const dir = path.resolve(outputDir);
	fs.mkdirSync(dir, { recursive: true });
	const filePath = path.join(dir, "report.html");
	fs.writeFileSync(filePath, html, "utf-8");
	return filePath;
}

/** 在預設瀏覽器開啟 */
export function openInBrowser(filePath) {
	const abs = path.resolve(filePath);
	const cmd =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "start"
				: "xdg-open";
	const args = process.platform === "win32" ? ["", abs] : [abs];
	try {
		execFileSync(cmd, args);
		return Promise.resolve();
	} catch (err) {
		return Promise.reject(err);
	}
}
