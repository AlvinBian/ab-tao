/**
 * deep-merge.mjs — JSON/YAML 深度合併（merge-unless-present 策略）
 *
 * 策略：使用者既有 keys 永遠優先，ab-tao template 僅補入新增 keys。
 * 衝突時：使用者 keys 勝出（yadm default 精神）。
 * 僅對結構化 JSON/YAML 檔提供 [m] merge 選項。
 */

/**
 * 深度合併兩個物件（merge-unless-present）
 * - 使用者物件（target）的 key 永遠保留
 * - 僅當 target 不含某 key 時，才從 source 補入
 * - 陣列不做深度合併，以使用者（target）為準
 *
 * @param {object} source ab-tao template 物件
 * @param {object} target 使用者本地物件（優先）
 * @returns {object} 合併後的新物件
 */
export function deepMergeUnlessPresent(source, target) {
	if (!isPlainObject(source) || !isPlainObject(target)) {
		return target ?? source;
	}

	const result = { ...target };

	for (const [key, srcVal] of Object.entries(source)) {
		if (!(key in result)) {
			// target 無此 key → 從 source 補入
			result[key] = structuredClone(srcVal);
		} else if (isPlainObject(srcVal) && isPlainObject(result[key])) {
			// 雙方都是物件 → 遞迴合併
			result[key] = deepMergeUnlessPresent(srcVal, result[key]);
		}
		// target 已有、且非物件 → 使用者 key 勝出，不動
	}

	return result;
}

/**
 * 判斷值是否為純物件（非 Array、非 null）
 * @param {unknown} v
 * @returns {boolean}
 */
function isPlainObject(v) {
	return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * 解析 JSON 字串為物件，失敗時回傳 null
 * @param {string} str
 * @returns {object|null}
 */
export function parseJsonSafe(str) {
	try {
		return JSON.parse(str);
	} catch {
		return null;
	}
}
