/**
 * preserve-policy.mjs — 單一 SoT：所有 PRESERVE / ADDITIVE / FORBIDDEN 定義
 *
 * 職責：集中定義 Claude 配置同步的保留策略，供 config-sync.mjs 和測試使用。
 */

/**
 * PRESERVE：這些路徑的本地值在 merge 後強制 pin（不被 template 覆蓋）
 */
export const SETTINGS_PRESERVE_PATHS = [
	"statusLine",
	"statusLine.command",
	"mcpServers",
	"env",
	"permissions.allow",
	"model",
	"autoMemoryEnabled",
	"enabledPlugins",
	// ab-tao 內部命名空間：Console hooks UI 的 disabledHooks 等運行時狀態
	// d:setup 不應將此命名空間視為 drift，應完整保留本地值
	"_abTao",
];

/**
 * ADDITIVE：這些目錄中本地獨有的檔案應保留（不刪除）
 */
export const ADDITIVE_DIRS = ["commands", "agents", "skills", "hooks"];

/**
 * FORBIDDEN：這些目錄完全跳過，ab-tao 絕不讀寫
 */
export const FORBIDDEN_DIRS = [
	"projects",
	"ccline",
	"sessions",
	"session-env",
	"file-history",
	"plans",
	"memory",
	"tasks",
	"_archive",
	"profiles",
	"memory-templates",
];

/**
 * SETTINGS_ARRAY_MERGE：各 array 欄位的合併策略
 *   union      — 聯集 + 去重
 *   local-wins — 本地陣列完全勝出
 */
export const SETTINGS_ARRAY_MERGE = {
	"permissions.deny": "union",
};

/**
 * HOOKS_DEDUP_KEY：hooks 三元組 dedup 的 key 計算函式
 * key = `${matcher}::${commands}` — 相同 (matcher, commands) 視為重複條目
 *
 * @param {object} entry hooks entry（含 matcher 與 hooks 陣列）
 * @returns {string} dedup key
 */
export const HOOKS_DEDUP_KEY = (entry) =>
	`${entry.matcher ?? ""}::${(entry.hooks ?? []).map((h) => h.command).join("|")}`;
