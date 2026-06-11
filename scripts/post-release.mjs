#!/usr/bin/env node
/**
 * Release 後自動補 git tag（vX.Y.Z）+ GitHub Release。
 *
 * 為何需要：`@ab-tao/dotfiles` 是 private package，changeset 的 `changeset tag`
 * 對 private package 是 no-op，不會自動打 tag。此腳本在 `pnpm run release` 末段
 * 補上 annotated tag + GitHub Release，notes 由 apps/dotfiles/CHANGELOG.md 自動提取。
 *
 * 冪等：tag / release 已存在則跳過；gh 失敗只告警不中斷。
 * 安全：一律用 execFileSync（不走 shell），參數以陣列傳遞，避免命令注入。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 執行並回傳 stdout；失敗回傳 null（用於存在性探測） */
function tryRun(file, args) {
  try {
    return execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  }
  catch {
    return null
  }
}
/** 執行並把輸出導到終端；失敗拋出 */
function run(file, args, opts = {}) {
  return execFileSync(file, args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], ...opts })
}

const v = JSON.parse(readFileSync(`${root}/apps/dotfiles/package.json`, 'utf8')).version
const tag = `v${v}`

// 從 CHANGELOG 提取本版本段（## <v> 到下一個 ## 之間）
const lines = readFileSync(`${root}/apps/dotfiles/CHANGELOG.md`, 'utf8').split('\n')
const start = lines.findIndex(l => l.trim() === `## ${v}`)
let notes = ''
if (start >= 0) {
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(l => l.startsWith('## '))
  notes = (end >= 0 ? rest.slice(0, end) : rest).join('\n').trim()
}
// 第一個 bullet 去掉 conventional 前綴 → 標題摘要
const firstBullet = (notes.match(/^- (.+)$/m)?.[1] || '').replace(/^\w+(\([^)]*\))?:\s*/, '').trim()
const title = firstBullet ? `dotfiles ${tag} — ${firstBullet}` : `dotfiles ${tag}`

// 1. annotated tag（冪等）+ push
if (tryRun('git', ['rev-parse', tag]) === null) {
  run('git', ['tag', '-a', tag, '-m', `${tag} — ${firstBullet}`])
  console.log(`✓ 建 tag ${tag}`)
}
else {
  console.log(`• tag ${tag} 已存在`)
}
tryRun('git', ['push', 'origin', tag])

// 2. GitHub Release（冪等；gh 失敗不中斷 release）
if (tryRun('gh', ['release', 'view', tag]) === null) {
  try {
    run('gh', ['release', 'create', tag, '--verify-tag', '--title', title, '--notes-file', '-'], {
      input: notes || `Release ${tag}`,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    console.log(`✓ 建 GitHub Release ${tag}`)
  }
  catch (e) {
    console.warn(`⚠️ gh release create 失敗（tag 已 push，可稍後手動補）：${e.message}`)
  }
}
else {
  console.log(`• GitHub Release ${tag} 已存在`)
}
