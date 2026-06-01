/**
 * 交易化安裝層 — 快照 → 安裝 → commit / rollback
 *
 * 為何需要此模組：d:setup 的 doClean 會在安裝前清除 ~/.claude 配置；
 * 若安裝迴圈中途 throw，舊配置已清、新配置未完成 → 本地失效。
 * 此模組在任何 mutation 前先快照 mutable roots，失敗時整包還原。
 *
 * Target 集合 invariant：未列入集合的新寫入位置不會被回滾。
 * 新增安裝寫入位置時須同步擴充 DEFAULT_TARGETS。
 */

import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { BACKUP_DIR, cpDir } from '../core/backup.mjs'
import { getDirname, HOME, P } from '../core/paths.mjs'

const __dirname = getDirname(import.meta)
const REPO = path.resolve(__dirname, '../..')

/**
 * Basename 集合；cpDir 遇到這些子目錄名稱時跳過整支 subtree。
 * 防禦性設計：適用所有 mutable root，避免 .git/objects 等大量小檔觸發 ETIMEDOUT。
 */
const SKIP_NAMES = new Set(['.git', 'node_modules', '.cache'])

/**
 * Mutable roots that d:setup can write to.
 * FORBIDDEN_DIRS (memory/projects/plans/tasks/_archive) are never touched by install
 * and are intentionally excluded to avoid copying large user-private data.
 *
 * ~/.zshrc.d 以 per-file 方式列出（而非整 dir），避免複製 sheldon/repos/**（由
 * sheldon CLI 自管的 git clone cache，install 完全不碰，失敗後重跑 sheldon source
 * 即可 re-fetch，無需納入交易）。
 * 新增 zsh install 寫入點時須同步擴充此清單（參照 libs/features/zsh.mjs）。
 */
export const DEFAULT_TARGETS = [
  { absPath: P.claudeMdDir, label: 'claude-md', type: 'dir' },
  { absPath: P.rules, label: 'rules', type: 'dir' },
  { absPath: P.docs, label: 'docs', type: 'dir' },
  { absPath: P.agents, label: 'agents', type: 'dir' },
  { absPath: P.commands, label: 'commands', type: 'dir' },
  { absPath: P.skills, label: 'skills', type: 'dir' },
  { absPath: P.hooks, label: 'hooks', type: 'dir' },
  // zshrc.d: per-file entries（install 寫入點）
  { absPath: path.join(HOME, '.zshrc.d', 'conf'), label: 'zshrc.d/conf', type: 'dir' },
  { absPath: path.join(HOME, '.zshrc.d', '.prefs.zsh'), label: 'zshrc.d/.prefs.zsh', type: 'file' },
  { absPath: path.join(HOME, '.zshrc.d', 'sheldon', 'plugins.toml'), label: 'zshrc.d/sheldon/plugins.toml', type: 'file' },
  { absPath: P.claudeMd, label: 'CLAUDE.md', type: 'file' },
  { absPath: P.settings, label: 'settings.json', type: 'file' },
  { absPath: P.hooksJson, label: 'hooks.json', type: 'file' },
  { absPath: path.join(P.home, 'keybindings.json'), label: 'keybindings.json', type: 'file' },
  { absPath: P.state, label: 'state.json', type: 'file' },
  { absPath: path.join(HOME, '.zshrc'), label: '.zshrc', type: 'file' },
  { absPath: path.join(REPO, '.env'), label: 'repo-.env', type: 'file' },
]

/**
 * 快照 targets 到 snapshotDir，回傳 manifest。
 *
 * @param {{ absPath: string, label: string, type: 'dir'|'file' }[]} targets
 * @param {string} snapshotDir
 * @returns {{ absPath: string, label: string, type: 'dir'|'file', existed: boolean }[]}
 */
export function snapshotTargets(targets, snapshotDir) {
  fs.mkdirSync(snapshotDir, { recursive: true })
  return targets.map(({ absPath, label, type }) => {
    const existed = fs.existsSync(absPath)
    if (existed) {
      const dest = path.join(snapshotDir, label)
      if (type === 'dir') {
        cpDir(absPath, dest, { skipNames: SKIP_NAMES })
      }
      else {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(absPath, dest)
      }
    }
    return { absPath, label, type, existed }
  })
}

