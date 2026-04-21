/**
 * settings-merge.mjs — Console 後端使用的 settings 合併 facade
 *
 * 將 dotfiles 的 mergeConfig + preserve-policy 封裝為 Console 友好的介面。
 * Console 只 import 此 facade，不直接 import dotfiles 內部。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

// 動態 import 讓路徑可在測試時 mock
const { mergeConfig } = await import(
	path.join(DOTFILES_LIB, "install/config-merge.mjs")
);
const { SETTINGS_PRESERVE_PATHS, SETTINGS_ARRAY_MERGE, HOOKS_DEDUP_KEY } =
	await import(path.join(DOTFILES_LIB, "config/preserve-policy.mjs"));

export { HOOKS_DEDUP_KEY, SETTINGS_ARRAY_MERGE, SETTINGS_PRESERVE_PATHS };

/**
 * 合併使用者在 JSON editor 提交的新設定與現有 settings.json。
 *
 * 語義：incoming 為新內容（使用者想要的狀態），current 為現有檔案（包含 preserve keys）。
 * preserve paths（statusLine / enabledPlugins / permissions 等）從 current 強制 pin 回去，
 * 防止 JSON editor 不小心刪掉重要個人設定。
 *
 * @param {object} incoming 使用者在 editor 提交的完整 settings 物件
 * @param {object} current  從 ~/.claude/settings.json 讀出的現有設定
 * @returns {object} 合併後的設定（可安全寫回磁碟）
 */
export function mergeSettings(incoming, current) {
	return mergeConfig(incoming, current, {
		preservePaths: SETTINGS_PRESERVE_PATHS,
		arrayMerge: SETTINGS_ARRAY_MERGE,
	});
}
