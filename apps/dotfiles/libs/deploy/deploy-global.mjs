/**
 * 全局配置部署 — settings.json 合併
 *
 * 職責：
 *   將 ab-tao 的全局配置安全地部署到 ~/.claude/，
 *   採用「合併」而非「覆蓋」策略，保留用戶已有的自訂設定。
 */

import fs from "node:fs";
import path from "node:path";
import { HOME } from "../core/paths.mjs";

const CLAUDE_DIR = path.join(HOME, ".claude");

/**
 * 部署 settings.json（merge 策略）
 *
 * 合併規則（優先順序由高到低）：
 *   - permissions：完全不動，用戶自行在 Claude Code 中配置
 *   - hooks：由 install-claude.sh 另行處理，deploySettings 不介入
 *   - model：overrides.model > existing.model > template.model
 *   - env：逐 key 合併，existing 優先（保留用戶已有值，只補 template 新 key）
 *   - enabledPlugins：union merge（template 新增的 plugin 自動加入，不覆蓋用戶已有設定）
 *   - statusLine：只在未設定且 ccline 已安裝時寫入
 *   - 其餘 template 欄位：only-if-absent（existing 已有的 key 一律保留不覆蓋）
 *
 * @param {Object} template - 要合併的模板設定（來自 claude/settings.template.json）
 * @param {Object} [overrides] - 用戶顯式選擇的設定（優先寫入，不受「不覆蓋」保護）
 * @param {string} [overrides.model] - 用戶選擇的模型（如 'opusplan'、'sonnet'）
 * @param {boolean} [overrides.cclineInstalled] - ccline 是否已成功安裝（決定是否寫入 statusLine）
 * @returns {{ path: string, permissionsAdded: number, isNew: boolean, modelSet: string|null }}
 */
export function deploySettings(template, overrides = {}) {
	const settingsPath = path.join(CLAUDE_DIR, "settings.json");
	let existing = {};

	if (fs.existsSync(settingsPath)) {
		try {
			existing = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
		} catch {
			/* settings.json 格式錯誤則略過，從空物件合併 */
		}
	}

	const merged = { ...existing };

	// permissions: 完全不動 — 用戶自行在 Claude Code 中配置
	if (existing.permissions) {
		merged.permissions = existing.permissions;
	}

	// model: overrides > existing > template 預設
	let modelSet = null;
	if (overrides.model !== undefined && overrides.model !== null) {
		merged.model = overrides.model;
		modelSet = overrides.model;
	} else if (existing.model === undefined && template.model !== undefined) {
		merged.model = template.model;
		modelSet = template.model;
	}

	// autoMemoryEnabled: 只在 undefined 時寫入
	if (existing.autoMemoryEnabled === undefined)
		merged.autoMemoryEnabled = template.autoMemoryEnabled;

	// env: 逐 key 合併（existing 優先，template 只補新 key）
	if (template.env) {
		merged.env = { ...template.env, ...(existing.env || {}) };
	}

	// statusLine — ccline 安裝成功後 merge，不覆蓋已有配置
	if (!existing.statusLine && overrides.cclineInstalled) {
		merged.statusLine = {
			type: "command",
			command: "ccline",
			padding: 0,
		};
	}

	// enabledPlugins: union merge（template 新增的 plugin 自動加入，不刪除用戶已有設定）
	if (template.enabledPlugins) {
		merged.enabledPlugins = {
			...template.enabledPlugins,
			...(existing.enabledPlugins || {}),
		};
	}

	// 通用 merge: 其餘 template 欄位，only-if-absent（不覆蓋 existing 已有的 key）
	const specialKeys = new Set([
		"permissions",
		"env",
		"statusLine",
		"model",
		"autoMemoryEnabled",
		"hooks",
		"enabledPlugins",
	]);
	for (const [key, value] of Object.entries(template)) {
		if (specialKeys.has(key)) continue;
		if (existing[key] === undefined) {
			merged[key] = value;
		}
	}

	const isNew = !fs.existsSync(settingsPath);
	fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
	fs.writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`);

	return {
		path: settingsPath,
		permissionsAdded:
			(merged.permissions?.allow?.length || 0) -
			(existing.permissions?.allow?.length || 0),
		isNew,
		modelSet,
	};
}
