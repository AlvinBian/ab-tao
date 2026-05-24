/**
 * plan-summary.mjs — 配置同步計畫摘要渲染
 *
 * 職責：將 buildSyncPlan() 的輸出格式化為樹狀摘要表格，
 *       印出各分類的項目數量，協助使用者快速了解本次同步範圍。
 *
 * 呼叫方：config-sync.mjs → syncConfig() 在 buildSyncPlan() 後呼叫
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { t } from './theme.mjs'

/**
 * 計畫項目分類對映（action → 顯示用 emoji + 標籤）
 *
 * 計畫中的 action 類型：
 *   create        — 目標不存在，首次安裝
 *   noChange      — 內容相同，無需操作（對齊）
 *   overwriteFile — 非 JSON 有 drift，需決策
 *   mergeJson     — JSON 有 drift，自動合併
 *   lockedKeep    — choices.decision = keep-local（已鎖定）
 *   additiveKeep  — ADDITIVE_DIRS 中本地獨有
 *   forbiddenSkip — FORBIDDEN_DIRS 完全跳過
 */
const ACTION_META = {
  create: { icon: '✨', label: '新建', hint: '首次安裝' },
  noChange: { icon: '⏭️ ', label: '對齊', hint: '內容一致' },
  overwriteFile: {
    icon: '🔄',
    label: '更新',
    hint: 'template 新版 / local 無改動',
  },
  mergeJson: { icon: '🔀', label: '合併', hint: 'JSON 自動合併' },
  overwriteInteractive: { icon: '🙋', label: '互動', hint: 'drift 需決策' },
  lockedKeep: {
    icon: '📌',
    label: '鎖定',
    hint: 'choices.decision = keep-local',
  },
  additiveKeep: { icon: '➕', label: '保留', hint: 'ADDITIVE_DIRS 本地獨有' },
  forbiddenSkip: { icon: '🚫', label: '禁掃', hint: 'FORBIDDEN_DIRS' },
}

/**
 * 計算計畫中各 action 的數量
 *
 * @param {Array<{action: string, [key: string]: unknown}>} plan
 * @returns {Record<string, number>} 各 action 的計數
 */
function countActions(plan) {
  const counts = {}
  for (const item of plan) {
    const key = item.action
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/**
 * 渲染計畫摘要（輸出到 stdout via @clack/prompts）
 *
 * 輸出格式：
 *   📦 配置同步計畫（共 N 項）
 *   ├─ ✨  新建：X 個（首次安裝）
 *   ├─ ⏭️   對齊：X 個（內容一致）
 *   ├─ 🔄  更新：X 個（template 新版 / local 無改動）
 *   ├─ 🙋  互動：X 個（drift 需決策）
 *   ├─ 📌  鎖定：X 個（choices.decision = keep-local）
 *   ├─ ➕  保留：X 個（ADDITIVE_DIRS 本地獨有）
 *   └─ 🚫  禁掃：X 目錄（FORBIDDEN_DIRS）
 *
 *   明細：pnpm run d:status --verbose
 *
 * @param {Array<{action: string, [key: string]: unknown}>} plan
 *   buildSyncPlan() 回傳的計畫陣列
 */
export function renderPlanSummary(plan) {
  const counts = countActions(plan)
  const total = plan.length

  // 定義顯示順序（只顯示出現過的 action）
  const displayOrder = [
    'create',
    'noChange',
    'overwriteFile',
    'overwriteInteractive',
    'mergeJson',
    'lockedKeep',
    'additiveKeep',
    'forbiddenSkip',
  ]

  // 過濾出有計數的 action
  const activeActions = displayOrder.filter(a => counts[a] > 0)

  // 建構樹狀行
  const lines = [`${pc.bold('📦 配置同步計畫')}（共 ${t.count(total)} 項）`]

  for (let i = 0; i < activeActions.length; i++) {
    const action = activeActions[i]
    const count = counts[action]
    const meta = ACTION_META[action] ?? { icon: '?', label: action, hint: '' }
    const isLast = i === activeActions.length - 1
    const prefix = isLast ? '└─' : '├─'

    // FORBIDDEN_DIRS 以「目錄」為單位，其他以「個」為單位
    const unit = action === 'forbiddenSkip' ? '目錄' : '個'

    lines.push(
      `${prefix} ${meta.icon}  ${pc.cyan(meta.label)}：${t.count(count)} ${unit}${
        meta.hint ? pc.dim(`（${meta.hint}）`) : ''}`,
    )
  }

  lines.push('')
  lines.push(pc.dim('明細：pnpm run d:status --verbose'))

  p.log.info(lines.join('\n'))
}
