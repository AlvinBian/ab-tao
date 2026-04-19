/**
 * 統一 HTML Dashboard 渲染引擎
 *
 * 職責：為 d:report 和 d:status --report 提供單一 HTML 產生入口。
 * 匯出：generateUnifiedReport(data) / saveAndOpenReport(data, outputPath)
 *
 * 資料形狀說明：
 *   - 來自 d:report（report.mjs）：包含 installed、stacks、repos、perRepoReasoning 等安裝資料
 *   - 來自 d:status（status.mjs）：包含 commands、agents、rules、skills、hooks、zsh、ai 等即時掃描資料
 *   - 兩者可同時存在；缺少的欄位以預設值填補
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ── HTML 轉義輔助 ─────────────────────────────────────────────────

/**
 * 轉義 HTML 特殊字元，防止 XSS
 * @param {unknown} val
 * @returns {string}
 */
function escapeHtml(val) {
	if (val === null || val === undefined) return "";
	return String(val)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// ── CSS 樣式（自包含，無外部 CDN）────────────────────────────────

function getInlineStyles() {
	return `
/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── CSS 變數 ── */
:root {
  --bg: #1a1b26;
  --bg2: #24283b;
  --border: #414868;
  --text: #c0caf5;
  --text-dim: #565f89;
  --accent: #7aa2f7;
  --green: #9ece6a;
  --yellow: #e0af68;
  --red: #f7768e;
  --purple: #bb9af7;
}

/* ── Base ── */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  padding: 24px 16px;
  font-size: 14px;
}
.container { max-width: 1100px; margin: 0 auto; }

/* ── Header ── */
header { text-align: center; margin-bottom: 24px; }
header h1 { font-size: 1.75rem; color: var(--accent); margin-bottom: 4px; }
header .ts { font-size: .85rem; color: var(--text-dim); }

/* ── Card ── */
.card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

/* ── Tab 導航 ── */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
  overflow-x: auto;
}
.tab {
  padding: 10px 20px;
  cursor: pointer;
  color: var(--text-dim);
  border-bottom: 2px solid transparent;
  transition: all .2s;
  white-space: nowrap;
  font-size: .9rem;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  outline: none;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-content { display: none; }
.tab-content.active { display: block; }

/* ── Stat grid（概覽卡片） ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-item {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.stat-value { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: .78rem; color: var(--text-dim); margin-top: 4px; }

/* ── Health bar ── */
.health-bar-wrap { margin-bottom: 16px; }
.health-bar-track {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
  margin: 6px 0;
}
.health-bar-fill { height: 100%; border-radius: 4px; transition: width .4s; }

/* ── Section title ── */
.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
  margin-bottom: 12px;
}
.section-desc { font-size: .82rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.5; }

/* ── Badge ── */
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: .75rem;
  font-weight: 500;
  margin: 3px 4px 3px 0;
}
.badge-blue   { background: #1f3a5f; color: var(--accent); }
.badge-green  { background: #1a3a2a; color: var(--green); }
.badge-yellow { background: #3a2f1a; color: var(--yellow); }
.badge-red    { background: #3a1a1f; color: var(--red); }
.badge-purple { background: #2d1f4e; color: var(--purple); }
.badge-grey   { background: #21262d; color: var(--text-dim); }

/* ── Table ── */
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
table th, table td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); }
table th { font-weight: 600; color: var(--text-dim); font-size: .75rem; text-transform: uppercase; letter-spacing: .03em; }
table tr:last-child td { border-bottom: none; }

/* ── Details / collapsible ── */
details { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; }
details summary {
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 500;
  color: var(--text);
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}
details summary::-webkit-details-marker { display: none; }
details summary::before { content: "▶"; font-size: .7rem; color: var(--text-dim); transition: transform .2s; }
details[open] summary::before { transform: rotate(90deg); }
details[open] summary { border-bottom: 1px solid var(--border); }
.details-body { padding: 14px; }

/* ── Skill item ── */
.skill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  transition: background .15s;
}
.skill-item:hover { background: rgba(122,162,247,.07); }
.skill-name { font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; font-size: .85rem; color: var(--text); flex: 1; }
.skill-status { font-size: .75rem; }
.skill-status.enabled  { color: var(--green); }
.skill-status.disabled { color: var(--red); }
.skill-cb { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }

/* ── Resource item ── */
.res-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
}
.res-item:hover { background: rgba(122,162,247,.07); }
.res-name { font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; font-size: .85rem; color: var(--text); flex: 1; }
.res-status { font-size: .75rem; }
.res-status.enabled  { color: var(--green); }
.res-status.disabled { color: var(--red); }
.res-cb { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }

/* ── Script Panel ── */
.script-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: #0d1117;
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  z-index: 100;
  max-height: 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transform: translateY(100%);
  transition: transform .25s;
}
.script-panel.visible { transform: translateY(0); }
.script-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: .85rem;
  color: var(--text-dim);
}
.script-panel pre {
  overflow-y: auto;
  max-height: 130px;
  font-size: .8rem;
  color: var(--green);
  flex: 1;
}
.btn {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg2);
  color: var(--text);
  font-size: .8rem;
  cursor: pointer;
  transition: border-color .15s;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn-copy { border-color: var(--accent); color: var(--accent); }

/* ── Mono ── */
.mono { font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; font-size: .85rem; color: var(--text-dim); }

/* ── ZSH module list ── */
.module-list { display: flex; flex-wrap: wrap; gap: 6px; }

/* ── Repo card ── */
.repo-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.repo-card .repo-name { font-weight: 600; color: var(--accent); margin-bottom: 4px; }
.repo-card .repo-meta { font-size: .82rem; color: var(--text-dim); }

/* ── Footer ── */
footer { text-align: center; font-size: .75rem; color: var(--text-dim); margin-top: 32px; padding-bottom: 230px; }

/* ── Info box ── */
.info-box {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  color: var(--text-dim);
  font-size: .88rem;
}
`;
}

// ── Tab 渲染函式 ────────────────────────────────────────────────

/**
 * 渲染概覽 Tab（Wave 3 C2 擴充：drift 警告 + ccline 狀態）
 */
function renderTabOverview(data) {
	// 相容兩種資料形狀
	const commands = data.commands || data.installed?.commands || [];
	const agents = data.agents || data.installed?.agents || [];
	const rules = data.rules || data.installed?.rules || [];
	const skills = data.skills || [];
	const hooks = data.hooks || [];
	const extended = data.extended || {};

	const skillsEnabled = skills.filter((s) => s.enabled).length;
	const skillsTotal = skills.length;
	const hooksTotal = Array.isArray(hooks)
		? hooks.reduce((s, h) => s + (h.subHooks || 1), 0)
		: 0;
	const rulesEnabled = Array.isArray(rules)
		? rules.filter((r) => r.enabled !== false).length
		: rules.length;
	const healthPct = data.overview?.healthPct ?? null;
	const model = data.ai?.model ?? data.model ?? "—";

	// 健康度顯示
	let healthHtml = "";
	if (healthPct !== null) {
		const fillColor =
			healthPct >= 90
				? "var(--green)"
				: healthPct >= 70
					? "var(--yellow)"
					: "var(--red)";
		healthHtml = `
<div class="card health-bar-wrap">
  <div class="section-title">配置健康度</div>
  <div style="font-size:2rem;font-weight:700;color:${fillColor}">${healthPct}%</div>
  <div class="health-bar-track" style="margin-top:8px">
    <div class="health-bar-fill" style="width:${healthPct}%;background:${fillColor}"></div>
  </div>
</div>`;
	}

	const cmdCount = Array.isArray(commands) ? commands.length : 0;
	const agentCount = Array.isArray(agents) ? agents.length : 0;
	const rulesCount = Array.isArray(rules) ? rules.length : 0;

	const stats = [
		{ label: "Commands", value: cmdCount },
		{ label: "Agents", value: agentCount },
		{ label: "Rules", value: `${rulesEnabled}/${rulesCount}` },
		{
			label: "Skills",
			value: skillsTotal > 0 ? `${skillsEnabled}/${skillsTotal}` : "—",
		},
		{ label: "Hooks", value: hooksTotal > 0 ? hooksTotal : "—" },
		{ label: "AI 模型", value: escapeHtml(model) },
	];

	const statsHtml = stats
		.map(
			(s) => `
<div class="stat-item">
  <div class="stat-value">${s.value}</div>
  <div class="stat-label">${escapeHtml(s.label)}</div>
</div>`,
		)
		.join("");

	// Drift 警告 badge（Wave 3 C2）
	const driftItems = Array.isArray(extended.drift) ? extended.drift : [];
	let driftHtml = "";
	if (driftItems.length > 0) {
		driftHtml = `
<div class="card" style="border-color:var(--yellow)">
  <div class="section-title" style="color:var(--yellow)">⚠ 配置 Drift 警告</div>
  <p style="font-size:.88rem;margin-bottom:8px">偵測到 <strong style="color:var(--yellow)">${driftItems.length}</strong> 個 managed 檔案已被修改或遺失，建議至 <strong>State</strong> 頁籤查看詳情。</p>
  <div>
    ${driftItems
			.slice(0, 5)
			.map(
				(d) =>
					`<span class="badge badge-yellow">${escapeHtml(d.decision)}: ${escapeHtml(d.path)}</span>`,
			)
			.join("")}
    ${driftItems.length > 5 ? `<span class="badge badge-grey">...還有 ${driftItems.length - 5} 個</span>` : ""}
  </div>
</div>`;
	}

	// CCline 狀態 widget（Wave 3 C2）— 來自 collect-unified.mjs checkCclineStatus()
	const ccline = extended.ccline || {};
	let cclineHtml = "";
	if (ccline.installed !== undefined) {
		// 安裝狀態 badge
		const cclineStatus = ccline.installed
			? '<span class="badge badge-green">已安裝</span>'
			: '<span class="badge badge-grey">未安裝</span>';
		// settings.json 中 statusLineTool / statusLine 是否已配置
		const cclineConfigured = ccline.statusLineConfigured
			? '<span class="badge badge-blue">statusLineTool 已配置</span>'
			: '<span class="badge badge-yellow">statusLineTool 未配置</span>';
		// Claude Code settings.json 的 statusLine 欄位可能是字串或物件 { type, command, padding }
		// 需要做 type guard 提取 command 字串，避免直接渲染物件得到 "[object Object]"
		const cmdStr =
			typeof ccline.command === "string"
				? ccline.command
				: ccline.command && typeof ccline.command.command === "string"
					? ccline.command.command
					: "";
		// 只有 cmdStr 有值才渲染命令路徑顯示區塊
		const cmdDisplay = cmdStr
			? `<div class="mono" style="font-size:.78rem;margin-top:4px;word-break:break-all">${escapeHtml(cmdStr)}</div>`
			: "";
		cclineHtml = `
<div class="card">
  <div class="section-title">CCline 狀態列</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    ${cclineStatus}
    ${cclineConfigured}
    ${ccline.themes && ccline.themes.length > 0 ? `<span class="badge badge-purple">${ccline.themes.length} 個主題</span>` : ""}
  </div>
  ${cmdDisplay}
</div>`;
	}

	return `
<div id="tab-overview" class="tab-content active">
  ${healthHtml}
  <div class="card">
    <div class="section-title">核心統計</div>
    <div class="stat-grid">${statsHtml}</div>
  </div>
  ${driftHtml}
  ${cclineHtml}
</div>`;
}

/**
 * 渲染 Skills Tab
 * skills: { name, source, enabled }[]
 */
function renderTabSkills(data) {
	const skills = data.skills || [];

	if (skills.length === 0) {
		return `
<div id="tab-skills" class="tab-content">
  <div class="info-box">尚未安裝任何 skill（~/.claude/skills/ 為空）。執行 <code>d:setup</code> 可安裝 skills。</div>
</div>`;
	}

	// 依 source 分組
	const bySource = /** @type {Record<string, typeof skills>} */ ({});
	for (const s of skills) {
		const src = s.source || "custom";
		if (!bySource[src]) bySource[src] = [];
		bySource[src].push(s);
	}

	const sourceBadgeColor = (src) => {
		if (src === "custom") return "grey";
		if (src === "ab-tao") return "blue";
		return "purple";
	};

	let groupsHtml = "";
	for (const [src, items] of Object.entries(bySource).sort()) {
		const itemsHtml = items
			.map((s) => {
				const statusClass = s.enabled ? "enabled" : "disabled";
				const statusText = s.enabled ? "enabled" : "disabled";
				const cbId = `skill-cb-${escapeHtml(s.name)}`;
				return `
<div class="skill-item">
  <input type="checkbox" class="skill-cb" id="${cbId}"
    data-skill-name="${escapeHtml(s.name)}"
    data-skill-source="${escapeHtml(src)}"
    data-skill-path="${escapeHtml(s.path || s.name)}"
    data-skill-enabled="${s.enabled ? "1" : "0"}"
    ${s.enabled ? "checked" : ""}
    onchange="onSkillToggle(this)"
  >
  <span class="skill-name">${escapeHtml(s.name)}</span>
  <span class="badge badge-${sourceBadgeColor(src)}">${escapeHtml(src)}</span>
  <span class="skill-status ${statusClass}">${statusText}</span>
</div>`;
			})
			.join("");

		groupsHtml += `
<details open>
  <summary>${escapeHtml(src)} <span class="badge badge-${sourceBadgeColor(src)}" style="font-size:.7rem">${items.length}</span></summary>
  <div class="details-body">${itemsHtml}</div>
</details>`;
	}

	return `
<div id="tab-skills" class="tab-content">
  <div class="card">
    <div class="section-title">Skills（${skills.length} 個）</div>
    <p class="section-desc">勾選 / 取消勾選會在下方 Script Panel 累積對應的 shell 指令，確認無誤後複製執行。</p>
    <div style="margin-bottom:12px">
      <button class="btn" onclick="copyFindSkillsCmd()" title="複製 pnpm run c:skills --find 指令">🔍 c:skills --find</button>
      <span style="font-size:.78rem;color:var(--text-dim);margin-left:8px">快速搜尋可安裝的 skills</span>
    </div>
    ${groupsHtml}
  </div>
</div>`;
}

/**
 * 渲染 Resources Tab
 * 展示 commands、agents、rules，支援 toggle checkbox
 */
function renderTabResources(data) {
	const commands = data.commands || data.installed?.commands || [];
	const agents = data.agents || data.installed?.agents || [];
	const rules = data.rules || data.installed?.rules || [];

	// 兼容兩種格式：陣列可能是字串陣列（d:report）或物件陣列（d:status）
	const normalizeItem = (item) =>
		typeof item === "string"
			? { name: item, enabled: true, source: "unknown" }
			: item;

	const renderGroup = (title, items, prefix) => {
		if (!items || items.length === 0) return "";
		const normalized = items.map(normalizeItem);
		const itemsHtml = normalized
			.map((item) => {
				const statusClass = item.enabled !== false ? "enabled" : "disabled";
				const statusText = item.enabled !== false ? "enabled" : "disabled";
				const cbId = `res-cb-${prefix}-${escapeHtml(item.name)}`;
				return `
<div class="res-item">
  <input type="checkbox" class="res-cb" id="${cbId}"
    data-res-type="${escapeHtml(prefix)}"
    data-res-name="${escapeHtml(item.name)}"
    data-res-enabled="${item.enabled !== false ? "1" : "0"}"
    ${item.enabled !== false ? "checked" : ""}
    onchange="onResToggle(this)"
  >
  <span class="res-name">${escapeHtml(prefix === "command" ? `/${item.name}` : prefix === "agent" ? `@${item.name}` : item.name)}</span>
  ${item.source && item.source !== "unknown" ? `<span class="badge badge-grey" style="font-size:.7rem">${escapeHtml(item.source)}</span>` : ""}
  <span class="res-status ${statusClass}">${statusText}</span>
</div>`;
			})
			.join("");

		return `
<details open>
  <summary>${escapeHtml(title)} <span class="badge badge-blue" style="font-size:.7rem">${normalized.length}</span></summary>
  <div class="details-body">${itemsHtml}</div>
</details>`;
	};

	const hasAny = commands.length > 0 || agents.length > 0 || rules.length > 0;

	return `
<div id="tab-resources" class="tab-content">
  <div class="card">
    <div class="section-title">Resources</div>
    <p class="section-desc">勾選 / 取消勾選會在下方 Script Panel 累積對應的 shell 指令。</p>
    ${
			hasAny
				? `
    ${renderGroup("Commands", commands, "command")}
    ${renderGroup("Agents", agents, "agent")}
    ${renderGroup("Rules", rules, "rule")}
    `
				: '<div class="info-box">無 Resources 資料</div>'
		}
  </div>
</div>`;
}

/**
 * 渲染 Environment Tab（Wave 3 C2 擴充：active profile + failed plugins）
 */
function renderTabEnvironment(data) {
	const zsh = data.zsh || {};
	const ai = data.ai || {};
	const permissions = data.permissions || {};
	const plugins = data.installedPlugins;
	const localPlugins = data.plugins || [];
	const extended = data.extended || {};

	// ZSH 模組
	const zshInstalled = zsh.installed || [];
	const zshAvailable = zsh.available || [];
	const modulesHtml =
		zshAvailable.length > 0
			? `<div class="module-list">${zshAvailable
					.map((m) => {
						const on = zshInstalled.includes(m);
						return `<span class="badge badge-${on ? "green" : "grey"}">${escapeHtml(m)}</span>`;
					})
					.join("")}</div>`
			: '<span class="badge badge-grey">無模組資料</span>';

	// AI
	const aiModel = escapeHtml(ai.model || data.model || "—");
	const aiEffort = escapeHtml(ai.effort || "—");
	const aiRepo = escapeHtml(ai.repoModel || "—");

	// Permissions
	const allowRules = permissions.allow || [];
	const denyRules = permissions.deny || [];
	const permHtml =
		allowRules.length > 0
			? `<div style="margin-bottom:8px"><strong>Allow（${allowRules.length}）</strong>
      <div style="margin-top:4px">${allowRules.map((r) => `<div class="mono" style="font-size:.8rem;margin:2px 0">${escapeHtml(r)}</div>`).join("")}</div></div>`
			: '<p style="color:var(--text-dim);font-size:.85rem">無 allow 規則</p>';
	const denyHtml =
		denyRules.length > 0
			? `<div><strong>Deny（${denyRules.length}）</strong>
      <div style="margin-top:4px">${denyRules.map((r) => `<div class="mono" style="font-size:.8rem;color:var(--red);margin:2px 0">${escapeHtml(r)}</div>`).join("")}</div></div>`
			: "";

	// Plugins
	let pluginsHtml = "";
	if (plugins === null) {
		pluginsHtml =
			'<p style="color:var(--text-dim);font-size:.85rem">Claude CLI 不可用，無法讀取已安裝 plugins</p>';
	} else if (!plugins || plugins.length === 0) {
		pluginsHtml =
			'<p style="color:var(--text-dim);font-size:.85rem">尚未安裝任何 Anthropic 官方 plugin</p>';
	} else {
		pluginsHtml = plugins
			.map(
				(pl) =>
					`<div class="badge badge-green">${escapeHtml(pl.name)}${pl.version ? ` v${escapeHtml(pl.version)}` : ""}</div>`,
			)
			.join("");
	}
	if (localPlugins.length > 0) {
		pluginsHtml += `<div style="margin-top:8px;font-size:.82rem;color:var(--text-dim)">本地構建（${localPlugins.length} 個）：${localPlugins.map((pl) => escapeHtml(pl.name)).join("、")}</div>`;
	}

	// Active Profile（Wave 3 C2）
	const activeProfile =
		data.activeProfile || data.configStatus?.activeProfile || null;
	const profileHtml = activeProfile
		? `<div style="margin-bottom:8px"><strong>Active Profile：</strong> <span class="badge badge-blue">${escapeHtml(activeProfile)}</span></div>`
		: "";

	// Failed Plugins（Wave 3 C2）— 從 mcp.enabledPlugins 與 installedPlugins 差集計算
	const mcpData = extended.mcp || {};
	const enabledInSettings = mcpData.enabledPlugins || [];
	const installedNames = Array.isArray(plugins)
		? plugins.map((p) => p.name)
		: [];
	const failedPlugins = enabledInSettings.filter(
		(name) =>
			installedNames.length > 0 && !installedNames.some((n) => n === name),
	);
	const failedPluginsHtml =
		failedPlugins.length > 0
			? `<div style="margin-top:8px"><strong style="color:var(--red)">未能載入的 Plugins（${failedPlugins.length}）：</strong>
      <div style="margin-top:4px">${failedPlugins.map((p) => `<span class="badge badge-red">${escapeHtml(p)}</span>`).join("")}</div></div>`
			: "";

	return `
<div id="tab-environment" class="tab-content">
  <div class="card">
    <div class="section-title">ZSH 模組</div>
    <p class="section-desc">已安裝 ${zshInstalled.length} / ${zshAvailable.length} 個</p>
    ${modulesHtml}
  </div>
  <div class="card">
    <div class="section-title">AI 模型</div>
    ${profileHtml}
    <p style="font-size:.88rem">模型：<strong>${aiModel}</strong></p>
    <p style="font-size:.88rem;margin-top:4px">推理強度：<strong>${aiEffort}</strong></p>
    ${aiRepo !== "—" ? `<p style="font-size:.88rem;margin-top:4px">Repo 分類模型：<strong>${aiRepo}</strong></p>` : ""}
  </div>
  <div class="card">
    <div class="section-title">Permissions 摘要</div>
    ${permHtml}
    ${denyHtml}
  </div>
  <div class="card">
    <div class="section-title">Plugins</div>
    ${pluginsHtml}
    ${failedPluginsHtml}
  </div>
</div>`;
}

/**
 * 渲染 Audit Tab（Wave 3 C2 擴充：last rules verify result）
 * 顯示快取時間戳、安裝統計；若無快取則提示執行 d:setup
 */
function renderTabAudit(data) {
	const ts = data.cachedTimestamp || data.timestamp || null;
	const installed = data.installed || {};
	const mode = data.mode || "—";
	const stacks = data.stacks || [];
	const repos = data.repos || [];
	const extended = data.extended || {};

	if (!ts && !installed.commands && !installed.agents) {
		return `
<div id="tab-audit" class="tab-content">
  <div class="info-box">
    執行 <code>d:setup</code> 以取得最新分析資料，Audit 頁籤將顯示快取時間戳與安裝統計。
  </div>
</div>`;
	}

	const rows = [
		["快取時間戳", ts || "—"],
		["模式", mode === "auto" ? "自動" : mode === "manual" ? "手動" : mode],
		["Commands", installed.commands?.length ?? "—"],
		["Agents", installed.agents?.length ?? "—"],
		["Rules", installed.rules?.length ?? "—"],
		["ZSH 模組", installed.modules?.length ?? "—"],
		["技術棧", stacks.length > 0 ? stacks.length : "—"],
		["Repos", repos.length > 0 ? repos.length : "—"],
	];

	const rowsHtml = rows
		.map(
			([k, v]) =>
				`<tr><td style="color:var(--text-dim);width:130px">${escapeHtml(k)}</td><td><strong>${escapeHtml(String(v))}</strong></td></tr>`,
		)
		.join("");

	// Rules Verify 結果（Wave 3 C2）
	// 從 state.json managed 中統計 rules/ 相關項目的 drift 狀態
	const stateData = extended.state || {};
	const driftItems = Array.isArray(extended.drift) ? extended.drift : [];
	const managedCount = Object.keys(stateData.managed || {}).length;
	const driftCount = driftItems.length;
	const rulesVerifyScore = managedCount > 0 ? managedCount - driftCount : null;

	let rulesVerifyHtml = "";
	if (rulesVerifyScore !== null) {
		const color =
			driftCount === 0
				? "var(--green)"
				: driftCount <= 2
					? "var(--yellow)"
					: "var(--red)";
		const label = driftCount === 0 ? "全數通過" : `${driftCount} 個 drift`;
		rulesVerifyHtml = `
<div class="card">
  <div class="section-title">Rules Verify 結果</div>
  <div style="display:flex;align-items:center;gap:12px">
    <div style="font-size:1.8rem;font-weight:700;color:${color}">${rulesVerifyScore}/${managedCount}</div>
    <div>
      <div style="font-size:.9rem;color:${color};font-weight:600">${escapeHtml(label)}</div>
      <div style="font-size:.78rem;color:var(--text-dim)">managed 檔案完整性檢查</div>
    </div>
  </div>
  ${
		driftCount > 0
			? `<div style="margin-top:10px;font-size:.82rem;color:var(--text-dim)">詳細 drift 清單請至 <strong>State</strong> 頁籤查看。</div>`
			: ""
	}
</div>`;
	}

	return `
<div id="tab-audit" class="tab-content">
  <div class="card">
    <div class="section-title">安裝摘要</div>
    <table>${rowsHtml}</table>
  </div>
  ${rulesVerifyHtml}
</div>`;
}

/**
 * 將扁平技術清單依類型分組，產出分類後的物件
 *
 * 分類規則依序套用（先匹配者先歸類，避免重複），未命中任何規則的項目歸入「其他」。
 * 規則的 `cat` 欄位為顯示名稱，`test` 函式接受小寫技術名稱回傳 boolean。
 *
 * @param {string[]} flatList - 扁平技術名稱陣列（來自 d:setup 快取）
 * @returns {Record<string, string[]>} 以分類名稱為 key、對應技術名稱陣列為 value 的物件
 */
function classifyTechs(flatList) {
	// 分類規則：依優先順序排列，先匹配者先佔用，同一技術不重複分類
	const rules = [
		{
			cat: "Vue / Nuxt",
			test: (t) =>
				/^(vue$|vue2|vue3|nuxt|vue-router|vueuse|pinia|vuex|xstate)/.test(t),
		},
		{ cat: "TypeScript", test: (t) => t === "typescript" },
		{ cat: "測試", test: (t) => /jest|vitest|cypress|playwright/.test(t) },
		{ cat: "表單驗證", test: (t) => /vee-validate|yup/.test(t) },
		{
			cat: "CSS / 樣式",
			test: (t) =>
				/sass|postcss|tailwind|bootstrap|style-dict/.test(
					t.replace(/@[^/]+\//, ""),
				),
		},
		{
			cat: "UI 組件",
			test: (t) =>
				/element-plus|vant|flowbite|swiper|splide|web-design|fontawesome|lottie/.test(
					t,
				),
		},
		{ cat: "i18n", test: (t) => /i18n/.test(t) },
		{
			cat: "Build Tools",
			test: (t) =>
				/vite|webpack|unbuild|turbo|gulp|changeset|storybook|npm-run|cross-env|svg2|^del$|^sharp$/.test(
					t.replace(/@[^/]+\//, ""),
				),
		},
		{
			cat: "HTTP / API",
			test: (t) =>
				/^(axios|got|qs|web-vitals|socket\.io)/.test(t.replace(/@[^/]+\//, "")),
		},
		{ cat: "Email", test: (t) => /mjml|mailchimp/.test(t) },
		{
			cat: "後端 / 基礎設施",
			test: (t) =>
				/^(php|nginx|docker|postgres|redis|jaeger|pino|winston)/.test(t),
		},
		{
			cat: "CLI / DevTools",
			test: (t) => /listr2|clack|commander|picocolors|eslint/.test(t),
		},
		{
			cat: "工具庫",
			test: (t) =>
				/^(lodash|lodash-es|dayjs|luxon|semver|dotenv|yaml)$/.test(t),
		},
		{
			cat: "第三方服務",
			test: (t) => /adyen|mixpanel|markercluster|gtm-support|twilio/.test(t),
		},
	];
	// 已分配技術的去重集合，防止同一技術出現在多個分類
	const used = new Set();
	// 最終輸出物件：{ 分類名稱: [技術名稱, ...] }
	const result = {};
	for (const { cat, test } of rules) {
		// 只挑選尚未被其他分類佔用且符合當前規則的技術
		const matched = flatList.filter((t) => !used.has(t) && test(t));
		if (matched.length > 0) {
			result[cat] = matched;
			// 標記已分配，後續規則不再重複匹配
			for (const t of matched) used.add(t);
		}
	}
	// 所有規則皆未命中的技術歸入「其他」分類
	const rest = flatList.filter((t) => !used.has(t));
	if (rest.length > 0) result["其他"] = rest;
	return result;
}

/**
 * 渲染 Tech Stacks Tab（條件顯示）
 *
 * 輸入資料可能有三種形狀：
 *   1. 扁平字串陣列（舊格式快取）→ 直接傳入 classifyTechs() 分類
 *   2. 物件僅含 "uncategorized" 單一 key（d:setup 寫入時尚未分類）→ 同上
 *   3. 已分類物件（包含多個 cat key）→ 直接使用
 *
 * @param {string[] | Record<string, string[]>} cachedTechStacks - 技術棧資料（來自快取）
 */
function renderTabTechStacks(cachedTechStacks) {
	// flat：若輸入是陣列則直接使用，否則為 null
	const flat = Array.isArray(cachedTechStacks) ? cachedTechStacks : null;
	// keys：物件時取 key 清單，用於判斷是否僅有 uncategorized 分組
	const keys = flat ? null : Object.keys(cachedTechStacks || {});
	// shouldClassify：需要重新分類的條件——扁平陣列 或 只有 uncategorized 單一 key
	const shouldClassify =
		flat !== null ||
		(keys !== null && keys.length === 1 && keys[0] === "uncategorized");

	// normalized：最終用來渲染的已分類物件
	let normalized;
	if (flat !== null) {
		// 情況 1：扁平陣列，送入分類器
		normalized = flat.length > 0 ? classifyTechs(flat) : {};
	} else if (shouldClassify && keys !== null) {
		// 情況 2：單一 uncategorized key，取其值送入分類器
		normalized = classifyTechs((cachedTechStacks || {})["uncategorized"] || []);
	} else {
		// 情況 3：已分類物件，直接使用
		normalized = cachedTechStacks || {};
	}
	// 過濾掉空分類，只保留有技術名稱的 entry
	const entries = Object.entries(normalized).filter(
		([, techs]) => Array.isArray(techs) && techs.length > 0,
	);

	if (entries.length === 0) return "";

	const categoriesHtml = entries
		.map(([cat, techs]) => {
			const techBadges = techs
				.map((t) => `<span class="badge badge-blue">${escapeHtml(t)}</span>`)
				.join("");
			return `
<details>
  <summary>${escapeHtml(cat)} <span class="badge badge-grey" style="font-size:.7rem">${techs.length}</span></summary>
  <div class="details-body">${techBadges}</div>
</details>`;
		})
		.join("");

	const total = entries.reduce((s, [, t]) => s + t.length, 0);

	return `
<div id="tab-techstacks" class="tab-content">
  <div class="card">
    <div class="section-title">技術棧（${total} 個，${entries.length} 類）</div>
    ${categoriesHtml}
  </div>
</div>`;
}

/**
 * 渲染 Repos Tab（條件顯示）
 *
 * 快取格式相容兩種形狀：
 *   - 純字串（舊快取）："org/repo-name"
 *   - 物件（新快取）：{ name, role, localPath }
 * 兩種格式均可正確渲染；meta 資訊（role / localPath）只在物件格式且有值時顯示。
 *
 * @param {(string | { name?: string, role?: string, path?: string, localPath?: string, repo?: string, fullName?: string })[]} cachedRepos
 */
function renderTabRepos(cachedRepos) {
	if (!cachedRepos || cachedRepos.length === 0) return "";

	const cards = cachedRepos
		.map((repo) => {
			// isStr：舊快取為純字串，新快取為物件
			const isStr = typeof repo === "string";
			// raw：提取 repo 全名（org/repo），兼容多種欄位名稱
			const raw = isStr ? repo : repo.name || repo.repo || repo.fullName || "—";
			// 顯示格式：若含 "/" 則將 org 部分降低不透明度，視覺區分 org / repo-name
			const slash = raw.indexOf("/");
			const nameHtml =
				slash > -1
					? `<span style="opacity:.6">${escapeHtml(raw.slice(0, slash + 1))}</span>${escapeHtml(raw.slice(slash + 1))}`
					: escapeHtml(raw);
			// role / repoPath：僅物件格式才有；純字串快取沒有 meta 資訊
			const role = isStr ? null : repo.role || null;
			const repoPath = isStr ? null : repo.path || repo.localPath || null;
			// role badge 顏色：main 為綠色，其餘（temp / secondary）為灰色
			const roleColor = role === "main" ? "green" : "grey";
			// metaHtml：只有在 role 或 repoPath 至少一個有值時才渲染，避免顯示空行
			const metaHtml =
				role || repoPath
					? `
  <div class="repo-meta">
    ${role ? `<span class="badge badge-${roleColor}">${escapeHtml(role)}</span>` : ""}
    ${repoPath ? `<span class="mono" style="font-size:.8rem">${escapeHtml(repoPath)}</span>` : ""}
  </div>`
					: "";
			return `
<div class="repo-card">
  <div class="repo-name">${nameHtml}</div>${metaHtml}
</div>`;
		})
		.join("");

	return `
<div id="tab-repos" class="tab-content">
  <div class="card">
    <div class="section-title">Repos（${cachedRepos.length} 個）</div>
    ${cards}
  </div>
</div>`;
}

// ── 5 個新 Tab 渲染函式（Wave 3 C2）────────────────────────────

/**
 * 渲染 Hooks Tab
 *
 * 從 data.extended.hooks（由 collect-unified.mjs readHooksDetail() 提供）讀取資料，
 * 依 event 名稱分組後以表格形式展示每個 hook 的名稱、event、script 路徑和健康狀態。
 *
 * 健康狀態判斷規則：
 *   - healthy：exists=true 且 executable=true
 *   - missing：exists=false（腳本檔案找不到）
 *   - not executable：exists=true 但 executable=false（缺少執行權限）
 *   - inline（node -e）：無實體檔案，永遠視為 healthy
 */
function renderTabHooks(data) {
	// 擴充資料來自 collect-unified.mjs collectExtendedData()
	const extended = data.extended || {};
	// hooksData 結構：{ hooks: HookEntry[], total: number, healthy: number }
	const hooksData = extended.hooks || { hooks: [], total: 0, healthy: 0 };
	const hooks = hooksData.hooks || [];

	if (hooks.length === 0) {
		return `
<div id="tab-hooks" class="tab-content">
  <div class="info-box">暫無 Hooks 資料（~/.claude/hooks.json 為空或不存在）。</div>
</div>`;
	}

	// 依 event 名稱分組（如 PreToolUse、PostToolUse、Stop 等）
	const byEvent = /** @type {Record<string, typeof hooks>} */ ({});
	for (const h of hooks) {
		if (!byEvent[h.event]) byEvent[h.event] = [];
		byEvent[h.event].push(h);
	}

	// healthy / total 計數，用於標題顯示
	const healthyCount = hooksData.healthy ?? 0;
	const totalCount = hooksData.total ?? hooks.length;

	let groupsHtml = "";
	for (const [event, items] of Object.entries(byEvent).sort()) {
		const rows = items
			.map((h) => {
				// 狀態圖示：healthy=✅，否則=❌
				const statusIcon = h.exists && h.executable ? "✅" : "❌";
				// 狀態 badge：三種狀態對應三種顏色
				const statusBadge =
					h.exists && h.executable
						? '<span class="badge badge-green">healthy</span>'
						: !h.exists
							? '<span class="badge badge-red">missing</span>'
							: '<span class="badge badge-yellow">not executable</span>';
				// 名稱截短：超過 48 字元截斷並加省略號，完整名稱保留於 title 屬性
				const shortName =
					h.name.length > 48 ? h.name.slice(0, 46) + "…" : h.name;
				return `<tr>
  <td title="${escapeHtml(h.name)}" style="max-width:220px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escapeHtml(shortName)}</td>
  <td><span class="badge badge-blue">${escapeHtml(event)}</span></td>
  <td class="mono" style="font-size:.78rem;word-break:break-all;max-width:360px">${escapeHtml(h.script)}</td>
  <td>${statusIcon} ${statusBadge}</td>
</tr>`;
			})
			.join("");

		groupsHtml += `
<details open>
  <summary>${escapeHtml(event)} <span class="badge badge-grey" style="font-size:.7rem">${items.length}</span></summary>
  <div class="details-body" style="padding:0">
    <table>
      <thead><tr>
        <th>名稱</th>
        <th>Event</th>
        <th>Script</th>
        <th>狀態</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</details>`;
	}

	return `
<div id="tab-hooks" class="tab-content">
  <div class="card">
    <div class="section-title">Hooks（${totalCount} 個，${healthyCount} healthy）</div>
    <p class="section-desc">來源：~/.claude/hooks.json</p>
    ${groupsHtml}
  </div>
</div>`;
}

/**
 * 渲染 State Tab
 * 顯示 state.json 摘要：managed count、choices/decisions、drift items
 */
function renderTabState(data) {
	const extended = data.extended || {};
	const stateData = extended.state || {};
	const driftItems = Array.isArray(extended.drift) ? extended.drift : [];

	const managed = stateData.managed || {};
	const choices = stateData.choices || {};
	const managedKeys = Object.keys(managed);
	const choicesKeys = Object.keys(choices);

	// Managed 清單
	const managedRowsHtml =
		managedKeys.length > 0
			? managedKeys
					.map((relPath) => {
						const entry = managed[relPath];
						const hasDrift = driftItems.some((d) => d.path === relPath);
						const badgeHtml = hasDrift
							? '<span class="badge badge-red">drift</span>'
							: '<span class="badge badge-green">ok</span>';
						const source = entry.source || "—";
						const installedAt = entry.installedAt
							? entry.installedAt.slice(0, 10)
							: "—";
						return `<tr>
  <td class="mono" style="font-size:.78rem">${escapeHtml(relPath)}</td>
  <td><span class="badge badge-grey" style="font-size:.72rem">${escapeHtml(source)}</span></td>
  <td style="font-size:.78rem;color:var(--text-dim)">${escapeHtml(installedAt)}</td>
  <td>${badgeHtml}</td>
</tr>`;
					})
					.join("")
			: '<tr><td colspan="4" style="color:var(--text-dim);padding:12px">暫無 managed 項目</td></tr>';

	// Choices / Decisions
	const choicesRowsHtml =
		choicesKeys.length > 0
			? choicesKeys
					.map((relPath) => {
						const choice = choices[relPath];
						const decisionColor =
							choice.decision === "keep-local"
								? "yellow"
								: choice.decision === "use-ab-tao"
									? "blue"
									: choice.decision === "merge"
										? "purple"
										: "grey";
						return `<tr>
  <td class="mono" style="font-size:.78rem">${escapeHtml(relPath)}</td>
  <td><span class="badge badge-${decisionColor}">${escapeHtml(choice.decision || "—")}</span></td>
  <td style="font-size:.78rem;color:var(--text-dim)">${escapeHtml((choice.lockedAt || "").slice(0, 10))}</td>
</tr>`;
					})
					.join("")
			: '<tr><td colspan="3" style="color:var(--text-dim);padding:12px">暫無 choices 記錄</td></tr>';

	// Drift 清單
	let driftHtml = "";
	if (driftItems.length > 0) {
		const driftRows = driftItems
			.map((d) => {
				const decisionColor =
					d.decision === "deleted"
						? "red"
						: d.decision === "modified"
							? "yellow"
							: "grey";
				return `<tr>
  <td class="mono" style="font-size:.78rem">${escapeHtml(d.path)}</td>
  <td><span class="badge badge-${decisionColor}">${escapeHtml(d.decision)}</span></td>
  <td class="mono" style="font-size:.72rem;color:var(--text-dim)">${d.localHash ? `${escapeHtml(d.localHash.slice(0, 12))}...` : "—"}</td>
</tr>`;
			})
			.join("");

		driftHtml = `
<div class="card" style="border-color:var(--yellow)">
  <div class="section-title" style="color:var(--yellow)">⚠ Drift 清單（${driftItems.length} 個）</div>
  <table>
    <thead><tr><th>路徑</th><th>狀態</th><th>本地 Hash</th></tr></thead>
    <tbody>${driftRows}</tbody>
  </table>
</div>`;
	} else if (managedKeys.length > 0) {
		driftHtml = `
<div class="card" style="border-color:var(--green)">
  <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
    <span style="font-size:1.4rem">✅</span>
    <span style="color:var(--green);font-weight:600">所有 managed 檔案均無 drift</span>
  </div>
</div>`;
	}

	return `
<div id="tab-state" class="tab-content">
  ${driftHtml}
  <div class="card">
    <div class="section-title">Managed 檔案（${managedKeys.length} 個）</div>
    <p class="section-desc">由 ab-tao 追蹤的檔案清單（state.json v${escapeHtml(stateData.version || "—")}）</p>
    <table>
      <thead><tr><th>路徑</th><th>來源</th><th>安裝日期</th><th>狀態</th></tr></thead>
      <tbody>${managedRowsHtml}</tbody>
    </table>
  </div>
  <div class="card">
    <div class="section-title">Choices / Decisions（${choicesKeys.length} 個）</div>
    <p class="section-desc">使用者對各檔案的配置選擇記錄</p>
    <table>
      <thead><tr><th>路徑</th><th>決策</th><th>鎖定時間</th></tr></thead>
      <tbody>${choicesRowsHtml}</tbody>
    </table>
  </div>
</div>`;
}

/**
 * 渲染 Sync Tab
 * 顯示 SOURCES_CONFIG 4 個來源 + state.json.sync 範圍
 */
function renderTabSync(data) {
	const extended = data.extended || {};
	const stateData = extended.state || {};
	const sync = stateData.sync || { tool: "ab-tao", included: [], excluded: [] };

	// 4 個 AI 來源（硬編碼名稱 + 說明，與 commons 的 SOURCES_CONFIG 對應）
	const sources = [
		{
			key: "ecc",
			name: "ECC（Everything Claude Code）",
			desc: "全功能 commands、agents、rules、skills、docs",
			url: "https://github.com/disler/everything-claude-code",
		},
		{
			key: "anthropic",
			name: "Anthropic 官方資源",
			desc: "官方 prompting guides、安全規則",
			url: "https://github.com/anthropics/claude-code",
		},
		{
			key: "superpowers",
			name: "Superpowers",
			desc: "進階 prompts、multi-agent 工作流",
			url: "https://github.com/NicolasZon/Claude-Superpowers",
		},
		{
			key: "context-engineering",
			name: "Context Engineering",
			desc: "PRP（Product Requirements Prompt）框架",
			url: "https://github.com/coleam00/context-engineering-intro",
		},
	];

	const sourcesHtml = sources
		.map(
			(s) => `
<div class="card" style="margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-weight:600;color:var(--accent)">${escapeHtml(s.name)}</div>
      <div style="font-size:.82rem;color:var(--text-dim);margin-top:2px">${escapeHtml(s.desc)}</div>
    </div>
    <span class="badge badge-grey" style="font-size:.72rem;word-break:break-all">${escapeHtml(s.url)}</span>
  </div>
</div>`,
		)
		.join("");

	// Sync 範圍
	const includedHtml =
		sync.included.length > 0
			? sync.included
					.map((p) => `<span class="badge badge-green">${escapeHtml(p)}</span>`)
					.join("")
			: '<span style="color:var(--text-dim);font-size:.85rem">（空）</span>';

	const excludedHtml =
		sync.excluded.length > 0
			? sync.excluded
					.map((p) => `<span class="badge badge-red">${escapeHtml(p)}</span>`)
					.join("")
			: '<span style="color:var(--text-dim);font-size:.85rem">（空）</span>';

	return `
<div id="tab-sync" class="tab-content">
  <div class="card">
    <div class="section-title">AI 來源（${sources.length} 個）</div>
    <p class="section-desc">執行 <code>pnpm run c:ai-sync --select</code> 可互動式選擇同步。</p>
    ${sourcesHtml}
  </div>
  <div class="card">
    <div class="section-title">同步範圍（state.json.sync）</div>
    <p class="section-desc">工具：<strong>${escapeHtml(sync.tool || "ab-tao")}</strong></p>
    <div style="margin-bottom:10px">
      <div class="section-title" style="font-size:.82rem;margin-bottom:6px">Included（${sync.included.length}）</div>
      <div>${includedHtml}</div>
    </div>
    <div>
      <div class="section-title" style="font-size:.82rem;margin-bottom:6px">Excluded（${sync.excluded.length}）</div>
      <div>${excludedHtml}</div>
    </div>
  </div>
</div>`;
}

/**
 * 渲染 Memory & Plans Tab
 * 顯示 global + per-project memory/plans/tasks 樹狀結構
 */
function renderTabMemory(data) {
	const extended = data.extended || {};
	const memoryData = extended.memory || {
		global: { memory: [], plans: [], tasks: [] },
		projects: [],
	};

	const global = memoryData.global || { memory: [], plans: [], tasks: [] };
	const projects = memoryData.projects || [];

	const renderFileList = (files, emptyText = "（空）") => {
		if (!files || files.length === 0) {
			return `<span style="color:var(--text-dim);font-size:.82rem">${emptyText}</span>`;
		}
		return files
			.map(
				(f) =>
					`<div class="mono" style="font-size:.8rem;padding:2px 0;color:var(--text)">${escapeHtml(f)}</div>`,
			)
			.join("");
	};

	const renderLayer = (label, memory, plans, tasks, badge = "blue") =>
		`<details open>
  <summary>${escapeHtml(label)}
    <span class="badge badge-${badge}" style="font-size:.7rem">${memory.length + plans.length + tasks.length} 個</span>
  </summary>
  <div class="details-body">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
      <div>
        <div style="font-size:.78rem;font-weight:600;color:var(--text-dim);margin-bottom:4px">Memory（${memory.length}）</div>
        ${renderFileList(memory)}
      </div>
      <div>
        <div style="font-size:.78rem;font-weight:600;color:var(--text-dim);margin-bottom:4px">Plans（${plans.length}）</div>
        ${renderFileList(plans)}
      </div>
      <div>
        <div style="font-size:.78rem;font-weight:600;color:var(--text-dim);margin-bottom:4px">Tasks（${tasks.length}）</div>
        ${renderFileList(tasks)}
      </div>
    </div>
  </div>
</details>`;

	const globalHtml = renderLayer(
		"Global（~/.claude/）",
		global.memory,
		global.plans,
		global.tasks,
		"purple",
	);

	const projectsHtml =
		projects.length > 0
			? projects
					.map((proj) => {
						// 嘗試解碼 encoded 路徑為可讀名稱
						const label = proj.encoded
							.replace(/^-Users-[^-]+-/, "~/")
							.replace(/-/g, "/");
						return renderLayer(
							label,
							proj.memory,
							proj.plans,
							proj.tasks,
							"grey",
						);
					})
					.join("")
			: '<div class="info-box" style="margin-top:12px">無專案層 memory/plans/tasks 資料</div>';

	const totalFiles =
		global.memory.length +
		global.plans.length +
		global.tasks.length +
		projects.reduce(
			(s, p) => s + p.memory.length + p.plans.length + p.tasks.length,
			0,
		);

	return `
<div id="tab-memory" class="tab-content">
  <div class="card">
    <div class="section-title">Memory & Plans（${totalFiles} 個檔案）</div>
    <p class="section-desc">全域與各專案的 memory、plans、tasks 文件樹。</p>
    ${globalHtml}
    ${projects.length > 0 ? `<div style="margin-top:12px"><div class="section-title" style="font-size:.88rem">專案層（${projects.length} 個）</div></div>${projectsHtml}` : projectsHtml}
  </div>
</div>`;
}

/**
 * 渲染 MCP & Plugins Tab
 * 顯示 MCP servers 清單 + enabledPlugins
 */
function renderTabMcp(data) {
	const extended = data.extended || {};
	const mcpData = extended.mcp || { servers: [], enabledPlugins: [] };
	const servers = mcpData.servers || [];
	const enabledPlugins = mcpData.enabledPlugins || [];

	// MCP Servers 表格
	let serversHtml = "";
	if (servers.length === 0) {
		serversHtml =
			'<div class="info-box">未配置 MCP Servers（~/.claude/settings.json 的 mcpServers 為空）。</div>';
	} else {
		const rows = servers
			.map(
				(s) => `<tr>
  <td style="font-weight:600;color:var(--accent)">${escapeHtml(s.name)}</td>
  <td><span class="badge badge-${s.type === "sse" || s.type === "http" ? "blue" : "grey"}">${escapeHtml(s.type)}</span></td>
  <td class="mono" style="font-size:.78rem;word-break:break-all">${escapeHtml(s.command)}</td>
</tr>`,
			)
			.join("");

		serversHtml = `
<table>
  <thead><tr><th>名稱</th><th>類型</th><th>Command / URL</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
	}

	// Enabled Plugins
	let pluginsHtml = "";
	if (enabledPlugins.length === 0) {
		pluginsHtml =
			'<p style="color:var(--text-dim);font-size:.85rem">暫無啟用的 Plugins。</p>';
	} else {
		pluginsHtml = enabledPlugins
			.map((p) => {
				// 格式：name@publisher
				const parts = p.split("@");
				const pluginName = parts[0] || p;
				const publisher = parts[1] || "";
				return `<div class="skill-item">
  <span class="skill-name">${escapeHtml(pluginName)}</span>
  ${publisher ? `<span class="badge badge-purple">${escapeHtml(publisher)}</span>` : ""}
  <span class="skill-status enabled">enabled</span>
</div>`;
			})
			.join("");
	}

	return `
<div id="tab-mcp" class="tab-content">
  <div class="card">
    <div class="section-title">MCP Servers（${servers.length} 個）</div>
    <p class="section-desc">來源：~/.claude/settings.json mcpServers 區塊</p>
    ${serversHtml}
  </div>
  <div class="card">
    <div class="section-title">Enabled Plugins（${enabledPlugins.length} 個）</div>
    <p class="section-desc">來源：~/.claude/settings.json enabledPlugins 區塊</p>
    ${pluginsHtml}
  </div>
</div>`;
}

// ── Script Panel 與互動 JS ────────────────────────────────────

function renderScriptPanel() {
	return `
<div class="script-panel" id="scriptPanel">
  <div class="script-panel-header">
    <span id="scriptPanelLabel">Shell Script Panel（0 個指令）</span>
    <div style="display:flex;gap:8px">
      <button class="btn btn-copy" onclick="copyScript()">複製 Script</button>
      <button class="btn" onclick="clearScript()">清除</button>
      <button class="btn" onclick="closePanel()">關閉</button>
    </div>
  </div>
  <pre id="scriptOutput">（尚無指令；在 Skills 或 Resources 頁籤切換項目狀態）</pre>
</div>`;
}

/**
 * 產生內嵌 <script> 的字串，包含 Dashboard 所有互動邏輯
 *
 * 重要實作細節：
 *   本函式的回傳值本身是一個 template literal（反引號包裹），其中嵌入的 JS 程式碼
 *   不能直接使用反斜線（\）或反引號（`）字面量，否則 Node.js 在解析時會因
 *   多層 escape 吞字而在輸出的 HTML 產生 SyntaxError。
 *
 *   解法：以 String.fromCharCode() 在執行期動態取得這兩個字元：
 *     BK（backslash）= charCode 92
 *     BT（backtick）= charCode 96
 *   需要這兩個字元的地方全部用變數拼接，不出現字面量。
 */
function renderInlineScript() {
	return `
<script>
(function() {
  // Script Panel 累積的 shell 指令列表；切換 checkbox 時動態增減
  var lines = [];
  // BK / BT 以 charCode 取得，避免在外層 template literal 中引發 escape 吞字問題
  var BK = String.fromCharCode(92); // 反斜線（charCode 92）
  var BT = String.fromCharCode(96); // 反引號（charCode 96）

  function updatePanel() {
    var pre   = document.getElementById('scriptOutput');
    var label = document.getElementById('scriptPanelLabel');
    var panel = document.getElementById('scriptPanel');
    if (!pre || !label || !panel) return;
    if (lines.length === 0) {
      pre.textContent = '（尚無指令；在 Skills 或 Resources 頁籤切換項目狀態）';
      label.textContent = 'Shell Script Panel（0 個指令）';
      panel.classList.remove('visible');
    } else {
      pre.textContent = '#!/bin/sh\\n' + lines.join('\\n');
      label.textContent = 'Shell Script Panel（' + lines.length + ' 個指令）';
      panel.classList.add('visible');
    }
  }

  // ── Skills toggle ──
  window.onSkillToggle = function(cb) {
    var skillPath = cb.dataset.skillPath; // 相對路徑，如 "deep-research" 或 "ecc/deep-research"
    var nowOn   = cb.checked;
    // 雙引號轉義：防止 $、反引號、\\、" 在 shell 中展開或中斷引號
    var safePath = skillPath.split(BK).join(BK+BK).split('$').join(BK+'$').split(BT).join(BK+BT).split('"').join(BK+'"');
    var enabled  = '"$HOME/.claude/skills/' + safePath + '/SKILL.md"';
    var disabled = '"$HOME/.claude/skills/' + safePath + '/SKILL.md.disabled"';
    // 移除舊的同名指令
    lines = lines.filter(function(l) {
      return l.indexOf('/.claude/skills/' + skillPath) === -1;
    });
    if (nowOn) {
      // enable: .disabled → .md
      lines.push('mv ' + disabled + ' ' + enabled);
    } else {
      // disable: .md → .disabled
      lines.push('mv ' + enabled + ' ' + disabled);
    }
    updatePanel();
  };

  // ── Resources toggle ──
  window.onResToggle = function(cb) {
    var type   = cb.dataset.resType;
    var name   = cb.dataset.resName;
    var nowOn  = cb.checked;
    var dir    = type === 'command' ? 'commands' : type === 'agent' ? 'agents' : 'rules';
    // 雙引號轉義：防止 shell 元字元注入
    var safeName = name.split(BK).join(BK+BK).split('$').join(BK+'$').split(BT).join(BK+BT).split('"').join(BK+'"');
    var enabled  = '"$HOME/.claude/' + dir + '/' + safeName + '.md"';
    var disabled = '"$HOME/.claude/' + dir + '/' + safeName + '.md.disabled"';
    // 移除舊的同名指令
    lines = lines.filter(function(l) {
      return l.indexOf('/.claude/' + dir + '/' + name + '.md') === -1;
    });
    if (nowOn) {
      lines.push('mv ' + disabled + ' ' + enabled);
    } else {
      lines.push('mv ' + enabled + ' ' + disabled);
    }
    updatePanel();
  };

  // ── c:skills --find 快捷按鈕（Wave 3 C2）──
  window.copyFindSkillsCmd = function() {
    var cmd = 'pnpm run c:skills --find';
    navigator.clipboard.writeText(cmd).then(function() {
      alert('已複製：' + cmd);
    }).catch(function() {
      // fallback
      alert('請手動執行：' + cmd);
    });
  };

  // ── 複製腳本 ──
  window.copyScript = function() {
    var pre = document.getElementById('scriptOutput');
    if (!pre || !lines.length) return;
    navigator.clipboard.writeText(pre.textContent).then(function() {
      alert('已複製到剪貼板');
    });
  };

  // ── 清除腳本 ──
  window.clearScript = function() {
    lines = [];
    // 重置所有 checkbox 到初始狀態
    document.querySelectorAll('.skill-cb').forEach(function(cb) {
      var orig = cb.dataset.skillEnabled === '1';
      cb.checked = orig;
    });
    document.querySelectorAll('.res-cb').forEach(function(cb) {
      var orig = cb.dataset.resEnabled === '1';
      cb.checked = orig;
    });
    updatePanel();
  };

  // ── 關閉面板 ──
  window.closePanel = function() {
    var panel = document.getElementById('scriptPanel');
    if (panel) panel.classList.remove('visible');
  };

  // ── Tab 切換 ──
  document.querySelectorAll('.tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
      btn.classList.add('active');
      var target = document.getElementById('tab-' + btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
})();
</script>`;
}

// ── 主要組裝函式 ───────────────────────────────────────────────

/**
 * 產生完整統一 HTML 報告（自包含，無外部 CDN）
 *
 * @param {Object} data - 安裝/掃描資料，相容 d:report 與 d:status 兩種形狀
 * @returns {string} 完整 HTML 字串
 */
export function generateUnifiedReport(data) {
	const ts = new Date().toISOString().replace("T", " ").slice(0, 19);

	// 決定是否顯示條件 Tab
	const _raw = data.cachedTechStacks;
	const cachedTechStacks = Array.isArray(_raw)
		? _raw.length > 0
			? { uncategorized: _raw }
			: {}
		: _raw || {};
	const cachedRepos = data.cachedRepos || [];
	const hasTechStacks = Object.keys(cachedTechStacks).length > 0;
	const hasRepos = cachedRepos.length > 0;

	// 組合 Tab 按鈕（Wave 3 C2 新增 5 個 Tab）
	const tabButtons = [
		{ key: "overview", label: "Overview" },
		{ key: "skills", label: "Skills" },
		{ key: "resources", label: "Resources" },
		{ key: "environment", label: "Environment" },
		{ key: "audit", label: "Audit" },
		...(hasTechStacks ? [{ key: "techstacks", label: "Tech Stacks" }] : []),
		...(hasRepos ? [{ key: "repos", label: "Repos" }] : []),
		// 5 個新 Tab（永遠顯示，無資料時顯示空狀態）
		{ key: "hooks", label: "Hooks" },
		{ key: "state", label: "State" },
		{ key: "sync", label: "Sync" },
		{ key: "memory", label: "Memory & Plans" },
		{ key: "mcp", label: "MCP & Plugins" },
	];

	const tabNav = `
<nav class="tabs">
  ${tabButtons.map((t, i) => `<button class="tab${i === 0 ? " active" : ""}" data-tab="${t.key}">${escapeHtml(t.label)}</button>`).join("\n  ")}
</nav>`;

	const body = [
		tabNav,
		renderTabOverview(data),
		renderTabSkills(data),
		renderTabResources(data),
		renderTabEnvironment(data),
		renderTabAudit(data),
		...(hasTechStacks ? [renderTabTechStacks(cachedTechStacks)] : []),
		...(hasRepos ? [renderTabRepos(cachedRepos)] : []),
		// 5 個新 Tab（Wave 3 C2）
		renderTabHooks(data),
		renderTabState(data),
		renderTabSync(data),
		renderTabMemory(data),
		renderTabMcp(data),
		renderScriptPanel(),
		renderInlineScript(),
	].join("\n");

	return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ab-tao Dashboard</title>
<style>${getInlineStyles()}</style>
</head>
<body>
<div class="container">
<header>
  <h1>ab-tao Dashboard</h1>
  <div class="ts">${escapeHtml(ts)}</div>
</header>
${body}
<footer>Generated by ab-tao unified-renderer</footer>
</div>
</body>
</html>`;
}

/**
 * 儲存 HTML 並在預設瀏覽器開啟
 *
 * @param {Object} data - 傳入 generateUnifiedReport 的資料
 * @param {string} outputPath - 輸出檔案的絕對路徑（含檔名）
 * @returns {Promise<string>} 實際寫入的路徑
 */
export async function saveAndOpenReport(data, outputPath) {
	const html = generateUnifiedReport(data);
	const abs = path.resolve(outputPath);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, html, "utf-8");

	const cmd =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "start"
				: "xdg-open";
	const args = process.platform === "win32" ? ["", abs] : [abs];

	try {
		execFileSync(cmd, args);
	} catch {
		// 瀏覽器無法開啟時靜默略過，呼叫端可自行顯示路徑
	}

	return abs;
}
