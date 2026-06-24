/**
 * preserve-policy.test.mjs — 保留策略定義驗證
 */

import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  ADDITIVE_DIRS,
  FORBIDDEN_DIRS,
  SETTINGS_ARRAY_MERGE,
  SETTINGS_PRESERVE_PATHS,
} from '../libs/config/preserve-policy.mjs'

// ── SETTINGS_PRESERVE_PATHS ───────────────────────────────────────

it('sETTINGS_PRESERVE_PATHS：無重複項目', () => {
  const seen = new Set()
  for (const p of SETTINGS_PRESERVE_PATHS) {
    assert.ok(!seen.has(p), `重複項目：${p}`)
    seen.add(p)
  }
})

it('sETTINGS_PRESERVE_PATHS：無空值', () => {
  for (const p of SETTINGS_PRESERVE_PATHS) {
    assert.ok(
      typeof p === 'string' && p.trim().length > 0,
      `空值或非字串：${JSON.stringify(p)}`,
    )
  }
})

it('sETTINGS_PRESERVE_PATHS：包含必要的保留路徑', () => {
  const required = [
    'statusLine',
    'mcpServers',
    'env',
    'model',
    'autoMemoryEnabled',
  ]
  for (const r of required) {
    assert.ok(SETTINGS_PRESERVE_PATHS.includes(r), `缺少必要路徑：${r}`)
  }
})

it('sETTINGS_PRESERVE_PATHS：包含 _abTao（Console 運行時命名空間）', () => {
  assert.ok(
    SETTINGS_PRESERVE_PATHS.includes('_abTao'),
    '_abTao 應在 SETTINGS_PRESERVE_PATHS，避免 d:setup 覆蓋 disabledHooks 等運行時狀態',
  )
})

// ── ADDITIVE_DIRS vs FORBIDDEN_DIRS ──────────────────────────────

it('aDDITIVE_DIRS 與 FORBIDDEN_DIRS 無重疊', () => {
  const additiveSet = new Set(ADDITIVE_DIRS)
  for (const dir of FORBIDDEN_DIRS) {
    assert.ok(
      !additiveSet.has(dir),
      `目錄同時在 ADDITIVE 和 FORBIDDEN 中：${dir}`,
    )
  }
})

it('fORBIDDEN_DIRS 包含 projects', () => {
  assert.ok(
    FORBIDDEN_DIRS.includes('projects'),
    'FORBIDDEN_DIRS 應包含 projects',
  )
})

it('fORBIDDEN_DIRS 不包含 ccline（已遷移至 claude-hud）', () => {
  assert.ok(
    !FORBIDDEN_DIRS.includes('ccline'),
    'FORBIDDEN_DIRS 不應包含 ccline',
  )
})

it('fORBIDDEN_DIRS 包含 sessions', () => {
  assert.ok(
    FORBIDDEN_DIRS.includes('sessions'),
    'FORBIDDEN_DIRS 應包含 sessions',
  )
})

it('fORBIDDEN_DIRS 包含 memory', () => {
  assert.ok(FORBIDDEN_DIRS.includes('memory'), 'FORBIDDEN_DIRS 應包含 memory')
})

it('fORBIDDEN_DIRS 包含 tasks', () => {
  assert.ok(FORBIDDEN_DIRS.includes('tasks'), 'FORBIDDEN_DIRS 應包含 tasks')
})

// ── SETTINGS_ARRAY_MERGE ─────────────────────────────────────────

it('sETTINGS_ARRAY_MERGE：策略值僅為 union 或 local-wins', () => {
  const validStrategies = new Set(['union', 'local-wins'])
  for (const [key, strategy] of Object.entries(SETTINGS_ARRAY_MERGE)) {
    assert.ok(
      validStrategies.has(strategy),
      `無效策略 "${strategy}" for key "${key}"，僅允許：union / local-wins`,
    )
  }
})

it('sETTINGS_ARRAY_MERGE：permissions.allow 不在 arrayMerge（由 preserve pin 處理）', () => {
  // allow 走 SETTINGS_PRESERVE_PATHS preserve（使用者偏好不被覆蓋），不走 arrayMerge
  assert.equal(SETTINGS_ARRAY_MERGE['permissions.allow'], undefined)
  assert.ok(
    SETTINGS_PRESERVE_PATHS.includes('permissions.allow'),
    'permissions.allow 應在 SETTINGS_PRESERVE_PATHS',
  )
})

it('sETTINGS_ARRAY_MERGE：permissions.deny 使用 union 策略', () => {
  assert.equal(SETTINGS_ARRAY_MERGE['permissions.deny'], 'union')
})
