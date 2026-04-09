/**
 * 計畫視圖格式化 — 將計畫資料轉換為可讀的 CLI 輸出
 *
 * 職責：組裝摘要、表格、icon、描述等顯示邏輯
 */

import fs from "node:fs";
import path from "node:path";
import { isEmpty } from "lodash-es";
import pc from "picocolors";
import {
	descBullet,
	getDescription,
	getRating,
} from "../config/descriptions.mjs";

// ── 資源 Model 對照 ──
const CMD_MODEL = {
	check: "haiku",
	test: "sonnet",
	"db-migration": "sonnet",
	slack: "haiku",
};
const AGENT_MODEL = {
	architect: "opus",
	debugger: "sonnet",
};

/** 從 SKILL.md 內容提取簡短描述（frontmatter description 或首行非標題文字） */
function extractSkillDesc(content) {
	if (!content) return "";
	const descMatch = content.match(
		/^---\n[\s\S]*?description:\s*["']?(.+?)["']?\s*$/m,
	);
	if (descMatch) return descMatch[1].trim().slice(0, 60);
	// fallback：首行非空非標題
	for (const line of content.split("\n")) {
		const t = line.trim();
		if (!t || t.startsWith("#") || t.startsWith("---")) continue;
		return t.slice(0, 60);
	}
	return "";
}

/**
 * 網格排列：固定列寬，每行多個項目
 *
 * @param {string[]} items - 項目列表
 * @param {number} cols - 每行列數（預設 4）
 * @param {number} colWidth - 每列寬度（預設 18）
 * @param {string} indent - 縮排字串（預設 '   '）
 * @returns {string[]} 格式化後的行陣列
 */
export function grid(items, cols = 4, colWidth = 18, indent = "   ") {
	const rows = [];
	for (let i = 0; i < items.length; i += cols) {
		const row = items
			.slice(i, i + cols)
			.map((s) => s.padEnd(colWidth))
			.join("");
		rows.push(`${indent}${row.trimEnd()}`);
	}
	return rows;
}

/**
 * 短列表 inline — 若超過最大值則截斷並顯示剩餘數量
 *
 * @param {string[]} items - 項目列表
 * @param {number} max - 最大顯示數量（預設 8）
 * @returns {string} 格式化後的字串
 */
export function inlineList(items, max = 8) {
	if (items.length <= max) return items.join("、");
	return `${items.slice(0, max).join("、")}… +${items.length - max}`;
}

/**
 * 格式化現有狀態 — ~/.claude/ 中已存在的資源
 *
 * @param {Object} existing - 現有狀態物件
 * @returns {string[]} 格式化後的行陣列
 */
export function formatExistingState(existing) {
	const lines = [];
	const existTotal =
		existing.commands.length + existing.agents.length + existing.rules.length;

	if (existTotal > 0) {
		const parts = [];
		if (existing.commands.length) parts.push(`${existing.commands.length} cmd`);
		if (existing.agents.length) parts.push(`${existing.agents.length} agent`);
		if (existing.rules.length) parts.push(`${existing.rules.length} rule`);
		const extras = [];
		if (existing.hasSettings) extras.push("settings");
		if (existing.hasHooks) extras.push("hooks");

		lines.push(
			`現有 ~/.claude/：${parts.join(" · ")}${extras.length ? ` · ${extras.join(" · ")}` : ""}`,
		);
	}

	return lines;
}

/**
 * 格式化 Repos 部分
 *
 * @param {Object[]} repos - 計畫中的 repos 陣列
 * @param {number} mainCount - 主力 repos 數
 * @param {number} tempCount - 臨時 repos 數
 * @param {number} toolCount - 工具 repos 數
 * @param {string} HOME - 家目錄路徑
 * @returns {string[]} 格式化後的行陣列
 */
export function formatRepos(repos, mainCount, tempCount, toolCount, HOME) {
	const lines = [];

	lines.push(
		`1. Repos（${mainCount} ⭐ 主力 · ${tempCount} 🔄 臨時${toolCount ? ` · ${toolCount} 🔧 工具` : ""}）`,
	);

	// 按組織分組
	const byOrg = {};
	for (const r of repos) {
		const org = r.fullName.split("/")[0];
		if (!byOrg[org]) byOrg[org] = [];
		byOrg[org].push(r);
	}

	for (const [org, orgRepos] of Object.entries(byOrg)) {
		lines.push(`   ${org}`);
		for (const r of orgRepos) {
			const icon = r.role === "main" ? "⭐" : r.role === "tool" ? "🔧" : "🔄";
			const loc = r.localPath
				? `~/${path.relative(HOME, r.localPath)}`
				: "未找到";
			lines.push(`     ${icon} ${r.fullName.split("/")[1]}  ${loc}`);
		}
	}

	return lines;
}

/**
 * 格式化全局配置
 *
 * @param {Object} globalConfig - 計畫中的 global 物件
 * @returns {string[]} 格式化後的行陣列
 */
export function formatGlobalConfig(globalConfig) {
	const lines = [];
	const g = globalConfig;

	lines.push(`2. 全局配置 → ~/.claude/ 推薦`);
	lines.push(`   Commands（${g.commands.length}）推薦`);
	const cmdItems = g.commands.map((c) => {
		const m = CMD_MODEL[c];
		return m ? `${c} ${pc.dim(m)}` : c;
	});
	lines.push(...grid(cmdItems));
	lines.push(`   Agents（${g.agents.length}）推薦`);
	const agentItems = g.agents.map((a) => {
		const m = AGENT_MODEL[a];
		return m ? `${a} ${pc.dim(m)}` : a;
	});
	lines.push(...grid(agentItems));
	lines.push(`   Rules（${g.rules.length}）`);
	lines.push(...grid(g.rules, 3, 24));
	lines.push(`   Hooks（${g.hooks.length}）推薦`);
	const hookNames = g.hooks.map((h) => (h.match(/\((.+)\)/) || ["", h])[1]);
	lines.push(...grid(hookNames, 4, 16));
	lines.push(
		`   Permission（${g.permissions?.allow?.length || 0} allow · ${g.permissions?.deny?.length || 0} deny）`,
	);
	lines.push(`   Model: ${g.settings.model} · AutoMemory`);

	return lines;
}

/**
 * 格式化技術棧
 *
 * @param {Object} plan - 完整計畫物件
 * @returns {string[]} 格式化後的行陣列
 */
export function formatTechStacks(plan) {
	const lines = [];

	const CATEGORY_ORDER = [
		"前端框架",
		"測試框架",
		"建構工具",
		"CSS 與樣式",
		"狀態管理",
		"UI 元件庫",
		"HTTP 與 API",
		"國際化",
		"表單驗證",
		"第三方整合",
		"安全與認證",
		"後端框架",
		"基礎設施",
		"容器化",
		"監控與追蹤",
		"工具函式",
		"CLI 工具",
		"即時通訊",
		"其他",
	];

	if (!isEmpty(plan.techStacks)) {
		const categorized = plan._pipelineResult?.categorizedTechs;
		if (categorized instanceof Map && categorized.size > 0) {
			lines.push(
				`4. 技術棧（${plan.techStacks.length} 個，${categorized.size} 類）推薦`,
			);
			const sorted = [...categorized.entries()].sort((a, b) => {
				const ia = CATEGORY_ORDER.indexOf(a[0]);
				const ib = CATEGORY_ORDER.indexOf(b[0]);
				return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
			});
			for (const [cat, techMap] of sorted) {
				const techs = [...techMap.keys()];
				lines.push(`   ${cat}（${techs.length}）：${techs.join("、")}`);
			}
		} else {
			lines.push(`4. 技術棧（${plan.techStacks.length}）`);
			lines.push(...grid(plan.techStacks, 5, 16));
		}
	}

	return lines;
}

/**
 * 格式化 AI 資源
 *
 * @param {Object} plan - 完整計畫物件
 * @param {string} claudeDir - ~/.claude 路徑
 * @returns {string[]} 格式化後的行陣列
 */
export function formatAiResResources(plan, claudeDir) {
	const lines = [];

	if (!isEmpty(plan.aiRes)) {
		const aiResTypeMap = plan._fetchedSources?.aiResTypeMap || {};
		const aiResByType = { commands: [], agents: [], rules: [] };

		for (const name of plan.aiRes) {
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
			aiResByType[type].push(clean);
		}

		// 按星級排序（高分在前）+ 加 [預選] 標記
		const sortByRating = (items, type) =>
			[...items].sort(
				(a, b) => (getRating(b, type) || 0) - (getRating(a, type) || 0),
			);
		const preselectedBullet = (name, type) => {
			const desc = getDescription(name, type, claudeDir);
			const rating = getRating(name, type);
			const stars = rating
				? `${"★".repeat(rating)}${"☆".repeat(5 - rating)} `
				: "";
			return desc
				? `       · ${pc.cyan("[預選]")} ${name} ${stars}— ${desc}`
				: `       · ${pc.cyan("[預選]")} ${name}`;
		};

		lines.push(`5. 🌐 AI 外部資源（${plan.aiRes.length} 個）可選`);
		if (aiResByType.commands.length) {
			lines.push(`   5.1 Commands（${aiResByType.commands.length}）`);
			lines.push(
				...sortByRating(aiResByType.commands, "commands").map((n) =>
					preselectedBullet(n, "commands"),
				),
			);
		}
		if (aiResByType.agents.length) {
			lines.push(`   5.2 Agents（${aiResByType.agents.length}）`);
			lines.push(
				...sortByRating(aiResByType.agents, "agents").map((n) =>
					preselectedBullet(n, "agents"),
				),
			);
		}
		if (aiResByType.rules.length) {
			lines.push(`   5.3 Rules（${aiResByType.rules.length}）`);
			lines.push(
				...sortByRating(aiResByType.rules, "rules").map((n) =>
					preselectedBullet(n, "rules"),
				),
			);
		}
	}

	return lines;
}

/**
 * 統一 AI 資源視圖 — 合併外部源與 Commons 來源，按類型分組顯示
 *
 * @param {Object} plan - 計畫物件
 * @param {string} claudeDir - ~/.claude 路徑
 * @param {Object} selected - 已選擇的資源（{ commands: Set, agents: Set, rules: Set, skills: Set }）
 * @param {number} minStars - 最低預選星級（預設 5）
 * @returns {string[]} 格式化後的行陣列
 */
export function formatUnifiedAiResources(
	plan,
	claudeDir,
	selected = null,
	minStars = 5,
) {
	const lines = [];

	// 來源標籤對照
	const SOURCE_LABELS = {
		ecc: "ECC",
		anthropic: "Anthropic",
		superpowers: "Superpowers",
		"context-engineering": "CtxEng",
	};

	// ── 收集所有資源（外部 + Commons）──
	const unified = { commands: [], agents: [], rules: [], skills: [] };
	const itemsMap = {}; // 用於去重：{ "type:name" => item }

	// 1. 外部資源（plan.aiRes）
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

	// 2. Commons 資源
	const commSources = plan._pipelineResult?.commonsResources?.sources || [];
	for (const src of commSources) {
		// Commands, Agents, Rules
		for (const type of ["commands", "agents", "rules"]) {
			for (const item of src[type] || []) {
				const clean = item.name?.replace(".md", "") || item;
				const rating = getRating(clean, type) || 0;
				const desc = getDescription(clean, type, claudeDir);
				const key = `${type}:${clean}`;

				// 去重：保留評級更高的版本
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
			const content = typeof sk === "string" ? "" : sk.content || "";
			const rating = getRating(name, "skills") || 0;
			const transDesc = getDescription(name, "skills", null);
			const desc = transDesc || extractSkillDesc(content);
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

	// ── 按類型分組並排序 ──
	for (const key of Object.keys(itemsMap)) {
		const item = itemsMap[key];
		if (!unified[item.type]) unified[item.type] = [];
		unified[item.type].push(item);
	}

	// 每個類型按星級降序排序
	for (const type of Object.keys(unified)) {
		unified[type].sort((a, b) => b.rating - a.rating);
	}

	// ── 計算統計 ──
	const countPreselected = Object.values(unified).reduce(
		(sum, items) => sum + items.filter((i) => i.isPreselected).length,
		0,
	);
	const countTotal = Object.values(unified).reduce(
		(sum, items) => sum + items.length,
		0,
	);

	lines.push(`🌐 AI 資源（${countPreselected} 個預選 / ${countTotal} 個可用）`);

	// ── 按類型輸出 ──
	const types = ["commands", "agents", "rules", "skills"];
	for (const type of types) {
		const items = unified[type];
		if (items.length === 0) continue;

		const typeLabel = {
			commands: "Commands",
			agents: "Agents",
			rules: "Rules",
			skills: "Skills",
		}[type];

		lines.push(`  ${typeLabel}（${items.length} 個）`);

		for (const item of items) {
			const sourceLabel = SOURCE_LABELS[item.source] || item.source;
			const isSelected = selected
				? selected[type]?.has(item.name)
				: item.isPreselected;
			const preselectedTag = isSelected ? pc.cyan("[預選]") : "      ";
			const stars =
				item.rating > 0
					? `${"★".repeat(item.rating)}${"☆".repeat(5 - item.rating)}`
					: "☆☆☆☆☆";
			const desc = item.desc ? ` — ${item.desc}` : "";

			lines.push(
				`     · ${preselectedTag} ${sourceLabel.padEnd(10)} ${item.name} ${stars}${desc}`,
			);
		}
	}

	return lines;
}

/**
 * 格式化 Commons 匹配的 AI 資源（按技術棧篩選後）
 *
 * @param {Object} plan - 完整計畫物件
 * @returns {string[]} 格式化後的行陣列
 */
export function formatCommonsResources(plan) {
	const lines = [];
	const commSources = plan._pipelineResult?.commonsResources?.sources || [];
	const sourceIcons = {
		ecc: "🌐",
		anthropic: "📚",
		superpowers: "🚀",
		"context-engineering": "🧠",
	};

	if (!isEmpty(commSources)) {
		const commTotal = commSources.reduce(
			(s, src) =>
				s +
				src.commands.length +
				src.agents.length +
				src.rules.length +
				src.skills.length,
			0,
		);
		lines.push(
			`   🤖 技術棧匹配 AI 資源（${commSources.length} 個來源 · ${commTotal} 個資源）`,
		);
		for (const src of commSources) {
			const icon = sourceIcons[src.name] || "📦";
			const parts = [];
			if (src.commands.length) parts.push(`${src.commands.length} 指令`);
			if (src.agents.length) parts.push(`${src.agents.length} 代理`);
			if (src.rules.length) parts.push(`${src.rules.length} 規則`);
			if (src.skills.length) parts.push(`${src.skills.length} 技能`);
			if (parts.length)
				lines.push(`       ${icon} ${src.name} — ${parts.join(" · ")}`);

			// 列出個別 skills（優先使用繁中翻譯，fallback 到 SKILL.md 提取描述）
			for (const sk of src.skills || []) {
				const name = typeof sk === "string" ? sk : sk.name;
				const content = typeof sk === "string" ? "" : sk.content || "";
				const transDesc = getDescription(name, "skills", null);
				const desc = transDesc || extractSkillDesc(content);
				const rating = getRating(name, "skills");
				const stars = rating
					? `${"★".repeat(rating)}${"☆".repeat(5 - rating)} `
					: "";
				lines.push(
					desc ? `         · ${name} ${stars}— ${desc}` : `         · ${name}`,
				);
			}
		}
	}

	return lines;
}

/**
 * 格式化 ZSH 模組
 *
 * @param {Object} plan - 完整計畫物件
 * @returns {string[]} 格式化後的行陣列
 */
export function formatZshModules(plan) {
	const lines = [];

	if (!isEmpty(plan.zshModules)) {
		lines.push(
			`ZSH 模組 → ~/.zshrc.d/（${plan.zshModules.length} 可選 + 2 恆常 + sheldon 插件）推薦`,
		);
		lines.push(...plan.zshModules.map((m) => descBullet(m, null, null)));
	}

	return lines;
}

/**
 * 格式化 CLAUDE.md 部分
 *
 * @param {Object} plan - 完整計畫物件
 * @returns {string[]} 格式化後的行陣列
 */
export function formatClaudeMd(plan) {
	const lines = [];

	if (!isEmpty(plan.projects)) {
		const mainPrj = plan.projects.filter(
			(proj) => proj.claudeMdType === "full",
		);
		const tempPrj = plan.projects.filter(
			(proj) => proj.claudeMdType === "concise",
		);
		const parts = [];
		if (mainPrj.length) parts.push(`${mainPrj.length} AI 生成`);
		if (tempPrj.length) parts.push(`${tempPrj.length} 靜態模板`);
		lines.push(
			`3. CLAUDE.md 設定（${parts.join(" + ")}）→ 執行 /init 在各 repo 中生成`,
		);
	}

	return lines;
}

/**
 * 格式化變更摘要 — 列出新增項目和成本
 *
 * @param {Object} plan - 完整計畫物件
 * @param {Object} existing - 現有狀態物件
 * @returns {string[]} 格式化後的行陣列
 */
export function formatChanges(plan, existing) {
	const lines = [];
	const g = plan.global;
	const changes = [];

	const newCmds = g.commands.filter((c) => !existing.commands.includes(c));
	const newAgents = g.agents.filter((a) => !existing.agents.includes(a));
	const newRules = g.rules.filter((r) => !existing.rules.includes(r));

	if (newCmds.length) changes.push(`+${newCmds.length} cmd`);
	if (newAgents.length) changes.push(`+${newAgents.length} agent`);
	if (newRules.length) changes.push(`+${newRules.length} rule`);
	if (!existing.hasSettings) changes.push("+settings");
	else changes.push("合併 settings");
	if (!existing.hasHooks) changes.push("+hooks");
	else changes.push("合併 hooks");

	lines.push("");
	lines.push(
		`變更：${changes.join(" · ")} · AI ~$${plan.aiCost.total.toFixed(2)}`,
	);

	return lines;
}

/**
 * 組合所有格式化函數，生成完整計畫摘要
 *
 * @param {Object} plan - 完整計畫物件
 * @param {Object} existing - 現有狀態物件
 * @param {string} HOME - 家目錄路徑
 * @param {string} claudeDir - ~/.claude 路徑
 * @returns {string} 格式化後的完整計畫摘要字串
 */
export function buildPlanSummary(plan, existing, HOME, claudeDir) {
	const lines = [];
	const feats = new Set(plan.features || []);
	const has = (f) => feats.has(f);

	// 現有狀態（僅選了 claude 時顯示）
	if (has("claude")) {
		lines.push(...formatExistingState(existing));
	}

	// 角色與技能（僅 claude 相關）
	if (has("claude") && plan.profile) {
		lines.push(
			`${plan.profile.role || "開發者"} — ${plan.profile.coreSkills?.join(" · ") || ""}`,
		);
	}
	lines.push("");

	// 1. Repos（僅 project 相關）
	if (has("project") || has("claudemd")) {
		lines.push(
			...formatRepos(
				plan.repos,
				plan.mainCount,
				plan.tempCount,
				plan.toolCount,
				HOME,
			),
		);
	}

	// 2. 全局配置（僅 claude 相關）
	if (has("claude")) {
		lines.push(...formatGlobalConfig(plan.global));
	}

	// 3. CLAUDE.md（僅 project 相關）
	if (has("project") || has("claudemd")) {
		lines.push(...formatClaudeMd(plan));
	}

	// 4. 技術棧（僅 project 相關）
	if (has("project")) {
		lines.push(...formatTechStacks(plan));
	}

	// 5. AI 資源（僅 project 相關）
	if (has("project")) {
		lines.push(...formatAiResResources(plan, claudeDir));
		lines.push(...formatCommonsResources(plan));
	}

	// 6. ZSH 模組（僅 zsh 相關）
	if (has("zsh")) {
		lines.push(...formatZshModules(plan));
	}

	// 變更 + 費用（僅有 claude 相關變更時顯示）
	if (has("claude")) {
		lines.push(...formatChanges(plan, existing));
	}

	return lines.join("\n");
}
