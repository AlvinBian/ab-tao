#!/usr/bin/env node

/**
 * d:profile — Profile 切換 CLI
 *
 * 用法：
 *   pnpm run d:profile          列出所有可用 profiles
 *   pnpm run d:profile --list   同上
 *   pnpm run d:profile <name>   切換至指定 profile
 */

import fs from 'node:fs'
import { P } from '../libs/core/paths.mjs'
import {
  BUILTIN_PROFILES,
  loadActiveProfile,
  setActiveProfile,
} from '../libs/install/profiles.mjs'

const arg = process.argv[2]

if (!arg || arg === '--list') {
  const active = loadActiveProfile()
  console.log('可用 profiles：')
  for (const profile of BUILTIN_PROFILES) {
    if (profile === active) {
      console.log(`  ✓ ${profile} (active)`)
    }
    else {
      console.log(`    ${profile}`)
    }
  }
  process.exit(0)
}

if (!BUILTIN_PROFILES.includes(arg)) {
  console.error(
    `❌ 未知 profile: ${arg}。可用：${BUILTIN_PROFILES.join(', ')}`,
  )
  process.exit(1)
}

// 寫入 profiles/active.json
setActiveProfile(arg)

// 同步更新 state.json runtime 欄位
try {
  const statePath = P.state
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    state.runtime = state.runtime ?? {}
    state.runtime.activeProfile = arg
    state.runtime.lastSwitchedAt = new Date().toISOString()
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8')
  }
}
catch {
  // state.json 不存在或格式異常時靜默忽略
}

console.log(`✅ 已切換到 profile: ${arg}`)
