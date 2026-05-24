/**
 * /api/restore/* — 備份列表與還原
 */

import fs from 'node:fs'
import { copyFile, cp, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { DOTFILES_BIN, runningTasks, sseHeaders, sseSend } from '../sse.mjs'

const DOTFILES_ROOT = path.resolve(DOTFILES_BIN, '..')
const BACKUP_BASE = path.join(DOTFILES_ROOT, 'dist', 'backup')
const HOME = process.env.HOME ?? ''

function formatBytes(bytes) {
  if (!bytes)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`
}

function countDir(dir) {
  let fileCount = 0
  let size = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const sub = countDir(p)
        fileCount += sub.fileCount
        size += sub.size
      }
      else {
        fileCount++
        size += fs.statSync(p).size
      }
    }
  }
  catch {
    /* 忽略無法讀取的目錄 */
  }
  return { fileCount, size }
}

function getBackups() {
  if (!fs.existsSync(BACKUP_BASE))
    return []
  return fs
    .readdirSync(BACKUP_BASE, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map((d) => {
      const dir = path.join(BACKUP_BASE, d.name)
      const { fileCount, size } = countDir(dir)
      const contents = fs.readdirSync(dir)
      return { id: d.name, dir, fileCount, size, contents }
    })
    .sort((a, b) => b.id.localeCompare(a.id))
}

export async function restoreRouter(req, res, url, json) {
  // ── GET /api/restore/backups ──
  if (req.method === 'GET' && url.pathname === '/api/restore/backups') {
    try {
      const backups = getBackups().map(({ id, fileCount, size, contents }) => ({
        id,
        fileCount,
        size: formatBytes(size),
        contents,
      }))
      json(res, 0, 'ok', backups)
    }
    catch (e) {
      json(res, 500, e.message, null, 500)
    }
    return true
  }

  // ── DELETE /api/restore ── 取消正在執行的還原
  if (req.method === 'DELETE' && url.pathname === '/api/restore') {
    const controller = runningTasks.get('restore')
    if (controller && typeof controller.abort === 'function') {
      controller.abort()
      json(res, 0, '還原已取消', null)
    }
    else {
      json(res, 404, '無正在執行的還原任務', null, 404)
    }
    return true
  }

  // ── POST /api/restore/execute ── SSE 串流還原
  if (req.method === 'POST' && url.pathname === '/api/restore/execute') {
    // 併發鎖：防止兩個請求同時還原導致 HOME 目錄競態
    if (runningTasks.has('restore')) {
      sseHeaders(res)
      sseSend(res, {
        type: 'error',
        message: '還原任務正在執行中，請稍後再試',
      })
      sseSend(res, { type: 'done', success: false })
      res.end()
      return true
    }

    const { backupId, dryRun = false } = req._body ?? {}
    if (!backupId) {
      json(res, 400, 'backupId 必填', null, 400)
      return true
    }
    const SAFE_ID = /^[\w-]+$/
    if (!SAFE_ID.test(backupId)) {
      json(res, 400, 'backupId 格式無效', null, 400)
      return true
    }
    const backupDir = path.join(BACKUP_BASE, backupId)
    if (
      !backupDir.startsWith(BACKUP_BASE + path.sep)
      && backupDir !== BACKUP_BASE
    ) {
      json(res, 400, 'backupId 格式無效', null, 400)
      return true
    }
    if (!fs.existsSync(backupDir)) {
      json(res, 404, `備份不存在：${backupId}`, null, 404)
      return true
    }

    const controller = new AbortController()
    const { signal } = controller

    sseHeaders(res)
    runningTasks.set('restore', controller)

    // 客戶端斷線時中止還原
    req.on('close', () => {
      if (!signal.aborted)
        controller.abort()
      runningTasks.delete('restore')
    })

    const restored = []
    const failed = []

    try {
      const contents = await readdir(backupDir)
      if (!res.writableEnded) {
        sseSend(res, {
          type: 'log',
          message: `${dryRun ? '[DRY-RUN] ' : ''}開始還原備份 ${backupId}（${contents.length} 項）`,
        })
      }
      for (const item of contents) {
        if (signal.aborted)
          break
        if (path.basename(item) !== item)
          continue
        const src = path.join(backupDir, item)
        let dest
        if (item === 'zshrc')
          dest = path.join(HOME, '.zshrc')
        else if (item === 'zsh')
          dest = path.join(HOME, '.zsh')
        else if (item === 'claude')
          dest = path.join(HOME, '.claude')
        else dest = path.join(HOME, `.${item}`)

        if (dryRun) {
          if (!res.writableEnded) {
            sseSend(res, {
              type: 'log',
              message: `[DRY-RUN] 將還原：${item} → ${dest}`,
            })
          }
        }
        else {
          try {
            const srcStat = await stat(src)
            if (srcStat.isDirectory()) {
              await cp(src, dest, { recursive: true, force: true })
            }
            else {
              await copyFile(src, dest)
            }
            restored.push(item)
            if (!res.writableEnded) {
              sseSend(res, {
                type: 'log',
                message: `✓ 還原：${item} → ${dest}`,
              })
            }
          }
          catch (itemErr) {
            failed.push({ item, error: itemErr.message })
            if (!res.writableEnded) {
              sseSend(res, {
                type: 'log',
                level: 'warn',
                message: `✗ 還原失敗：${item} — ${itemErr.message}`,
              })
            }
          }
        }
      }

      if (signal.aborted) {
        if (!res.writableEnded) {
          sseSend(res, { type: 'error', message: '還原已取消' })
          sseSend(res, {
            type: 'done',
            success: false,
            partial: { restored, failed },
          })
        }
      }
      else {
        const success = failed.length === 0
        if (!res.writableEnded) {
          sseSend(res, {
            type: 'done',
            success,
            dryRun,
            partial: { restored, failed },
          })
        }
      }
    }
    catch (e) {
      if (!res.writableEnded) {
        sseSend(res, { type: 'error', message: e.message })
        sseSend(res, {
          type: 'done',
          success: false,
          partial: { restored, failed },
        })
      }
    }
    finally {
      runningTasks.delete('restore')
      if (!res.writableEnded)
        res.end()
    }
    return true
  }

  return false
}