/**
 * 從 snapshotDir 還原 existed:true 的條目。
 * Best-effort：單條失敗不中止，收集後彙報。
 *
 * @param {{ absPath: string, label: string, type: 'dir'|'file', existed: boolean }[]} manifest
 * @param {string} snapshotDir
 * @returns {{ success: string[], failed: string[] }}
 */
export function restoreFromSnapshot(manifest, snapshotDir) {
  const success = []
  const failed = []
  for (const { absPath, label, type, existed } of manifest) {
    if (!existed)
      continue
    try {
      if (fs.existsSync(absPath))
        fs.rmSync(absPath, { recursive: true, force: true })
      const src = path.join(snapshotDir, label)
      if (type === 'dir') {
        cpDir(src, absPath, { skipNames: SKIP_NAMES })
      }
      else {
        fs.mkdirSync(path.dirname(absPath), { recursive: true })
        fs.copyFileSync(src, absPath)
      }
      success.push(label)
    }
    catch (e) {
      failed.push(`${label}: ${e.message}`)
    }
  }
  return { success, failed }
}

/**
 * 移除 install 期間新建（existed:false）的 target 路徑。
 * Best-effort。
 *
 * @param {{ absPath: string, label: string, existed: boolean }[]} manifest
 * @returns {{ success: string[], failed: string[] }}
 */
export function removeCreated(manifest) {
  const success = []
  const failed = []
  for (const { absPath, label, existed } of manifest) {
    if (existed)
      continue
    try {
      if (fs.existsSync(absPath))
        fs.rmSync(absPath, { recursive: true, force: true })
      success.push(label)
    }
    catch (e) {
      failed.push(`${label}: ${e.message}`)
    }
  }
  return { success, failed }
}

// ── 有狀態包裝 ──

let _active = false
let _committed = false
let _manifest = null
let _snapshotDir = null

/**
 * 開始交易。Idempotent — 已 begin 則 no-op。
 * 快照寫入 opts.snapshotDir（預設 BACKUP_DIR/txn）。
 *
 * @param {{ targets?: object[], snapshotDir?: string }} [opts]
 */
export function beginTransaction(opts = {}) {
  if (_active)
    return
  const targets = opts.targets ?? DEFAULT_TARGETS
  const snapshotDir = opts.snapshotDir ?? path.join(BACKUP_DIR, 'txn')
  _manifest = snapshotTargets(targets, snapshotDir)
  _snapshotDir = snapshotDir
  _active = true
  _committed = false
}

/**
 * 標記交易已成功提交。
 * 快照保留作 restore point，由 cleanOldBackups 依 BACKUP_MAX_COUNT 汰除。
 */
export function commitTransaction() {
  _committed = true
}

/**
 * 回滾：還原 existed:true 條目、移除 existed:false 條目。
 * Best-effort，失敗條目彙報到 stderr 但不拋錯。
 * committed 後呼叫為 no-op。
 *
 * @param {string} [reason]
 */
export function rollbackTransaction(reason = '') {
  if (!_active || _committed)
    return
  const restoreResult = restoreFromSnapshot(_manifest, _snapshotDir)
  const removeResult = removeCreated(_manifest)
  const allFailed = [...restoreResult.failed, ...removeResult.failed]
  if (reason)
    console.error(pc.dim(`[txn] 回滾原因：${reason}`))
  if (allFailed.length) {
    console.error(pc.yellow('[txn] 部分條目還原失敗：'))
    for (const f of allFailed)
      console.error(pc.dim(`  • ${f}`))
  }
  _active = false
}

export const isTransactionActive = () => _active
export const isCommitted = () => _committed

/** 僅供測試使用：重置模組狀態。 */
export function _resetForTest() {
  _active = false
  _committed = false
  _manifest = null
  _snapshotDir = null
}
