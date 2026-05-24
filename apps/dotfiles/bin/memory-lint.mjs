#!/usr/bin/env node

/**
 * c:memory --lint — Memory Hot 層檢查
 *
 * 檢查 ~/.claude/projects/ 各 project 目錄下的 memory/MEMORY.md：
 *   - Hot 層行數 ≤ 15
 *   - 每行 ≤ 150 字元
 *
 * 輸出違規項目，全部合規則輸出通過訊息。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { P } from '../libs/core/paths.mjs'

const MAX_LINES = 15
const MAX_CHARS_PER_LINE = 150

/** 使用 glob-like 方式找到所有 project MEMORY.md */
function findMemoryFiles() {
  const projectsDir = P.projects
  if (!fs.existsSync(projectsDir))
    return []

  const files = []
  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    for (const dir of projectDirs) {
      if (!dir.isDirectory())
        continue
      const memPath = path.join(projectsDir, dir.name, 'memory', 'MEMORY.md')
      if (fs.existsSync(memPath)) {
        files.push({ projectDir: dir.name, memPath })
      }
    }
  }
  catch {
    // readdirSync 失敗時靜默
  }

  // 也加入全域 memory/MEMORY.md
  const globalMem = path.join(P.memory, 'MEMORY.md')
  if (fs.existsSync(globalMem)) {
    files.push({ projectDir: '(global)', memPath: globalMem })
  }

  return files
}

/** 檢查單一 MEMORY.md，回傳違規清單 */
function lintFile(memPath) {
  const violations = []
  const content = fs.readFileSync(memPath, 'utf8')
  const lines = content.split('\n')

  // 行數檢查（排除末尾空行）
  const nonEmptyLines = lines.filter(
    (l, i) => l.trim() || i < lines.length - 1,
  )
  const lineCount = nonEmptyLines.length
  if (lineCount > MAX_LINES) {
    violations.push(`  行數超限：${lineCount} 行（上限 ${MAX_LINES}）`)
  }

  // 每行字元數檢查
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.length > MAX_CHARS_PER_LINE) {
      const preview = `${line.substring(0, 60)}…`
      violations.push(
        `  第 ${i + 1} 行 ${line.length} 字元（上限 ${MAX_CHARS_PER_LINE}）：${preview}`,
      )
    }
  }

  return violations
}

function main() {
  const files = findMemoryFiles()

  if (files.length === 0) {
    console.log('找不到任何 MEMORY.md 檔案。')
    console.log(`  搜尋路徑：${P.projects}`)
    process.exit(0)
  }

  let totalViolations = 0

  for (const { projectDir, memPath } of files) {
    const relPath = path.relative(os.homedir(), memPath).replace(/^/, '~/')
    let violations
    try {
      violations = lintFile(memPath)
    }
    catch (e) {
      console.log(`⚠️  ${relPath}：讀取失敗（${e.message}）`)
      continue
    }

    if (violations.length > 0) {
      console.log(`\n❌ ${relPath}（專案：${projectDir}）`)
      for (const v of violations) {
        console.log(v)
      }
      totalViolations += violations.length
    }
  }

  if (totalViolations === 0) {
    console.log('✅ Memory Hot 層檢查通過')
  }
  else {
    console.log(`\n共 ${totalViolations} 項違規，請修正後重新執行。`)
  }
}

try {
  main()
}
catch (e) {
  console.error(`執行失敗：${e.message}`)
  process.exit(1)
}
