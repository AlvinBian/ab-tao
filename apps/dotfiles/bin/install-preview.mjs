#!/usr/bin/env node
/**
 * install-preview.mjs — 將 dist/preview/claude/ 安裝到 ~/.claude/
 *
 * 由 install-claude.mjs 的 runWithProgress 呼叫，負責把已生成的 preview 檔案
 * 複製到 ~/.claude/，並逐檔輸出 ✅ 進度供 parseProgress 解析。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoDir = path.join(__dirname, '..')
const previewDir = path.join(repoDir, 'dist', 'preview', 'claude')
const destDir = path.join(os.homedir(), '.claude')

if (!fs.existsSync(previewDir)) {
  console.error(`preview 目錄不存在：${previewDir}`)
  process.exit(1)
}

function walk(dir, base = '') {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...walk(path.join(dir, entry.name), rel))
    }
    else {
      files.push(rel)
    }
  }
  return files
}

const files = walk(previewDir)
for (const rel of files) {
  const src = path.join(previewDir, rel)
  const dest = path.join(destDir, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  console.log(`  ✅ ${rel}`)
}
