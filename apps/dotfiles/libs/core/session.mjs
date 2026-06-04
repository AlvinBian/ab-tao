/**
 * Session 持久化
 *
 * 職責：
 *   保存/讀取每次 setup 的所有用戶選擇，下次跑時作為預設值。
 *   存放在 .cache/last-session.json（不汙染 config.json）。
 *
 * 保存內容：
 *   - targets, mode, org, repos, techCategories, techStacks, aiResSelections, install
 *   - progress：斷點續裝進度（lastPhase, completedTargets, pendingTargets）
 */

import fs from 'node:fs'
import path from 'node:path'
import { getDirname } from './paths.mjs'

const __dirname = getDirname(import.meta)
const REPO = path.resolve(__dirname, '../..')
const SESSION_PATH = path.join(REPO, '.cache', 'last-session.json')

/**
 * 讀取上次的 session
 * @returns {object | null} 上次的選擇，無則 null
 */
export function loadSession() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'))
  }
  catch (e) {
    // ENOENT = 首次執行，檔案尚未建立，屬正常情況，靜默忽略
    if (e.code === 'ENOENT')
      return null
    // 其他錯誤（JSON 解析失敗等）才是真正的損壞
    process.stderr.write(`⚠️ session 檔案損壞，已重置（${e.message}）\n`)
    return null
  }
}

// 序列化寫入佇列 — 避免並發 loadSession + saveSession 競爭
let _writeQueue = Promise.resolve()

/**
 * 保存本次 session（序列化寫入，避免並發競爭）
 * @param {object} data - 本次所有選擇
 */
function saveSessionSync(data) {
  const dir = path.dirname(SESSION_PATH)
  fs.mkdirSync(dir, { recursive: true })

  // 若 session 檔案已存在且有效，先備份一份
  if (fs.existsSync(SESSION_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'))
      if (existing && typeof existing === 'object') {
        const backupPath = `${SESSION_PATH}.bak`
        fs.copyFileSync(SESSION_PATH, backupPath)
      }
    }
    catch {
      // 若檔案損壞無法備份，繼續（寫入會覆蓋壞檔案）
    }
  }

  const tmpPath = `${SESSION_PATH}.tmp`
  fs.writeFileSync(
    tmpPath,
    `${JSON.stringify({ ...data, timestamp: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  )
  fs.renameSync(tmpPath, SESSION_PATH)
}

export function saveSession(data) {
  _writeQueue = _writeQueue.then(() => {
    try {
      saveSessionSync(data)
    }
    catch {
      /* session 是 best-effort，寫入失敗不應中斷安裝流程 */
    }
  })
  return _writeQueue
}

/**
 * 更新 session 進度（斷點續裝用）
 * @param {object} progress - { lastPhase, completedTargets, pendingTargets }
 */
export async function updateSessionProgress(progress) {
  _writeQueue = _writeQueue.then(() => {
    try {
      const existing = loadSession() || {}
      saveSessionSync({ ...existing, progress })
    }
    catch {
      /* best-effort */
    }
  })
  return _writeQueue
}

/**
 * 清除 session 進度（安裝完成時呼叫）
 */
export function clearSessionProgress() {
  const existing = loadSession()
  if (!existing?.progress)
    return
  const { progress: _progress, ...rest } = existing
  saveSession(rest)
}

/**
 * 檢查是否有未完成的安裝
 * @returns {{ hasIncomplete: boolean, lastPhase?: string, pendingTargets?: string[] }}
 */
export function checkIncompleteSession() {
  const session = loadSession()
  if (!session?.progress?.pendingTargets?.length) {
    return { hasIncomplete: false }
  }
  return {
    hasIncomplete: true,
    lastPhase: session.progress.lastPhase,
    completedTargets: session.progress.completedTargets || [],
    pendingTargets: session.progress.pendingTargets,
  }
}

/**
 * 部分更新 session（不覆蓋未提及的欄位）
 * @param {object} patch - 要更新的欄位
 */
export async function patchSession(patch) {
  _writeQueue = _writeQueue.then(() => {
    try {
      const existing = loadSession() || {}
      saveSessionSync({ ...existing, ...patch })
    }
    catch {
      /* best-effort */
    }
  })
  return _writeQueue
}
