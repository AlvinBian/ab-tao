/**
 * preferences-store.mjs — d:setup 用戶偏好持久化
 *
 * 存放位置：~/.claude/.ab-tao/preferences.json（永久，不受 .cache 刪除影響）
 * 寫入策略：獨立 preferences.lock + tmp→rename 原子寫入，防止並發損壞
 *
 * 職責邊界：
 *   本模組 = 永久偏好（下次 d:setup 預設值）
 *   session.mjs = 中斷續裝快照（.cache/last-session.json）
 *
 * 隱私聲明：
 *   preferences.json 含 Slack Channel ID + 私有 repo 名稱，屬 user-private 資料。
 *   不可 commit 至版本庫、不參與 iCloud prefs-sync（d:prefs-sync 刻意排除）。
 *
 * promptId 清單（17 個，跨 9 個接線檔）：
 *   scan.sources · scan.aiSources · scan.repos
 *   scan.techAction · scan.techConfirm
 *   features · zsh.modules · plugins.list
 *   claudeBase.model · claudeBase.claudeMd · claudeBase.categories
 *   repos.role.action
 *   projectInstall.minStars · projectInstall.action
 *   slack.keepExisting · slack.mode · slack.channel
 *
 * 接線檔案（9 個）：
 *   libs/detect/repo-select.mjs · libs/external/ai-source-select.mjs
 *   libs/pipeline/tech-select-ui.mjs · libs/features/registry.mjs
 *   libs/features/zsh.mjs · libs/features/plugins.mjs
 *   libs/features/claude-base.mjs · libs/features/repos.mjs
 *   libs/install/slack-setup.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { P } from './paths.mjs'
import { loadSession } from './session.mjs'

// AB_TAO_PREFS_PATH 環境變數供測試覆蓋使用
const PREFS_PATH = process.env.AB_TAO_PREFS_PATH ?? P.prefs
const LOCK_PATH = process.env.AB_TAO_PREFS_LOCK ?? P.prefsLock
const LOCK_TIMEOUT_MS = 2000

// ── 空白骨架 ─────────────────────────────────────────────────

/**
 * @returns {object} 空偏好骨架
 */
function _empty() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    choices: {},
    optionUsage: {},
  }
}

// ── 鎖機制（獨立於 state.lock，避免 setup.mjs PID 鎖衝突）────

let _lockFailed = false

function _acquireLock() {
  if (_lockFailed)
    return null
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true })
  const start = Date.now()
  while (true) {
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx')
      return fd
    }
    catch (e) {
      if (e.code !== 'EEXIST')
        throw e
      if (Date.now() - start >= LOCK_TIMEOUT_MS) {
        _lockFailed = true
        return null
      }
      const until = Date.now() + 30
      // eslint-disable-next-line no-empty
      while (Date.now() < until) {}
    }
  }
}

function _releaseLock(fd) {
  if (fd === null)
    return
  try {
    fs.closeSync(fd)
    fs.unlinkSync(LOCK_PATH)
  }
  catch {
    // 競態可忽略
  }
}

// ── JSON 安全讀取 ─────────────────────────────────────────────

/**
 * 讀整份偏好；不存在或損壞 → 回傳空骨架，不拋錯
 *
 * @returns {{ version: number, updatedAt: string, choices: object, optionUsage: object }}
 */
