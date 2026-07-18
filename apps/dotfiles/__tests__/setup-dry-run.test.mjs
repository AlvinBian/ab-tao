/**
 * setup-dry-run.test.mjs — 迴歸測試：非 TTY + --dry-run 不得掛死、不得誤導
 *
 * 背景（2026-07-18）：非 TTY 環境呼叫 `pnpm run d:setup --dry-run` 時，
 * bin/setup.mjs 會因「非 TTY 自動降級 Quick 模式」誤判為與 --dry-run 衝突，
 * 印出誤導性警告；且 Quick 模式下的舊配置偵測（runLegacyCheckIfNeeded → runUpgrade）
 * 完全沒有 dry-run / 非 TTY 保護，一律跳出互動 p.select，在非 TTY 下等於掛死
 * （子行程 stdin 立即 EOF，永遠等不到選擇）。
 *
 * 這支測試直接以子行程執行真實 CLI（非 TTY，stdin 為空管線，重現原始踩坑場景），
 * 用有限 timeout 把「掛死」轉成確定性失敗，這是唯一能驗證此類 bug 的方式
 * （抽取純函式單元測試測不到「行程有沒有卡住等 stdin」）。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dotfilesRoot = path.resolve(__dirname, '..')
const setupBin = path.join(dotfilesRoot, 'bin/setup.mjs')

// CI 或這台機器都可能觸發「偵測到舊配置」互動流程；不論是否觸發，
// dry-run 都必須在有限時間內跑完，不能卡在等 stdin 的互動 prompt 上。
const TIMEOUT_MS = 30_000

it('非 TTY + --dry-run：在 timeout 內完成，不掛死於互動 prompt', () => {
  let stdout
  assert.doesNotThrow(() => {
    stdout = execFileSync('node', [setupBin, '--dry-run'], {
      cwd: dotfilesRoot,
      // 顯式給空 stdin（管線立即 EOF）＝非 TTY，重現原始踩坑場景；
      // 不可用 'inherit'，否則測試在真 TTY 下跑會掩蓋掉這個 bug。
      input: '',
      timeout: TIMEOUT_MS,
      encoding: 'utf8',
    })
  }, /未在 timeout 內完成，代表卡在互動 prompt 等 stdin（迴歸）/)

  // dry-run 顯式旗標存在時，不應出現「已忽略 --dry-run」——
  // 那只該在使用者「明確」同時打 --quick --dry-run 時才合理觸發。
  assert.ok(
    !stdout.includes('已忽略 --dry-run'),
    '不應誤判非 TTY 自動降級的 Quick 模式為使用者明確衝突',
  )

  // 舊配置偵測若命中，dry-run 下必須是「只回報、不進互動 select」；
  // 互動 select 的訊息字串（'舊配置處理'）不該出現在 dry-run 輸出。
  assert.ok(
    !stdout.includes('舊配置處理'),
    'dry-run 不應進入互動式舊配置處理 select（會在非 TTY 下掛死）',
  )
})

it('明確衝突（--quick --dry-run 同時指定）：仍正確警告', () => {
  const stdout = execFileSync('node', [setupBin, '--quick', '--dry-run'], {
    cwd: dotfilesRoot,
    input: '',
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
  })

  assert.ok(
    stdout.includes('已忽略 --dry-run'),
    '使用者明確同時指定 --quick 與 --dry-run 時，仍應保留衝突警告',
  )
})
