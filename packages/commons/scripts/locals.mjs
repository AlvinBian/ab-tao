#!/usr/bin/env node
/**
 * c:locals — 本地整合服務管理
 *
 * 管理 browser-harness（Python venv）及 awesome-ai-pedia（git repo）的狀態查看與診斷。
 * 註：語義代碼搜尋改用 CodeRAG（pipx + MCP on-demand，無常駐服務；claude-context/Milvus/LM Studio 已退役，見 docs/local-tools.md § A）。
 *
 * 使用方式：pnpm run c:locals [--status|--start|--stop|--doctor|--install]
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HOME = homedir()
const HARNESS_VENV = join(HOME, '.ab-tao', 'browser-harness', '.venv')
const AIPEDIA_DIR = join(HOME, '.ab-tao', 'external', 'awesome-ai-pedia')

// ── 狀態偵測 ────────────────────────────────────────────────────────

function checkBrowserHarness() {
  const playwrightBin = join(HARNESS_VENV, 'bin', 'playwright')
  if (!existsSync(playwrightBin))
    return false
  try {
    execFileSync(playwrightBin, ['--version'], { stdio: 'pipe' })
    return true
  }
  catch {
    return false
  }
}

function checkAiPedia() {
  return existsSync(join(AIPEDIA_DIR, '.git'))
}

function getStatus() {
  return {
    browserHarness: checkBrowserHarness(),
    aiPedia: checkAiPedia(),
  }
}

// ── 命令處理 ────────────────────────────────────────────────────────

function cmdStatus() {
  const s = getStatus()
  const icon = ok => (ok ? '✅' : '❌')

  console.log('── 本地整合服務狀態 ──')
  console.log(`${icon(s.browserHarness)} browser-harness (${HARNESS_VENV})`)
  console.log(`${icon(s.aiPedia)}   AI-Pedia        (${AIPEDIA_DIR})`)

  const missing = []
  if (!s.browserHarness)
    missing.push('browser-harness（pnpm run d:setup）')
  if (!s.aiPedia)
    missing.push('AI-Pedia（pnpm run c:ai-sync --source awesome-ai-pedia）')

  if (missing.length) {
    console.log('\n未就緒服務：')
    for (const m of missing) console.log(`  • ${m}`)
  }
  else {
    console.log('\n所有服務已就緒 ✅')
  }
}

function cmdStart() {
  console.log('── 啟動本地服務 ──')
  console.log('ℹ️  無常駐服務需啟動：')
  console.log('   • 語義搜尋改用 CodeRAG（MCP on-demand，無需啟動）')
  console.log('   • browser-harness / AI-Pedia 為 venv / git repo，無服務進程')
}

function cmdStop() {
  console.log('── 停止本地服務 ──')
  console.log('ℹ️  無常駐服務需停止（Milvus / LM Studio 已退役；CodeRAG 為 on-demand）')
}

function cmdDoctor() {
  console.log('── 診斷本地整合服務 ──')
  const s = getStatus()

  const issues = []
  if (!s.browserHarness) {
    issues.push(
      `browser-harness venv 不存在（${HARNESS_VENV}）→ pnpm run d:setup`,
    )
  }
  if (!s.aiPedia) {
    issues.push(
      `AI-Pedia 未同步（${AIPEDIA_DIR}）→ pnpm run c:ai-sync --source awesome-ai-pedia`,
    )
  }

  if (issues.length === 0) {
    console.log('✅ 所有本地整合服務正常')
  }
  else {
    console.log(`發現 ${issues.length} 個問題：`)
    for (const issue of issues) console.log(`  ⚠️  ${issue}`)
  }
}

function cmdInstall() {
  console.log('── 安裝本地整合服務 ──')
  console.log('請執行 pnpm run d:setup 並在功能選單勾選：')
  console.log('  🌐 browser-harness')
  console.log('  📖 Awesome-AI-Pedia')
  console.log(
    '\n語義代碼搜尋（CodeRAG）：pipx install "coderag[mcp] @ git+https://github.com/Neverdecel/CodeRAG"（見 docs/local-tools.md § A）',
  )
}

// ── CLI 入口 ────────────────────────────────────────────────────────

const arg = process.argv[2]
switch (arg) {
  case '--status':
    cmdStatus()
    break
  case '--start':
    cmdStart()
    break
  case '--stop':
    cmdStop()
    break
  case '--doctor':
    cmdDoctor()
    break
  case '--install':
    cmdInstall()
    break
  default:
    console.log(
      '使用方式：pnpm run c:locals [--status|--start|--stop|--doctor|--install]',
    )
    process.exit(1)
}
