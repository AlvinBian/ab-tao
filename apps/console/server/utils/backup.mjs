import { existsSync, mkdirSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * 寫入前自動備份 settings.json 至 ~/.claude/.ab-tao/backups/console-{stamp}/
 * 備份失敗時 throw（呼叫方應 return 503），不允許在備份失敗後繼續寫入
 */
export async function backupSettings(P) {
  if (!existsSync(P.settings))
    return
  const now = new Date()
  const stamp = now
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(':', '-')
  const dir = path.join(P.abTaoDir, `backups/console-${stamp}`)
  mkdirSync(dir, { recursive: true })
  await copyFile(P.settings, path.join(dir, 'settings.json'))
}
