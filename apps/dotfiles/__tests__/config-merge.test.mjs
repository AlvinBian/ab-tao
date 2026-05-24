/**
 * config-merge.test.mjs — JSON merger 邏輯驗證
 */

import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  getPath,
  hasPath,
  mergeArray,
  mergeConfig,
  setPath,
} from '../libs/install/config-merge.mjs'

// ── hasPath ────────────────────────────────────────────────────────

it('hasPath：基本存在', () => {
  assert.equal(hasPath({ a: 1 }, 'a'), true)
})

it('hasPath：巢狀存在', () => {
  assert.equal(
    hasPath({ permissions: { allow: [] } }, 'permissions.allow'),
    true,
  )
})

it('hasPath：不存在', () => {
  assert.equal(hasPath({ a: 1 }, 'b'), false)
})

it('hasPath：巢狀不存在', () => {
  assert.equal(hasPath({ permissions: {} }, 'permissions.allow'), false)
})

// ── getPath ────────────────────────────────────────────────────────

it('getPath：取得巢狀值', () => {
  assert.equal(
    getPath({ permissions: { allow: ['Bash'] } }, 'permissions.allow')[0],
    'Bash',
  )
})

it('getPath：不存在回傳 undefined', () => {
  assert.equal(getPath({ a: 1 }, 'b.c'), undefined)
})

// ── setPath ────────────────────────────────────────────────────────

it('setPath：設定巢狀值（自動建立中間物件）', () => {
  const obj = {}
  setPath(obj, 'permissions.allow', ['Bash'])
  assert.deepEqual(obj.permissions.allow, ['Bash'])
})

// ── mergeArray ─────────────────────────────────────────────────────

it('mergeArray union：聯集 + 去重', () => {
  const result = mergeArray(['a', 'b'], ['b', 'c'], 'union')
  assert.ok(result.includes('a'))
  assert.ok(result.includes('b'))
  assert.ok(result.includes('c'))
  // 去重：b 只出現一次
  assert.equal(result.filter(x => x === 'b').length, 1)
})

it('mergeArray local-wins：本地陣列完全勝出', () => {
  const result = mergeArray(['a', 'b'], ['c', 'd'], 'local-wins')
  assert.deepEqual(result, ['c', 'd'])
})

it('mergeArray：local 非陣列時 fallback 到 template', () => {
  const result = mergeArray(['a', 'b'], null, 'union')
  assert.deepEqual(result, ['a', 'b'])
})

// ── mergeConfig ────────────────────────────────────────────────────

it('mergeConfig：preserve path pin — local statusLine 不被 template 蓋', () => {
  const template = {
    statusLine: {
      type: 'command',
      command: '~/.claude/plugins/claude-hud/hud-wrapper.sh',
      enabled: true,
    },
    model: 'haiku',
  }
  const local = {
    statusLine: { type: 'command', command: 'my-custom.sh', padding: 0 },
    model: 'opus',
  }
  const policy = {
    preservePaths: ['statusLine', 'model'],
    arrayMerge: {},
  }

  const result = mergeConfig(template, local, policy)
  // preserve path：local 值優先
  assert.equal(result.statusLine.command, 'my-custom.sh')
  assert.equal(result.model, 'opus')
})

it('mergeConfig：null = 顯式刪除', () => {
  const template = { a: 1, b: 2 }
  const local = { a: null, b: 3 }

  const result = mergeConfig(template, local, {})
  // a 應被刪除（local 設為 null）
  assert.ok(!Object.hasOwn(result, 'a'), 'a 應被刪除')
  assert.equal(result.b, 3)
})

it('mergeConfig：union array 合併 + dedupe', () => {
  const template = {
    permissions: { deny: ['Bash(rm -rf /)'] },
  }
  const local = {
    permissions: { deny: ['Bash(rm -rf /)', 'Bash(git push --force *)'] },
  }
  const policy = {
    preservePaths: [],
    arrayMerge: { 'permissions.deny': 'union' },
  }

  const result = mergeConfig(template, local, policy)
  // union：包含兩方的元素
  assert.ok(result.permissions.deny.includes('Bash(rm -rf /)'))
  assert.ok(result.permissions.deny.includes('Bash(git push --force *)'))
  // 去重：'Bash(rm -rf /)' 只出現一次
  assert.equal(
    result.permissions.deny.filter(x => x === 'Bash(rm -rf /)').length,
    1,
  )
})

