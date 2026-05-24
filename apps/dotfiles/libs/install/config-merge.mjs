/**
 * config-merge.mjs — 純函數 JSON merger
 *
 * 語義：
 *   - null    = 顯式刪除（移除該 key）
 *   - 一般欄位：local 非 undefined 則勝
 *   - preserve paths：在 merge 後強制 pin local 值
 *   - array 欄位：union 合併 + dedupe / local-wins（依 policy）
 */

// ── path 工具 ─────────────────────────────────────────────────────

/**
 * 判斷物件是否有指定點路徑
 * @param {object} obj
 * @param {string} dotPath 例：'permissions.allow'
 * @returns {boolean}
 */
export function hasPath(obj, dotPath) {
  if (obj == null)
    return false
  const keys = dotPath.split('.')
  let cur = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object' || !(k in cur))
      return false
    cur = cur[k]
  }
  return true
}

/**
 * 取得物件指定點路徑的值
 * @param {object} obj
 * @param {string} dotPath
 * @returns {*} 找不到則回傳 undefined
 */
export function getPath(obj, dotPath) {
  if (obj == null)
    return undefined
  const keys = dotPath.split('.')
  let cur = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object')
      return undefined
    cur = cur[k]
  }
  return cur
}

/**
 * 設定物件指定點路徑的值（深層設定，自動建立中間物件）
 * @param {object} obj 目標物件（會直接修改）
 * @param {string} dotPath
 * @param {*} val
 */
export function setPath(obj, dotPath, val) {
  const keys = dotPath.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (cur[k] == null || typeof cur[k] !== 'object') {
      cur[k] = {}
    }
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = val
}

// ── array 合併 ────────────────────────────────────────────────────

/**
 * 合併兩個陣列
 *   union      — 聯集 + 去重（JSON 序列化比較）
 *   local-wins — local 完全勝出（回傳 local 原值）
 *
 * @param {Array} tpl      template 陣列
 * @param {Array} local    local 陣列
 * @param {'union'|'local-wins'} strategy
 * @returns {Array}
 */
export function mergeArray(tpl, local, strategy) {
  if (!Array.isArray(local)) {
    // local 不是陣列 → fallback 到 template
    return Array.isArray(tpl) ? tpl : []
  }
  if (strategy === 'local-wins') {
    return local
  }
  // union：聯集 + dedupe（以 JSON 序列化判斷重複）
  const base = Array.isArray(tpl) ? tpl : []
  const merged = [...local]
  const seen = new Set(local.map(x => JSON.stringify(x)))
  for (const item of base) {
    const key = JSON.stringify(item)
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(item)
    }
  }
  return merged
}

// ── 主合併函式 ────────────────────────────────────────────────────

/**
 * 合併 template 與 local 配置
 *
 * @param {object} template  ab-tao 模板（SoT，提供預設值）
 * @param {object} local     ~/.claude/ 現有配置（用戶值）
 * @param {object} policy    preserve-policy.mjs 匯出的策略物件
 * @param {string[]} policy.preservePaths    強制 pin 的點路徑清單
 * @param {object}  policy.arrayMerge        path → 'union'|'local-wins'
 * @returns {object} 合併後的結果（不修改輸入）
 */
export function mergeConfig(template, local, policy) {
  const { preservePaths = [], arrayMerge = {} } = policy ?? {}

  // 深複製避免污染原始物件
  const tpl = structuredClone(template ?? {})
  const loc = structuredClone(local ?? {})

  // ── 第一步：從 template 出發，逐 key 決定採用哪方的值 ──────────
  const result = _mergeObjects(tpl, loc, arrayMerge, '')

  // ── 第二步：套用 preserve paths（強制 pin local 值）─────────────
  for (const dotPath of preservePaths) {
    if (hasPath(loc, dotPath)) {
      const locVal = getPath(loc, dotPath)
      if (locVal == null)
        continue // null/undefined 不 pin，避免洗掉模板
      setPath(result, dotPath, locVal)
    }
  }

  return result
}

// ── 內部遞迴合併 ──────────────────────────────────────────────────

/**
 * 遞迴合併兩個物件
 * @param {object} tpl
 * @param {object} loc
 * @param {object} arrayMergePolicy
 * @param {string} prefix 當前點路徑前綴（用於 arrayMerge lookup）
 * @returns {object}
 */
function _mergeObjects(tpl, loc, arrayMergePolicy, prefix) {
  const result = {}

  // 收集所有 key（template + local）
  const allKeys = new Set([
    ...Object.keys(tpl ?? {}),
    ...Object.keys(loc ?? {}),
  ])

  for (const key of allKeys) {
    const dotPath = prefix ? `${prefix}.${key}` : key
    const tplVal = tpl?.[key]
    const locVal = loc?.[key]

    // local 明確設為 null → 顯式刪除（不出現在結果中）
    if (hasKey(loc, key) && locVal === null) {
      continue
    }

    // local 沒有此 key → 採用 template 值
    if (!hasKey(loc, key)) {
      if (tplVal !== undefined)
        result[key] = tplVal
      continue
    }

    // local 有此 key → local 勝
    if (!hasKey(tpl, key)) {
      result[key] = locVal
      continue
    }

    // 雙方都有此 key

    // array 欄位：依策略合併
    if (Array.isArray(tplVal) || Array.isArray(locVal)) {
      const strategy = arrayMergePolicy[dotPath] ?? 'union'
      result[key] = mergeArray(
        Array.isArray(tplVal) ? tplVal : [],
        Array.isArray(locVal) ? locVal : [],
        strategy,
      )
      continue
    }

    // 雙方都是 plain object → 遞迴
    if (isPlainObject(tplVal) && isPlainObject(locVal)) {
      result[key] = _mergeObjects(tplVal, locVal, arrayMergePolicy, dotPath)
      continue
    }

    // 其他（scalar / type 不同）：local 勝
    result[key] = locVal
  }

  return result
}

// ── 工具 ─────────────────────────────────────────────────────────

function hasKey(obj, key) {
  return obj != null && Object.hasOwn(obj, key)
}

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}
