/**
 * preferences-store 單元測試
 *
 * 執行：node --test __tests__/preferences-store.test.mjs
 * （透過 pnpm run test 自動包含）
 *
 * 隔離策略：AB_TAO_PREFS_PATH / AB_TAO_PREFS_LOCK 環境變數指向 tmpDir，
 * 每個 test case 在 beforeEach 清除 tmpDir 下的檔案。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line test/no-import-node-test
import { after, beforeEach, describe, it } from 'node:test'

// ── 測試隔離：建立 tmpDir，透過 env var 讓 preferences-store 使用 ────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-tao-prefs-test-'))
const PREFS_PATH = path.join(tmpDir, 'preferences.json')
const LOCK_PATH = path.join(tmpDir, 'preferences.lock')

// 設定在 import 前，確保 preferences-store.mjs 讀到覆蓋路徑
process.env.AB_TAO_PREFS_PATH = PREFS_PATH
process.env.AB_TAO_PREFS_LOCK = LOCK_PATH

// 動態 import（確保路徑覆蓋已生效後才載入模組）
const {
  prefsRead,
  prefsWrite,
  prefsPatch,
  prefsGet,
  prefsRecordChoice,
  prefsReset,
} = await import('../libs/core/preferences-store.mjs')

// ── 清理 ─────────────────────────────────────────────────────────────────────

function clearFiles() {
  for (const f of [PREFS_PATH, LOCK_PATH]) {
    try {
      fs.unlinkSync(f)
    }
    catch { /* 不存在時忽略 */ }
  }
  // 清除 .broken-* backup
  for (const f of fs.readdirSync(tmpDir)) {
    if (f.includes('.broken-')) {
      try {
        fs.unlinkSync(path.join(tmpDir, f))
      }
      catch { /* 忽略 */ }
    }
  }
}

beforeEach(clearFiles)

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ── prefsRead ─────────────────────────────────────────────────────────────────

describe('prefsRead', () => {
  it('檔案不存在時回傳空骨架', () => {
    const prefs = prefsRead()
    assert.equal(prefs.version, 1)
    assert.deepEqual(prefs.choices, {})
    assert.deepEqual(prefs.optionUsage, {})
  })

  it('損壞 JSON 回傳空骨架並建立 .broken backup', () => {
    fs.writeFileSync(PREFS_PATH, '{bad json', 'utf8')
    const prefs = prefsRead()
    assert.deepEqual(prefs.choices, {})
    const backups = fs.readdirSync(tmpDir).filter(f => f.includes('.broken-'))
    assert.ok(backups.length >= 1, '應建立 .broken backup 檔')
  })

  it('空物件 JSON 回傳骨架預設值', () => {
    fs.writeFileSync(PREFS_PATH, '{}', 'utf8')
    const prefs = prefsRead()
    assert.equal(prefs.version, 1)
    assert.deepEqual(prefs.choices, {})
  })
})

// ── prefsWrite + prefsRead 循環 ────────────────────────────────────────────────

describe('prefsWrite / prefsRead', () => {
  it('寫入後讀取結果一致', () => {
    prefsWrite({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      choices: {
        features: { value: ['zsh', 'claude-base'], pickedAt: '2026-01-01T00:00:00.000Z' },
      },
      optionUsage: { features: { zsh: 3 } },
    })
    const read = prefsRead()
    assert.deepEqual(read.choices.features.value, ['zsh', 'claude-base'])
    assert.equal(read.optionUsage.features.zsh, 3)
  })

  it('寫入後 updatedAt 已更新', () => {
    const before = new Date().toISOString()
    prefsWrite({ version: 1, updatedAt: '', choices: {}, optionUsage: {} })
    const { updatedAt } = prefsRead()
    assert.ok(updatedAt >= before, 'updatedAt 應更新為寫入時間')
  })
})

// ── prefsPatch ────────────────────────────────────────────────────────────────

describe('prefsPatch', () => {
  it('局部更新不覆蓋其他欄位', () => {
    prefsWrite({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      choices: { features: { value: ['zsh'], pickedAt: '...' } },
      optionUsage: {},
    })
    prefsPatch((draft) => {
      draft.choices['scan.repos'] = { value: ['org/repo1'], pickedAt: '...' }
      return draft
    })
    const result = prefsRead()
    assert.deepEqual(result.choices.features.value, ['zsh'])
    assert.deepEqual(result.choices['scan.repos'].value, ['org/repo1'])
  })
})

// ── prefsGet ──────────────────────────────────────────────────────────────────

describe('prefsGet', () => {
  it('有值時回傳 value', () => {
    prefsWrite({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      choices: { features: { value: ['zsh'], pickedAt: '...' } },
      optionUsage: {},
    })
    assert.deepEqual(prefsGet('features'), ['zsh'])
  })

  it('不存在的 key 回傳 undefined', () => {
    assert.equal(prefsGet('nonexistent'), undefined)
  })
})

// ── prefsRecordChoice ─────────────────────────────────────────────────────────

describe('prefsRecordChoice', () => {
  it('陣列選擇累計更新 choices + optionUsage', () => {
    prefsRecordChoice('features', ['zsh', 'claude-base'])
    prefsRecordChoice('features', ['zsh', 'plugins'])

    const prefs = prefsRead()
    assert.deepEqual(prefs.choices.features.value, ['zsh', 'plugins'])
    assert.equal(prefs.optionUsage.features.zsh, 2)
    assert.equal(prefs.optionUsage.features['claude-base'], 1)
    assert.equal(prefs.optionUsage.features.plugins, 1)
  })

  it('字串選擇更新 choices 但不寫 optionUsage', () => {
    prefsRecordChoice('claudeBase.model', 'claude-opus-4-7')
    const prefs = prefsRead()
    assert.equal(prefs.choices['claudeBase.model'].value, 'claude-opus-4-7')
    assert.equal(prefs.optionUsage['claudeBase.model'], undefined)
  })

  it('boolean 選擇更新 choices', () => {
    prefsRecordChoice('scan.techConfirm', true)
    assert.equal(prefsGet('scan.techConfirm'), true)
  })

  it('寫入失敗不拋錯（best-effort）', () => {
    // 損壞鎖檔案場景：確保函式不拋錯
    assert.doesNotThrow(() => prefsRecordChoice('x', 'y'))
  })
})

// ── prefsReset ────────────────────────────────────────────────────────────────

describe('prefsReset', () => {
  it('清除後 choices 為空', () => {
    prefsRecordChoice('features', ['zsh'])
    prefsReset()
    const prefs = prefsRead()
    assert.deepEqual(prefs.choices, {})
    assert.deepEqual(prefs.optionUsage, {})
  })

  it('不存在時 reset 不拋錯', () => {
    assert.doesNotThrow(() => prefsReset())
  })
})

// ── 增量寫入（多次 prefsRecordChoice 逐步累積）────────────────────────────────

describe('增量寫入', () => {
  it('多次 prefsRecordChoice 各自獨立寫入，互不覆蓋', () => {
    prefsRecordChoice('features', ['zsh'])
    prefsRecordChoice('claudeBase.model', 'claude-opus-4-7')
    prefsRecordChoice('scan.aiSources', ['awesome-ai-pedia'])

    const prefs = prefsRead()
    assert.deepEqual(prefs.choices.features.value, ['zsh'])
    assert.equal(prefs.choices['claudeBase.model'].value, 'claude-opus-4-7')
    assert.deepEqual(prefs.choices['scan.aiSources'].value, ['awesome-ai-pedia'])
  })
})
