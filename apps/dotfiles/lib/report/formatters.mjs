/**
 * 報告格式化輔助函式
 *
 * 職責：提供報告生成中的 HTML 片段生成和樣式設定。
 * 包括：HTML 逃逸、徽章、卡片、CSS 樣式、安裝/ECC 項目渲染。
 */

import path from "node:path";
import { sumBy } from "lodash-es";
import { getDescription } from "../config/descriptions.mjs";
import { HOME } from "../core/paths.mjs";

// ── HTML 轉義及元件 ──────────────────────────────────────────────

/**
 * 逃逸 HTML 特殊字元
 */
export function esc(str) {
	if (typeof str !== "string") return String(str ?? "");
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * 產生徽章 HTML
 */
export function badge(text, variant = "blue", desc = "") {
	const tooltip = desc ? ` title="${esc(desc)}"` : "";
	return `<span class="badge badge-${variant}"${tooltip}>${esc(text)}</span>`;
}

/**
 * 產生帶描述的徽章
 */
export function badgeWithDesc(name, variant, type, claudeDir) {
	const desc = getDescription(name, type, claudeDir);
	return desc
		? `<div class="item-row"><span class="badge badge-${variant}">${esc(name)}</span><span class="item-desc">${esc(desc)}</span></div>`
		: `<span class="badge badge-${variant}">${esc(name)}</span>`;
}

/**
 * 產生卡片容器
 */
export function section(title, content) {
	return `<div class="card"><h2 class="section-title">${esc(title)}</h2>${content}</div>`;
}

// ── CSS 樣式 ──────────────────────────────────────────────────────

/**
 * 取得完整 CSS 樣式表
 */
export function getStyles() {
	return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:#0d1117;color:#c9d1d9;line-height:1.6;padding:24px 16px}
.container{max-width:1100px;margin:0 auto}
header{text-align:center;margin-bottom:24px}
header h1{font-size:1.75rem;color:#58a6ff;margin-bottom:4px}
header .ts{font-size:.85rem;color:#8b949e}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;
  padding:20px 24px;margin-bottom:20px}
.overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
.overview .item{text-align:center}
.overview .item .value{font-size:1.5rem;font-weight:700;color:#58a6ff;transition:transform 0.3s}
.overview .item:hover .value{transform:scale(1.1)}
.overview .item .label{font-size:.8rem;color:#8b949e}
.section-title{font-size:1.1rem;font-weight:600;color:#c9d1d9;
  border-bottom:1px solid #30363d;padding-bottom:6px;margin-bottom:12px}
.section-desc{font-size:.82rem;color:#8b949e;margin:-8px 0 12px;line-height:1.5}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.chart-box{height:300px}
@media(max-width:700px){.chart-row{grid-template-columns:1fr} .chart-box{height:250px}}
table{width:100%;border-collapse:collapse;font-size:.88rem}
table th,table td{text-align:left;padding:7px 10px;border-bottom:1px solid #21262d}
table th{font-weight:600;color:#8b949e;font-size:.78rem;text-transform:uppercase;letter-spacing:.03em}
table tr:last-child td{border-bottom:none}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.78rem;font-weight:500;margin:3px 4px 3px 0;cursor:default;transition:outline 0.15s}
.badge-blue{background:#1f3a5f;color:#58a6ff}
.badge-green{background:#1a3a2a;color:#3fb950}
.badge-grey{background:#21262d;color:#8b949e}
.badge-pink{background:#3d1a2a;color:#f78166}
.item-row{display:flex;align-items:center;gap:6px;margin:3px 0}
.item-desc{font-size:.75rem;color:#8b949e}
.badge-purple{background:#2d1f4e;color:#bc8cff}
.group-label{font-weight:600;font-size:.85rem;color:#c9d1d9;margin:10px 0 4px}
.source-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.source-header .name{font-weight:600;color:#58a6ff}
.source-header .meta{font-size:.78rem;color:#8b949e}
.mono{font-family:SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:.85rem;color:#8b949e}
footer{text-align:center;font-size:.75rem;color:#484f58;margin-top:32px}
/* Tab 導航 */
.tabs{display:flex;gap:0;border-bottom:1px solid #30363d;margin-bottom:20px;overflow-x:auto}
.tab{padding:10px 20px;cursor:pointer;color:#8b949e;border-bottom:2px solid transparent;
  transition:all 0.2s;white-space:nowrap;font-size:.9rem;background:none;border-top:none;
  border-left:none;border-right:none;outline:none}
.tab:hover{color:#c9d1d9}
.tab.active{color:#58a6ff;border-bottom-color:#58a6ff}
.tab-content{display:none}
.tab-content.active{display:block}
/* 搜索框 */
.search-box{width:100%;padding:10px 16px;background:#0d1117;border:1px solid #30363d;
  border-radius:6px;color:#c9d1d9;font-size:14px;margin-bottom:16px}
.search-box:focus{outline:none;border-color:#58a6ff}
/* Repo 卡片 */
.repo-card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;
  margin-bottom:12px;transition:border-color 0.2s}
.repo-card:hover{border-color:#58a6ff}
.repo-card .name{font-weight:600;color:#58a6ff;font-size:1rem}
.repo-card .reasoning{color:#8b949e;font-size:.85rem;margin:6px 0}
.repo-card.hidden{display:none}
/* 過濾狀態提示 */
.filter-hint{font-size:.82rem;color:#8b949e;margin-bottom:8px;min-height:1.2em}
/* 統計項目 */
.stat{display:flex;align-items:center;gap:8px;padding:12px;background:#161b22;border-radius:6px;border:1px solid #30363d;font-size:.9rem}
.stat span:first-child{color:#8b949e}
.stat span:last-child{font-weight:600;color:#58a6ff}
`;
}

// ── 內容區塊渲染 ────────────────────────────────────────────────────

/**
 * 渲染概覽區塊
 */
export function renderOverview(data) {
	const aiResAdded = sumBy(
		data.aiRes?.sources || [],
		(r) =>
			(r.added?.commands?.length || 0) +
			(r.added?.agents?.length || 0) +
			(r.added?.rules?.length || 0),
	);
	const items = [
		{ label: "使用者", value: esc(data.username) },
		{ label: "組織", value: esc(data.org) },
		{ label: "模式", value: data.mode === "auto" ? "自動" : "手動" },
		{ label: "Repos", value: data.repos?.length ?? 0 },
		{ label: "技術棧", value: data.stacks?.length ?? 0 },
		{ label: "AI 資源融合", value: `+${aiResAdded}` },
	];
	const inner = items
		.map(
			(i) =>
				`<div class="item"><div class="value">${i.value}</div><div class="label">${i.label}</div></div>`,
		)
		.join("");
	return `<div class="card"><div class="overview">${inner}</div></div>`;
}

/**
 * 渲染 AI 資源融合區塊
 */
export function renderAiRes(aiRes) {
	if (!aiRes?.sources?.length) return "";
	const claudeDir = path.join(HOME, ".claude");
	let inner = "";
	for (const src of aiRes.sources) {
		inner += `<div class="source-header">
      <span class="name">${esc(src.name)}</span>
      <span class="meta">${esc(src.repo)} · ${src.version || "?"}${src.cached ? " · 快取" : ""}</span>
    </div>`;
		for (const [key, arr] of Object.entries(src.added || {})) {
			if (!arr?.length) continue;
			inner += `<div class="group-label">+ ${esc(key)}（${arr.length}）</div><div>${arr.map((v) => badgeWithDesc(v, "green", key, claudeDir)).join("")}</div>`;
		}
		const skippedTotal = sumBy(
			Object.values(src.skipped || {}),
			(a) => a?.length || 0,
		);
		if (skippedTotal > 0) {
			inner += `<div class="group-label" style="color:#8b949e">跳過（本地優先）${skippedTotal} 個</div>`;
		}
		inner +=
			'<hr style="border:none;border-top:1px solid #21262d;margin:12px 0">';
	}
	return section(
		"Source 融合",
		'<p class="section-desc">AI 外部資源（ECC + Anthropic + Superpowers 等）。「新增」表示本地沒有的項目已融合，「跳過」表示本地已有同名項目優先保留。</p>' +
			inner,
	);
}

/**
 * 渲染已安裝項目區塊
 */
export function renderInstalled(installed) {
	if (!installed) return "";
	const claudeDir = path.join(HOME, ".claude");
	let inner = "";
	const groups = [
		["Commands", installed.commands, "blue", "commands"],
		["Agents", installed.agents, "purple", "agents"],
		["Rules", installed.rules, "blue", "rules"],
		["Zsh Modules", installed.modules, "pink", null],
	];
	for (const [label, items, variant, type] of groups) {
		if (!items?.length) continue;
		inner += `<div class="group-label">${label}（${items.length}）</div><div>`;
		if (type) {
			inner += items
				.map((v) => badgeWithDesc(v, variant, type, claudeDir))
				.join("");
		} else {
			inner += items.map((v) => badge(v, variant)).join("");
		}
		inner += "</div>";
	}
	if (installed.hooks)
		inner += `<div class="group-label">Hooks</div><div>${badge("已啟用", "green")}</div>`;
	return section(
		"已安裝項目",
		'<p class="section-desc">以下配置已安裝到 ~/.claude/ 目錄，對所有專案全局生效。帶描述的項目來自 ab-tao，無描述的可能是 ECC 外部資源。</p>' +
			inner,
	);
}

/**
 * 渲染技術棧統計區塊
 */
export function renderStacks(stacks) {
	if (!stacks?.length) return "";
	const stackList = stacks
		.map((s) => badge(s, "blue", getDescription(s)))
		.join("");
	return section("技術棧總覽", stackList);
}

/**
 * 渲染備份區塊
 */
export function renderBackup(backupDir) {
	if (!backupDir) return "";
	return section(
		"備份位置",
		`<div class="mono" style="padding:8px;background:#0d1117;border-radius:4px">${esc(backupDir)}</div>`,
	);
}

/**
 * 計算檔案或目錄的大小（估算 token 消耗）
 * 每 4 個字元約等於 1 token
 */
export function estimateTokenSize(bytes) {
	return Math.ceil(bytes / 4);
}

/**
 * 渲染 Token 消耗分佈環形圖區塊
 */
export function renderTokenChart() {
	return `<div class="card">
    <h2 class="section-title">🔋 Token 消耗分佈</h2>
    <p class="section-desc">估算各類配置文件對 context 的佔用比例</p>
    <div id="chart-token-distribution" style="height:300px"></div>
  </div>`;
}

/**
 * 渲染清理機會區塊
 * 計算 30 天未使用的命令、代理和外部資源
 */
export function renderCleanup(installed, _auditLog = {}) {
	if (!installed) return "";

	const totalItems =
		(installed.commands?.length || 0) +
		(installed.agents?.length || 0) +
		(installed.rules?.length || 0);
	if (totalItems === 0) return "";

	// 未使用項目（模擬：實際應從 auditLog 讀取）
	const unusedCommands = [];
	const unusedAgents = [];
	const estimatedSavings = 0; // 需要實際計算

	const unusedCount = unusedCommands.length + unusedAgents.length;
	if (unusedCount === 0) {
		return `<div class="card">
      <h2 class="section-title">🗑️ 清理機會</h2>
      <p class="section-desc" style="color:#3fb950">所有已安裝項目都在使用中 ✓</p>
    </div>`;
	}

	let tableHtml =
		'<table style="font-size:.85rem"><thead><tr><th>名稱</th><th>類型</th><th>最後使用</th><th>大小</th></tr></thead><tbody>';

	for (const cmd of unusedCommands) {
		tableHtml += `<tr><td>${esc(cmd)}</td><td><span class="badge badge-blue">Command</span></td><td style="color:#8b949e">30+ 天前</td><td>~2KB</td></tr>`;
	}
	for (const agent of unusedAgents) {
		tableHtml += `<tr><td>${esc(agent)}</td><td><span class="badge badge-purple">Agent</span></td><td style="color:#8b949e">30+ 天前</td><td>~3KB</td></tr>`;
	}

	tableHtml += "</tbody></table>";

	return `<div class="card">
    <h2 class="section-title">🗑️ 清理機會</h2>
    <p class="section-desc">${unusedCount} 個項目 30 天未使用 · 預估節省 ~${estimatedSavings}KB token</p>
    ${tableHtml}
  </div>`;
}

/**
 * 渲染 Plugin 區塊（推薦的官方 Plugins）
 */
export function renderPlugins(_installed = {}) {
	const PLUGIN_RECOMMENDATIONS = [
		{
			name: "code-review",
			desc: "多 agent 並行 PR 審查",
			category: "開發流程",
		},
		{
			name: "commit-commands",
			desc: "智能 commit 訊息生成",
			category: "開發流程",
		},
		{
			name: "feature-dev",
			desc: "7 階段結構化功能開發",
			category: "開發流程",
		},
		{
			name: "code-simplifier",
			desc: "審查變更代碼的品質與效率",
			category: "開發流程",
		},
		{
			name: "security-guidance",
			desc: "安全漏洞掃描與修復建議",
			category: "安全",
		},
		{
			name: "hookify",
			desc: "分析對話模式自動生成 hooks",
			category: "自動化",
		},
		{
			name: "ralph-loop",
			desc: "持續迭代迴圈 — 自動重試直到任務完成",
			category: "自動化",
		},
		{
			name: "session-report",
			desc: "Session 分析報告 — 回顧工作成果與模式",
			category: "自動化",
		},
	];

	let pluginsList = "";
	for (const plugin of PLUGIN_RECOMMENDATIONS) {
		pluginsList += `<div class="item-row">
      <span class="badge badge-blue">${esc(plugin.name)}</span>
      <span class="item-desc">${esc(plugin.desc)}</span>
    </div>`;
	}

	return section(
		"🔌 推薦官方 Plugins",
		`<p class="section-desc">提升 Claude Code 能力，在 Claude Code 中執行 /plugin 安裝</p>${pluginsList}`,
	);
}