export function prefsRead() {
  try {
    const raw = fs.readFileSync(PREFS_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object')
      return _empty()
    return {
      version: data.version ?? 1,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      choices: data.choices ?? {},
      optionUsage: data.optionUsage ?? {},
    }
  }
  catch (e) {
    if (e.code === 'ENOENT')
      return _empty()
    // JSON 損壞 → backup + 回傳空骨架
    try {
      const backupPath = `${PREFS_PATH}.broken-${Date.now()}`
      fs.copyFileSync(PREFS_PATH, backupPath)
      process.stderr.write(
        `[preferences-store] 偏好檔案損壞，已備份至 ${backupPath}，使用空骨架繼續\n`,
      )
    }
    catch {
      // backup 失敗也不阻斷流程
    }
    return _empty()
  }
}

// ── 原子寫入 ─────────────────────────────────────────────────

/**
 * 覆寫整份偏好（flock + tmp→rename）
 *
 * @param {object} data - 完整偏好物件
 */
export function prefsWrite(data) {
  fs.mkdirSync(path.dirname(PREFS_PATH), { recursive: true })
  const fd = _acquireLock()
  try {
    const tmpPath = `${PREFS_PATH}.tmp`
    fs.writeFileSync(
      tmpPath,
      `${JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      'utf8',
    )
    fs.renameSync(tmpPath, PREFS_PATH)
  }
  finally {
    _releaseLock(fd)
  }
}

/**
 * 局部更新偏好（read → mutate → write）
 *
 * @param {(draft: object) => object} mutator - 接收 draft，回傳新物件
 */
export function prefsPatch(mutator) {
  const current = prefsRead()
  const updated = mutator(current)
  prefsWrite(updated)
}

// ── 讀取單一 prompt 值 ────────────────────────────────────────

/**
 * 取單一 prompt 的上次選擇值；無則回傳 undefined
 *
 * @param {string} promptId - choices 的 key（如 'features', 'scan.repos'）
 * @returns {unknown}
 */
export function prefsGet(promptId) {
  const prefs = prefsRead()
  return prefs.choices[promptId]?.value
}

// ── 寫入單一 prompt 選擇 ──────────────────────────────────────

/**
 * 記錄一次 prompt 選擇（每個 prompt 確認後立即呼叫）
 *
 * 自動更新 choices[promptId].value + pickedAt 及 optionUsage 計數。
 *
 * @param {string} promptId - prompt 識別碼
 * @param {unknown} value - 使用者選擇的值（陣列 / 字串 / boolean）
 */
export function prefsRecordChoice(promptId, value) {
  try {
    prefsPatch((draft) => {
      draft.choices[promptId] = {
        value,
        pickedAt: new Date().toISOString(),
      }
      // 累計選項使用次數（僅限陣列型選擇）
      if (Array.isArray(value)) {
        if (!draft.optionUsage[promptId])
          draft.optionUsage[promptId] = {}
        for (const v of value) {
          draft.optionUsage[promptId][v] = (draft.optionUsage[promptId][v] ?? 0) + 1
        }
      }
      return draft
    })
  }
  catch {
    // best-effort：寫入失敗不應中斷 d:setup 互動
  }
}

// ── Reset ────────────────────────────────────────────────────

/**
 * 清除全部偏好（--reset-preferences flag 用）
 */
export function prefsReset() {
  try {
    fs.mkdirSync(path.dirname(PREFS_PATH), { recursive: true })
    const fd = _acquireLock()
    try {
      fs.writeFileSync(
        PREFS_PATH,
        `${JSON.stringify(_empty(), null, 2)}\n`,
        'utf8',
      )
    }
    finally {
      _releaseLock(fd)
    }
  }
  catch {
    // 重置失敗：檔案可能不存在，不拋錯
  }
}

// ── 首次遷移 ─────────────────────────────────────────────────

/**
 * 從 last-session.json 遷移可用欄位至 preferences.json（冪等）
 *
 * 僅在 preferences.json 的 choices 為空時觸發，確保只遷移一次。
 *
 * @returns {{ migrated: boolean, fields: string[] }}
 */
export function prefsMigrateFromSession() {
  const prefs = prefsRead()
  // 若已有任何 choices，代表已跑過偏好系統，不再遷移
  if (Object.keys(prefs.choices).length > 0)
    return { migrated: false, fields: [] }

  const session = loadSession()
  if (!session)
    return { migrated: false, fields: [] }

  const fields = []

  // 欄位遷移對照表：session key → preferences promptId
  const migrationMap = {
    repos: 'scan.repos',
    roles: 'scan.roles',
    techStacks: 'scan.techStacks',
    selectedAiSources: 'scan.aiSources',
    features: 'features',
  }

  for (const [sessionKey, promptId] of Object.entries(migrationMap)) {
    const val = session[sessionKey]
    if (val !== undefined && val !== null) {
      prefs.choices[promptId] = {
        value: val,
        pickedAt: session.timestamp ?? new Date().toISOString(),
      }
      fields.push(promptId)
    }
  }

  // model 在 session.preferences 層
  const model = session.preferences?.aiModel ?? session.install?.model
  if (model) {
    prefs.choices['claudeBase.model'] = {
      value: model,
      pickedAt: session.timestamp ?? new Date().toISOString(),
    }
    fields.push('claudeBase.model')
  }

  if (fields.length > 0) {
    try {
      prefsWrite(prefs)
    }
    catch {
      return { migrated: false, fields: [] }
    }
    return { migrated: true, fields }
  }
  return { migrated: false, fields: [] }
}
