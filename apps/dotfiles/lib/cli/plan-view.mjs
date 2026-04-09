/**
 * 計畫視圖格式化 — 將計畫資料轉換為可讀的 CLI 輸出
 *
 * 職責：組裝摘要、表格、icon、描述等顯示邏輯
 */

import fs from "node:fs";
import path from "node:path";
import { isEmpty } from "lodash-es";
import { descBullet } from "../config/descriptions.mjs";

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

	lines.push(`2. 全局配置 → ~/.claude/`);
	lines.push(`   Commands（${g.commands.length}）`);
	lines.push(...grid(g.commands));
	lines.push(`   Agents（${g.agents.length}）`);
	lines.push(...grid(g.agents));
	lines.push(`   Rules（${g.rules.length}）`);
	lines.push(...grid(g.rules, 3, 24));
	lines.push(`   Hooks（${g.hooks.length}）`);
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

	if (!isEmpty(plan.techStacks)) {
		const categorized = plan._pipelineResult?.categorizedTechs;
		if (categorized instanceof Map && categorized.size > 0) {
			lines.push(
				`4. 技術棧（${plan.techStacks.length} 個，${categorized.size} 類）`,
			);
			for (const [cat, techMap] of categorized) {
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
 * 格式化 ECC（外部 AI 資源）
 *
 * @param {Object} plan - 完整計畫物件
 * @param {string} claudeDir - ~/.claude 路徑
 * @returns {string[]} 格式化後的行陣列
 */
export function formatEccResources(plan, claudeDir) {
	const lines = [];

	if (!isEmpty(plan.ecc)) {
		const eccTypeMap = plan._fetchedSources?.eccTypeMap || {};
		const eccByType = { commands: [], agents: [], rules: [] };

		for (const name of plan.ecc) {
			const clean = name.replace(".md", "");
			const type =
				eccTypeMap[clean] ||
				(fs.existsSync(path.join(claudeDir, "agents", `${clean}.md`))
					? "agents"
					: null) ||
				(fs.existsSync(path.join(claudeDir, "rules", `${clean}.md`))
					? "rules"
					: null) ||
				"commands";
			eccByType[type].push(clean);
		}

		lines.push(`5. 🌐 AI 外部資源（${plan.ecc.length} 個）`);
		if (eccByType.commands.length) {
			lines.push(`   5.1 Commands（${eccByType.commands.length}）`);
			lines.push(
				...eccByType.commands.map((n) => descBullet(n, "commands", claudeDir)),
			);
		}
		if (eccByType.agents.length) {
			lines.push(`   5.2 Agents（${eccByType.agents.length}）`);
			lines.push(
				...eccByType.agents.map((n) => descBullet(n, "agents", claudeDir)),
			);
		}
		if (eccByType.rules.length) {
			lines.push(`   5.3 Rules（${eccByType.rules.length}）`);
			lines.push(
				...eccByType.rules.map((n) => descBullet(n, "rules", claudeDir)),
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

			// 列出個別項目（從 SKILL.md 提取描述）
			for (const sk of src.skills || []) {
				const desc = extractSkillDesc(sk.content);
				lines.push(
					desc ? `         · ${sk.name} — ${desc}` : `         · ${sk.name}`,
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
			`ZSH 模組 → ~/.zshrc.d/（${plan.zshModules.length} 可選 + 2 恆常 + sheldon 插件）`,
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
	if (has("project") || has("claudemd") || has("ecc")) {
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

	// 5. ECC 資源（僅 project 相關）
	if (has("project") || has("ecc")) {
		lines.push(...formatEccResources(plan, claudeDir));
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
