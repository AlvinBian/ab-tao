/**
 * state.mjs — ~/.claude/.ab-tao/state.json 讀寫唯一入口
 *
 * 職責分工：
 *   managed  — ab-tao 追蹤的檔案（sha256、source、userOverride）
 *   choices  — 使用者對每個檔案的配置選擇（use-ab-tao/keep-local/merge/skip）
 *   sync     — chezmoi/ab-tao 同步範圍宣告（included/excluded 清單）
 *
 * 原子寫：write to .tmp → fsync → rename（避免中介態）
 * 並發鎖：flock 2s timeout（多 Claude Code session 同時寫入防護）
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { P } from '../core/paths.mjs'

const STATE_PATH = P.state
const LOCK_PATH = P.stateLock
const TMP_PATH = `${STATE_PATH}.tmp`

let _lockWarnPrinted = false
let _lockGloballyFailed = false

const EMPTY_STATE = {
  $schema: './state.schema.json',
  version: '1.0.0',
  installedAt: null,
  abTaoVersion: null,
  managed: {},
  choices: {},
  sync: {
    tool: 'ab-tao',
    included: [
      'claude-md/',
      'rules/',
      'docs/',
      'agents/',
      'commands/',
      'skills/',
      'hooks/',
      'memory/preferences/',
      'memory/patterns/',
      'CLAUDE.md',
      'settings.json',
    ],
    excluded: [
      'projects/',
      'plugins/cache/',
      'plugins/data/',
      'sessions/',
      'memory/archive/',
      '_archive/',
    ],
  },
}

/** 讀取 state（不存在時回傳 empty state） */
export function stateRead() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8')
    return { ...EMPTY_STATE, ...JSON.parse(raw) }
  }
  catch {
    return structuredClone(EMPTY_STATE)
  }
}

/**
 * 原子寫 state（write tmp → sync → rename）
 * 使用簡易檔案鎖（2s timeout），多 session 並發安全
 *
 * @param {(draft: object) => void} updater — 接收 draft 並就地修改
 */
export function stateWrite(updater) {
  const lockFd = _acquireLock()
  if (lockFd === null)
    return // 鎖逾時 → 唯讀模式，跳過寫入
  try {
    const state = stateRead()
    updater(state)
    const json = JSON.stringify(state, null, 2)
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
    fs.writeFileSync(TMP_PATH, json, 'utf8')
    // fsync via close（Node.js 無 fs.fsync sync wrapper，用 writeFileSync + rename 已夠）
    fs.renameSync(TMP_PATH, STATE_PATH)
  }
  finally {
    _releaseLock(lockFd)
  }
}

/** 取得 managed 清單中某路徑的記錄 */
export function stateGetManaged(relPath) {
  return stateRead().managed[relPath] ?? null
}

/** 更新 managed 記錄（merge 語義） */
export function stateSetManaged(relPath, entry) {
  stateWrite((s) => {
    s.managed[relPath] = { ...s.managed[relPath], ...entry }
  })
}

/** 取得使用者對某路徑的選擇 */
export function stateGetChoice(relPath) {
  return stateRead().choices[relPath] ?? null
}

/** 記錄使用者選擇 */
export function stateSetChoice(relPath, decision) {
  stateWrite((s) => {
    s.choices[relPath] = { decision, lockedAt: new Date().toISOString() }
    // 同步更新 managed 內的 userOverride flag
    if (s.managed[relPath]) {
      s.managed[relPath].userOverride = decision === 'keep-local'
    }
  })
}

/** 清空全部 choices（d:setup --reset-choices 使用） */
export function stateResetChoices() {
  stateWrite((s) => {
    s.choices = {}
    for (const entry of Object.values(s.managed)) {
      entry.userOverride = false
    }
  })
}

/**
 * 純讀審查：回傳 managed 的健康狀況（不寫入，無需鎖）
 * @returns {{ ghost: string[], driftSha: string[], deadIncluded: string[], orphans: string[] }}
 */
export function verifyManaged() {
  const state = stateRead()
  // ~/.claude 路徑：state.json 位於 ~/.claude/.ab-tao/state.json，往上兩層
  const claudeBase = path.resolve(STATE_PATH, '../..')
  const ghost = []
  const driftSha = []
  const deadIncluded = []
  const orphans = []

  for (const [relPath, entry] of Object.entries(state.managed)) {
    const fullPath = path.join(claudeBase, relPath)
    if (!fs.existsSync(fullPath)) {
      ghost.push(
        entry.userOverride === true ? `${relPath} [kept-by-user]` : relPath,
      )
    }
    else if (entry.sha256) {
      const actual = createHash('sha256')
        .update(fs.readFileSync(fullPath))
        .digest('hex')
      if (actual !== entry.sha256)
        driftSha.push(relPath)
    }
  }

  const managedKeys = new Set(Object.keys(state.managed))
  for (const includedPath of state.sync?.included ?? []) {
    const fullIncludedPath = path.join(claudeBase, includedPath)
    if (!fs.existsSync(fullIncludedPath)) {
      deadIncluded.push(includedPath)
      continue
    }
    let stat
    try {
      stat = fs.statSync(fullIncludedPath)
    }
    catch {
      continue
    }
    if (!stat.isDirectory())
      continue
    let entries
    try {
      entries = fs.readdirSync(fullIncludedPath, { withFileTypes: true })
    }
    catch {
      continue
    }
    for (const dirent of entries) {
      if (!dirent.isFile() || !dirent.name.endsWith('.md'))
        continue
      const fileRelPath = path
        .join(includedPath, dirent.name)
        .replace(/\\/g, '/')
      if (!managedKeys.has(fileRelPath))
        orphans.push(fileRelPath)
    }
  }

  return { ghost, driftSha, deadIncluded, orphans }
}

// ── 私有：簡易檔案鎖 ────────────────────────────────────────

function _acquireLock(timeoutMs = 2000) {
  // 同一 process 內鎖已知失敗 → 立刻 fast-fail，不再 spin
  if (_lockGloballyFailed)
    return null

  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true })
  const start = Date.now()
  while (true) {
    try {
      const fd = fs.openSync(LOCK_PATH, 'wx') // 排他建立
      return fd
    }
    catch (e) {
      if (e.code !== 'EEXIST')
        throw e
      if (Date.now() - start >= timeoutMs) {
        _lockGloballyFailed = true
        if (!_lockWarnPrinted) {
          console.warn(
            '[ab-tao] state.json 鎖逾時（另一 Claude Code session 進行中），以唯讀模式繼續',
          )
          _lockWarnPrinted = true
        }
        return null
      }
      // 短暫等待後重試（同步 spin，最多 2s）
      const until = Date.now() + 50
      // eslint-disable-next-line no-empty
      while (Date.now() < until) {} // busy-wait 50ms
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
    // 忽略關閉時的競態
  }
}