it('mergeConfig：local-wins array', () => {
  const template = {
    enabledPlugins: { 'plugin-a': true, 'plugin-b': true },
  }
  const local = {
    enabledPlugins: { 'plugin-c': true },
  }
  const policy = {
    preservePaths: [],
    arrayMerge: { enabledPlugins: 'local-wins' },
  }

  // enabledPlugins 是物件非陣列，local-wins 由 merge 規則（local 勝）處理
  const result = mergeConfig(template, local, policy)
  // local 勝：只有 plugin-c
  assert.ok(Object.hasOwn(result.enabledPlugins, 'plugin-c'))
})

it('mergeConfig：template key local 未設定 → 採用 template 預設', () => {
  const template = { autoMemoryEnabled: true, model: 'sonnet' }
  const local = { model: 'opus' }

  const result = mergeConfig(template, local, {})
  // autoMemoryEnabled 不在 local → 採用 template
  assert.equal(result.autoMemoryEnabled, true)
  // model 在 local → local 勝
  assert.equal(result.model, 'opus')
})

it('mergeConfig：不修改原始輸入物件（純函數）', () => {
  const template = { a: 1 }
  const local = { b: 2 }

  mergeConfig(template, local, {})

  assert.deepEqual(template, { a: 1 })
  assert.deepEqual(local, { b: 2 })
})

it('mergeConfig：深層巢狀物件遞迴合併', () => {
  const template = {
    env: { KEY_A: 'tpl-a', KEY_B: 'tpl-b' },
  }
  const local = {
    env: { KEY_A: 'local-a', KEY_C: 'local-c' },
  }

  const result = mergeConfig(template, local, {})
  // KEY_A：local 勝
  assert.equal(result.env.KEY_A, 'local-a')
  // KEY_B：template 補入
  assert.equal(result.env.KEY_B, 'tpl-b')
  // KEY_C：local 獨有，保留
  assert.equal(result.env.KEY_C, 'local-c')
})

it('mergeConfig：_abTao 命名空間（template 無此 key）→ local 完整保留', () => {
  const template = {
    model: 'sonnet',
    permissions: { allow: [] },
  }
  const local = {
    model: 'opus',
    permissions: { allow: ['Bash'] },
    _abTao: {
      disabledHooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ command: 'rtk.sh' }] }],
      },
      schemaVersion: '1.0.0',
    },
  }
  const policy = {
    preservePaths: ['_abTao'],
    arrayMerge: {},
  }

  const result = mergeConfig(template, local, policy)
  // _abTao 不在 template → local 完整保留（不被清除或覆蓋）
  assert.ok(Object.hasOwn(result, '_abTao'), '_abTao 應保留在合併結果中')
  assert.deepEqual(result._abTao, local._abTao)
  // disabledHooks 結構完整
  assert.ok(
    Array.isArray(result._abTao.disabledHooks.PreToolUse),
    'disabledHooks.PreToolUse 應為陣列',
  )
})

it('mergeConfig：extraKnownMarketplaces 深層合併 — 新增 claude-hud 不覆蓋現有 marketplace', () => {
  const template = {
    extraKnownMarketplaces: {
      'claude-hud': {
        source: { source: 'github', repo: 'jarrodwatts/claude-hud' },
      },
    },
  }
  const local = {
    extraKnownMarketplaces: {
      'my-custom-mkt': {
        source: { source: 'github', repo: 'example/custom' },
      },
    },
  }

  const result = mergeConfig(template, local, {
    preservePaths: [],
    arrayMerge: {},
  })
  // template 補入 claude-hud
  assert.ok(
    Object.hasOwn(result.extraKnownMarketplaces, 'claude-hud'),
    'claude-hud marketplace 應存在',
  )
  // local 的自定義 marketplace 應保留
  assert.ok(
    Object.hasOwn(result.extraKnownMarketplaces, 'my-custom-mkt'),
    '既有自定義 marketplace 應保留',
  )
  assert.equal(
    result.extraKnownMarketplaces['claude-hud'].source.repo,
    'jarrodwatts/claude-hud',
  )
})
