#!/usr/bin/env node

/**
 * ~/.zshrc 重複 loader 注入清理工具
 *
 * 當 d:setup 重複執行且 dedup 邏輯失敗時，
 * ~/.zshrc 可能出現多份 ab-tao:loader 區塊。
 * 本工具負責偵測並清理多餘的注入，只保留最後一份（最新）。
 *
 * 用法：
 *   node zshrc-dedupe.mjs [--dry-run] [<zshrc-path>]
 *
 * 回傳：
 *   { removed: number, kept: 1, backupPath: string|null }
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** loader 區塊的起始標記（不含 # 前綴，用於 includes 匹配） */
const MARKER_START = '=== ab-tao:loader ==='
/** loader 區塊的結束標記 */
const MARKER_END = '=== ab-tao:loader end ==='

/**
 * 在檔案行陣列中找出所有 loader 區塊的範圍（含標記行）
 *
 * @param {string[]} lines - 檔案所有行（不含換行符）
 * @returns {{ start: number, end: number }[]} 每個區塊的 [起始行索引, 結束行索引]（閉區間）
 */
function findLoaderBlocks(lines) {
  const blocks = []
  let startIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes(MARKER_START)) {
      startIdx = i
    }
    else if (line.includes(MARKER_END) && startIdx !== -1) {
      blocks.push({ start: startIdx, end: i })
      startIdx = -1
    }
  }

  return blocks
}

/**
 * 產生 ISO 8601 compact 格式的時間戳（供備份檔名使用）
 * 例：2026-04-21T100000Z
 *
 * @returns {string}
 */
function isoCompact() {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/:/g, '')
}

/**
 * 清理 ~/.zshrc 中重複的 ab-tao:loader 區塊
 *
 * - 若找到 ≤ 1 個區塊：不修改，直接回傳
 * - 若找到 ≥ 2 個區塊：保留最後一份，移除其餘所有區塊
 * - 寫入前先備份至 `{path}.bak.{ISO8601_compact}`
 * - --dry-run 模式：只印出將被移除的行範圍，不實際寫入
 *
 * @param {string} zshrcPath - ~/.zshrc 的絕對路徑
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ removed: number, kept: number, backupPath: string|null }}
 */
export function dedupeZshrc(zshrcPath, { dryRun = false } = {}) {
  if (!fs.existsSync(zshrcPath)) {
    console.log(`檔案不存在：${zshrcPath}`)
    return { removed: 0, kept: 0, backupPath: null }
  }

  const content = fs.readFileSync(zshrcPath, 'utf8')
  // 保留原始換行符（結尾可能無換行）
  const lines = content.split('\n')

  const blocks = findLoaderBlocks(lines)

  if (blocks.length <= 1) {
    console.log(`✓ 無重複注入（共 ${blocks.length} 份 loader）`)
    return { removed: 0, kept: blocks.length, backupPath: null }
  }

  // 保留最後一個區塊，移除前面所有區塊
  const toRemove = blocks.slice(0, -1) // 前 N-1 個區塊需要移除

  if (dryRun) {
    console.log(
      `[DRY RUN] 偵測到 ${blocks.length} 份 loader，將移除前 ${toRemove.length} 份：`,
    )
    for (const block of toRemove) {
      // 轉換為 1-based 行號，方便閱讀
      console.log(`  行 ${block.start + 1}–${block.end + 1}`)
    }
    console.log(
      `  保留：行 ${blocks.at(-1).start + 1}–${blocks.at(-1).end + 1}`,
    )
    return { removed: toRemove.length, kept: 1, backupPath: null }
  }

  // 備份原始檔
  const backupPath = `${zshrcPath}.bak.${isoCompact()}`
  fs.writeFileSync(backupPath, content, 'utf8')
  console.log(`已備份至：${backupPath}`)

  // 標記需要移除的行索引（以 Set 儲存，O(1) 查找）
  const removeIndexes = new Set()
  for (const block of toRemove) {
    for (let i = block.start; i <= block.end; i++) {
      removeIndexes.add(i)
    }
  }

  // 移除前各區塊的緊接前空白行（避免殘留視覺間隔）
  // 往前找連續空白行並一起移除
  for (const block of toRemove) {
    let i = block.start - 1
    while (i >= 0 && lines[i].trim() === '') {
      removeIndexes.add(i)
      i--
    }
  }

  // 過濾掉需移除的行
  const cleaned = lines.filter((_, idx) => !removeIndexes.has(idx)).join('\n')

  fs.writeFileSync(zshrcPath, cleaned, 'utf8')
  console.log(
    `✓ 已移除 ${toRemove.length} 份重複注入，保留最後一份（共清理 ${removeIndexes.size} 行）`,
  )

  return { removed: toRemove.length, kept: 1, backupPath }
}

// ── CLI 入口 ─────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  // 取第一個非 flag 參數作為 zshrc 路徑，否則用預設
  const pathArg = args.find(a => !a.startsWith('--'))
  const zshrcPath = pathArg
    ? path.resolve(pathArg)
    : path.join(os.homedir(), '.zshrc')

  console.log(`檢查：${zshrcPath}${dryRun ? '（dry-run 模式）' : ''}`)

  const result = dedupeZshrc(zshrcPath, { dryRun })
  process.exit(result.removed > 0 || result.kept <= 1 ? 0 : 0)
}
