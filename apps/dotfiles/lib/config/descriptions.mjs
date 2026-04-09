/**
 * 配置項描述
 *
 * ab-tao 管理的項目：硬編碼中文描述（穩定）
 * ECC/第三方項目：從 frontmatter 讀取描述
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── ab-tao 管理的配置描述（穩定）──

const AB_DESCRIPTIONS = {
	// Commands（4 個）
	check: "構建修復 + 品質閘門（5 道自動化 gate）",
	slack: "Slack 草稿/審查/格式（MCP 發送）",
	test: "測試生成 + 覆蓋率 + TDD + E2E",
	"db-migration": "資料庫遷移安全流程",
	// Agents（2 個）
	architect: "架構設計 + 5 維度審查 + ADR",
	debugger: "除錯 + build error 最小 diff",
	// Skills（3 個）
	"slack-mrkdwn": "Slack mrkdwn 格式背景知識",
	runbook: "維運手冊模板",
	incident: "事故處理全流程模板",
	// Rules（1 個）
	"api-and-data": "API 錯誤格式 + Schema + Migration 安全",
	// Hooks（5 個）
	"PostToolUse:Edit|Write (prettier)": "寫檔後 prettier 格式化",
	"PostToolUse:Edit|Write (eslint)": "寫檔後 eslint 檢查",
	"PreToolUse:Edit|Write (檔案保護)": "阻止修改 .env/lock 等",
	"PreToolUse:Bash (危險命令攔截)": "阻止 rm -rf / force push",
	"Notification (macOS 通知)": "任務完成系統通知",

	// ── ZSH 模組（~/.zshrc.d/ + sheldon）──
	history: "歷史記錄（50K + 去重 + 專案歷史自動切換）",
	keys: "按鍵綁定（Option+←/→ 跳單詞 · ↑↓ 前綴搜尋）",
	aliases: "編輯器偵測 + gh / uv + 通用命令縮寫",
	git: "Git aliases + delta diff + lazygit 整合",
	tools: "bat/eza/zoxide/fd/rg/tldr + FZF 環境（sheldon 管理插件）",
};

// ── Frontmatter 讀取 ──

/**
 * 從 Markdown 檔案的 frontmatter 讀取 description 欄位
 *
 * 比對格式：--- ... description: <text> ...
 * 最多返回 60 個字元。
 *
 * @param {string} filePath - Markdown 檔案的絕對路徑
 * @returns {string|null} description 文字，找不到或出錯返回 null
 */
function readFrontmatterDesc(filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf8");
		const match = content.match(/^---\n[\s\S]*?description:\s*(.+)/m);
		return match?.[1]?.trim().slice(0, 60) || null;
	} catch {
		return null;
	}
}

// ── 公開 API ──

/**
 * 取得配置項的中文描述
 *
 * 優先順序：ab-tao 硬編碼 → frontmatter → 空字串
 *
 * @param {string} name - 配置項名稱（例如 'code-review'）
 * @param {string|null} type - 類型（'commands' | 'agents' | 'rules'），用於找到對應檔案
 * @param {string|null} claudeDir - ~/.claude/ 目錄路徑，type 非 null 時必填
 * @returns {string} 描述文字，無描述時返回空字串
 */
export function getDescription(name, type, claudeDir) {
	// 1. ab-tao 自己的
	if (AB_DESCRIPTIONS[name]) return AB_DESCRIPTIONS[name];

	// 2. 即時讀 frontmatter
	if (type && claudeDir) {
		const filePath = path.join(claudeDir, type, `${name}.md`);
		const desc = readFrontmatterDesc(filePath);
		if (desc) return desc;
	}

	return "";
}

/**
 * 格式化帶描述的 bullet 項目
 *
 * 格式為：`{indent}· {name} — {desc}`（有描述時）
 * 或：`{indent}· {name}`（無描述時）
 *
 * @param {string} name - 項目名稱
 * @param {string|null} type - 類型（'commands' | 'agents' | 'rules'）
 * @param {string|null} claudeDir - ~/.claude/ 目錄路徑
 * @param {string} [indent='       '] - 縮排前綴字串
 * @returns {string} 格式化後的 bullet 行
 */
export function descBullet(name, type, claudeDir, indent = "       ") {
	const desc = getDescription(name, type, claudeDir);
	return desc ? `${indent}· ${name} — ${desc}` : `${indent}· ${name}`;
}

// Re-export for convenience
export { AB_DESCRIPTIONS as DESCRIPTIONS };
