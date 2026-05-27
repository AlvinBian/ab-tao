/**
 * prompts.mjs wrapper 層單元測試
 *
 * 執行：node --test __tests__/prompts-wrappers.test.mjs
 *
 * 覆蓋重點：
 *   1. happy path — 有效選擇後正確寫回 prefs
 *   2. BACK Symbol — 不寫回 prefs，原樣透傳
 *   3. typeof 守門（selectWithPrefs）— array/object prev → initialValue 為 undefined，不 crash
 *   4. 型別寬容（selectWithPrefs）— string / number prev 正確傳遞
 *
 * 注意：p.isCancel（ESC 取消）路徑需整合測試驗證（clack cancel symbol 非公開 export）。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line test/no-import-node-test
import { after, beforeEach, describe, it } from 'node:test'

// ── 測試隔離：tmpDir → AB_TAO_PREFS_PATH ─────────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-tao-wrappers-test-'))
const PREFS_PATH = path.join(tmpDir, 'preferences.json')
const LOCK_PATH = path.join(tmpDir, 'preferences.lock')

process.env.AB_TAO_PREFS_PATH = PREFS_PATH
process.env.AB_TAO_PREFS_LOCK = LOCK_PATH

const {
  BACK,
  multiselectWithPrefs,
  selectWithPrefs,
  textWithPrefs,
  confirmWithPrefs,
} = await import('../libs/cli/prompts.mjs')

const {
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
}

beforeEach(() => {
  clearFiles()
  prefsReset()
})

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ── multiselectWithPrefs ──────────────────────────────────────────────────────

describe('multiselectWithPrefs', () => {
  it('有效選擇寫回 prefs', async () => {
    const items = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]
    const result = await multiselectWithPrefs(
      'test.multi',
      items,
      () => Promise.resolve(['a', 'b']),
    )
    assert.deepEqual(result, ['a', 'b'])
    assert.deepEqual(prefsGet('test.multi'), ['a', 'b'])
  })

  it('BACK 不寫回 prefs', async () => {
    const items = [{ value: 'a', label: 'A' }]
    const result = await multiselectWithPrefs(
      'test.multi.back',
      items,
      () => Promise.resolve(BACK),
    )
    assert.equal(result, BACK)
    assert.equal(prefsGet('test.multi.back'), undefined)
  })

  it('上次選擇排前（applyPreviousSelection）', async () => {
    prefsRecordChoice('test.sort', ['b'])
    const items = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]
    let capturedOpts
    await multiselectWithPrefs(
      'test.sort',
      items,
      ({ options }) => {
        capturedOpts = options
        return Promise.resolve(['b'])
      },
    )
    assert.equal(capturedOpts[0].value, 'b', '上次選中的選項應排到最前')
  })

  it('prev 非陣列時 initialValues 為空（不 crash）', async () => {
    prefsRecordChoice('test.multi.bad', 'not-an-array')
    const items = [{ value: 'x', label: 'X' }]
    let capturedInitials
    await multiselectWithPrefs(
      'test.multi.bad',
      items,
      ({ initialValues }) => {
        capturedInitials = initialValues
        return Promise.resolve([])
      },
    )
    assert.deepEqual(capturedInitials, [])
  })
})

// ── selectWithPrefs ───────────────────────────────────────────────────────────

describe('selectWithPrefs', () => {
  it('有效選擇寫回 prefs', async () => {
    const result = await selectWithPrefs(
      'test.select',
      () => Promise.resolve('option-a'),
    )
    assert.equal(result, 'option-a')
    assert.equal(prefsGet('test.select'), 'option-a')
  })

  it('BACK 不寫回 prefs', async () => {
    const result = await selectWithPrefs(
      'test.select.back',
      () => Promise.resolve(BACK),
    )
    assert.equal(result, BACK)
    assert.equal(prefsGet('test.select.back'), undefined)
  })

  it('prev 為 string → 正確傳遞 initialValue', async () => {
    prefsRecordChoice('test.select.str', 'prev-val')
    let captured
    await selectWithPrefs('test.select.str', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve('new-val')
    })
    assert.equal(captured, 'prev-val')
  })

  it('prev 為 number → 正確傳遞 initialValue', async () => {
    prefsRecordChoice('test.select.num', 5)
    let captured
    await selectWithPrefs('test.select.num', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve(10)
    })
    assert.equal(captured, 5)
  })

  it('prev 為 array → initialValue 為 undefined（型別守門）', async () => {
    prefsRecordChoice('test.select.arr', ['a', 'b'])
    let captured
    await selectWithPrefs('test.select.arr', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve('a')
    })
    assert.equal(captured, undefined, 'array prev 應被擋住，不傳給 clack')
  })

  it('prev 為 object → initialValue 為 undefined（型別守門）', async () => {
    // 直接寫入非預期型別
    const { prefsPatch } = await import('../libs/core/preferences-store.mjs')
    prefsPatch((draft) => {
      draft.choices['test.select.obj'] = { value: { nested: true }, pickedAt: '...' }
      return draft
    })
    let captured
    await selectWithPrefs('test.select.obj', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve('fallback')
    })
    assert.equal(captured, undefined, 'object prev 應被擋住，不傳給 clack')
  })

  it('prev 不存在 → initialValue 為 undefined', async () => {
    let captured
    await selectWithPrefs('test.select.none', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve('first-pick')
    })
    assert.equal(captured, undefined)
  })
})

// ── textWithPrefs ─────────────────────────────────────────────────────────────

describe('textWithPrefs', () => {
  it('有效輸入寫回 prefs', async () => {
    const result = await textWithPrefs(
      'test.text',
      () => Promise.resolve('my-channel'),
    )
    assert.equal(result, 'my-channel')
    assert.equal(prefsGet('test.text'), 'my-channel')
  })

  it('BACK 不寫回 prefs', async () => {
    const result = await textWithPrefs(
      'test.text.back',
      () => Promise.resolve(BACK),
    )
    assert.equal(result, BACK)
    assert.equal(prefsGet('test.text.back'), undefined)
  })

  it('prev 為 string → 正確傳遞 initialValue', async () => {
    prefsRecordChoice('test.text.prev', 'C07XXXXXX')
    let captured
    await textWithPrefs('test.text.prev', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve('C07XXXXXX')
    })
    assert.equal(captured, 'C07XXXXXX')
  })

  it('prev 為非 string → initialValue 為 undefined（型別守門）', async () => {
    prefsRecordChoice('test.text.bad', ['array'])
    let captured
    await textWithPrefs('test.text.bad', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve('safe-input')
    })
    assert.equal(captured, undefined)
  })
})

// ── confirmWithPrefs ──────────────────────────────────────────────────────────

describe('confirmWithPrefs', () => {
  it('有效 boolean 寫回 prefs', async () => {
    const result = await confirmWithPrefs(
      'test.confirm',
      () => Promise.resolve(true),
    )
    assert.equal(result, true)
    assert.equal(prefsGet('test.confirm'), true)
  })

  it('BACK 不寫回 prefs', async () => {
    const result = await confirmWithPrefs(
      'test.confirm.back',
      () => Promise.resolve(BACK),
    )
    assert.equal(result, BACK)
    assert.equal(prefsGet('test.confirm.back'), undefined)
  })

  it('prev 為 boolean → 正確傳遞 initialValue', async () => {
    prefsRecordChoice('test.confirm.prev', false)
    let captured
    await confirmWithPrefs('test.confirm.prev', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve(true)
    })
    assert.equal(captured, false)
  })

  it('prev 為非 boolean → initialValue 為 undefined（型別守門）', async () => {
    prefsRecordChoice('test.confirm.bad', 'yes')
    let captured
    await confirmWithPrefs('test.confirm.bad', ({ initialValue }) => {
      captured = initialValue
      return Promise.resolve(true)
    })
    assert.equal(captured, undefined)
  })
})
