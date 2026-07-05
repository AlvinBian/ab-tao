#!/usr/bin/env node
/**
 * verify-claude-sync.mjs — source ↔ live 一致性驗收
 *
 * 用 ab-tao 自身的 buildSyncPlan（與 d:setup 同邏輯）+ verifyManaged 判定
 * 每個 source 檔部署到 ~/.claude/ 後的實際狀態，列出殘餘 drift 與所需動作。
 *
 * 用法：node apps/dotfiles/bin/verify-claude-sync.mjs [--json]
 * exit code：0 = 全部一致（或僅 forbidden/預期差異）；1 = 有待處理 drift
 */

import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADDITIVE_DIRS,
  FORBIDDEN_DIRS,
  SETTINGS_PRESERVE_PATHS,
} from '../libs/config/preserve-policy.mjs'
import { buildSyncPlan } from '../libs/install/config-sync.mjs'
import { verifyManaged } from '../libs/state/state.mjs'

const JSON_OUT = process.argv.includes('--json')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HOME = os.homedir()
const home = path.join(HOME, '.claude')
// bin/ → apps/dotfiles → template = apps/dotfiles/claude
const template = path.resolve(__dirname, '..', 'claude')

/**
 * 依 sync action 分桶並說明所需動作。
 * @param {string} action buildSyncPlan 回傳的 PlanAction
 * @returns {{ bucket: string, consistent: boolean, hint: string }}
 */
function classify(action) {
  switch (action) {
    case 'noChange':
      return { bucket: '✅ 一致', consistent: true, hint: '' }
    case 'create':
      return { bucket: '🆕 待建立', consistent: false, hint: 'd:setup 會自動部署（新檔）' }
    case 'overwriteInteractive':
      return {
        bucket: '⚠️ drift（保護中）',
        consistent: false,
        hint: '互動式 d:setup 選「使用 ab-tao template」，或 AB_TAO_QUIET=1 pnpm d:setup',
      }
    case 'additiveKeep':
      return {
        bucket: '🔒 additive（永不覆蓋）',
        consistent: false,
        hint: 'config-sync 不覆蓋 skills/commands/agents/hooks → 用 c:skills 或手動 copy',
      }
    case 'mergeJson':
      return { bucket: '🔀 JSON merge', consistent: false, hint: 'd:setup 會 merge（settings 類）' }
    case 'lockedKeep':
      return { bucket: '📌 locked keep', consistent: false, hint: '使用者鎖定 keep-local，template 不覆蓋' }
    case 'forbiddenSkip':
      return {
        bucket: '⛔ forbidden（不部署）',
        consistent: true,
        hint: 'FORBIDDEN_DIRS：source 改動不會、也不應進 ~/.claude/',
      }
    default:
      return { bucket: `❓ ${action}`, consistent: false, hint: '' }
  }
}

const plan = await buildSyncPlan(home, template, {
  preservePaths: SETTINGS_PRESERVE_PATHS,
  additiveDirs: ADDITIVE_DIRS,
  forbiddenDirs: FORBIDDEN_DIRS,
})

const rows = plan
  .map(it => ({ ...it, ...classify(it.action) }))
  // 只關心非一致 + forbidden 頂層（一致的 noChange 太多，摘要即可）
  .filter(it => it.action !== 'noChange')

const noChangeCount = plan.filter(it => it.action === 'noChange').length
const pending = rows.filter(it => !it.consistent)

// state.json dead sync 路徑（d:doctor --fix 清）
const { deadIncluded } = verifyManaged()

if (JSON_OUT) {
  // rows = 所有非 noChange 項（含 forbidden 等一致項）；blocking = 真正待處理
  console.log(JSON.stringify(
    { noChangeCount, rows, blocking: pending, deadIncluded },
    null,
    2,
  ))
  process.exit(pending.length || deadIncluded.length ? 1 : 0)
}

console.log(`\n📋 source ↔ live 一致性驗收（template=${path.relative(HOME, template)}）\n`)
console.log(`✅ 已一致（noChange）：${noChangeCount} 檔\n`)

if (rows.length === 0) {
  console.log('🎉 無任何 drift / 待部署項目')
}
else {
  // 依 bucket 分組列印
  const byBucket = new Map()
  for (const r of rows) {
    if (!byBucket.has(r.bucket))
      byBucket.set(r.bucket, [])
    byBucket.get(r.bucket).push(r)
  }
  for (const [bucket, items] of byBucket) {
    console.log(`${bucket}（${items.length}）`)
    for (const it of items)
      console.log(`   ${it.relPath}`)
    if (items[0].hint)
      console.log(`   → ${items[0].hint}\n`)
    else console.log('')
  }
}

if (deadIncluded.length) {
  console.log(`⛔ state.json dead sync 路徑（${deadIncluded.length}）：${deadIncluded.join(', ')}`)
  console.log('   → 跑 pnpm run d:doctor --fix 清除\n')
}

const blocking = pending.length + deadIncluded.length
console.log(
  blocking === 0
    ? '結論：source 與 live 一致（或僅預期內 forbidden 差異）✅'
    : `結論：尚有 ${blocking} 項待處理 ⚠️（見上方 → 動作）`,
)
process.exit(blocking ? 1 : 0)
