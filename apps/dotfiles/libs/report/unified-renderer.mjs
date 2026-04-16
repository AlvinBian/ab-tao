/**
 * 統一 HTML Dashboard 渲染引擎
 *
 * 職責：為 d:report 和 d:status --report 提供單一 HTML 產生入口。
 * 匯出：generateUnifiedReport(data) / saveAndOpenReport(data, outputPath)
 *
 * 資料形狀說明：
 *   - 來自 d:report（report.mjs）：包含 installed、stacks、repos、perRepoReasoning 等安裝資料
 *   - 來自 d:status（status.mjs）：包含 commands、agents、rules、skills、hooks、zsh、slack、ai 等即時掃描資料
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
 * 渲染概覽 Tab
 */
function renderTabOverview(data) {
	// 相容兩種資料形狀
	const commands = data.commands || data.installed?.commands || [];
	const agents = data.agents || data.installed?.agents || [];
	const rules = data.rules || data.installed?.rules || [];
	const skills = data.skills || [];
	const hooks = data.hooks || [];

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

	return `
<div id="tab-overview" class="tab-content active">
  ${healthHtml}
  <div class="card">
    <div class="section-title">核心統計</div>
    <div class="stat-grid">${statsHtml}</div>
  </div>
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
 * 渲染 Environment Tab
 */
function renderTabEnvironment(data) {
	const zsh = data.zsh || {};
	const slack = data.slack || {};
	const ai = data.ai || {};
	const permissions = data.permissions || {};
	const plugins = data.installedPlugins;
	const localPlugins = data.plugins || [];

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

	// Slack
	const slackText =
		slack.mode === "off" || !slack.mode
			? "未啟用"
			: `${escapeHtml(slack.mode)}${slack.channelName ? ` #${escapeHtml(slack.channelName)}` : ""}`;

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

	return `
<div id="tab-environment" class="tab-content">
  <div class="card">
    <div class="section-title">ZSH 模組</div>
    <p class="section-desc">已安裝 ${zshInstalled.length} / ${zshAvailable.length} 個</p>
    ${modulesHtml}
  </div>
  <div class="card">
    <div class="section-title">Slack 設定</div>
    <p style="font-size:.88rem">模式：<strong>${slackText}</strong></p>
  </div>
  <div class="card">
    <div class="section-title">AI 模型</div>
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
  </div>
</div>`;
}

/**
 * 渲染 Audit Tab
 * 顯示快取時間戳、安裝統計；若無快取則提示執行 d:setup
 */
function renderTabAudit(data) {
	const ts = data.cachedTimestamp || data.timestamp || null;
	const installed = data.installed || {};
	const mode = data.mode || "—";
	const stacks = data.stacks || [];
	const repos = data.repos || [];

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

	return `
<div id="tab-audit" class="tab-content">
  <div class="card">
    <div class="section-title">安裝摘要</div>
    <table>${rowsHtml}</table>
  </div>
</div>`;
}

/**
 * 渲染 Tech Stacks Tab（條件顯示）
 * @param {Record<string, string[]>} cachedTechStacks
 */
function renderTabTechStacks(cachedTechStacks) {
	const entries = Object.entries(cachedTechStacks || {}).filter(
		([, techs]) => techs?.length > 0,
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
 * @param {{ name?: string, role?: string, path?: string, localPath?: string }[]} cachedRepos
 */
function renderTabRepos(cachedRepos) {
	if (!cachedRepos || cachedRepos.length === 0) return "";

	const cards = cachedRepos
		.map((repo) => {
			const name = repo.name || repo.repo || "—";
			const role = repo.role || "—";
			const repoPath = repo.path || repo.localPath || "—";
			const roleColor = role === "main" ? "green" : "grey";
			return `
<div class="repo-card">
  <div class="repo-name">${escapeHtml(name)}</div>
  <div class="repo-meta">
    <span class="badge badge-${roleColor}">${escapeHtml(role)}</span>
    <span class="mono" style="font-size:.8rem">${escapeHtml(repoPath)}</span>
  </div>
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

function renderInlineScript() {
	return `
<script>
(function() {
  // Script Panel 狀態
  var lines = [];

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
    // 雙引號轉義：防止 $、反引號、、" 在 shell 中展開或中斷引號
    var safePath = skillPath.replace(/\\/g, '\\\\').replace(/$/g, '\\$').replace(/\`/g, '\\\`').replace(/"/g, '\\"');
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
    var safeName = name.replace(/\\/g, '\\\\').replace(/$/g, '\\$').replace(/\`/g, '\\\`').replace(/"/g, '\\"');
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
	const cachedTechStacks = data.cachedTechStacks || {};
	const cachedRepos = data.cachedRepos || [];
	const hasTechStacks = Object.keys(cachedTechStacks).length > 0;
	const hasRepos = cachedRepos.length > 0;

	// 組合 Tab 按鈕
	const tabButtons = [
		{ key: "overview", label: "Overview" },
		{ key: "skills", label: "Skills" },
		{ key: "resources", label: "Resources" },
		{ key: "environment", label: "Environment" },
		{ key: "audit", label: "Audit" },
		...(hasTechStacks ? [{ key: "techstacks", label: "Tech Stacks" }] : []),
		...(hasRepos ? [{ key: "repos", label: "Repos" }] : []),
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
