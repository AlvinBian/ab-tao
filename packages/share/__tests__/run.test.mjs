import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { execInteractive } from '../libs/run.mjs'

/**
 * 測試 @ab-tao/share/libs/run.mjs
 */
describe('execInteractive', () => {
  it('成功執行命令應回傳 true', () => {
    const result = execInteractive('echo hello')
    assert.strictEqual(result, true)
  })

  it('失敗命令應回傳 false（不拋錯）', () => {
    const result = execInteractive('exit 1')
    assert.strictEqual(result, false)
  })

  it('應繼承 process.env（子進程可讀 HOME）', () => {
    // execInteractive 內部使用 env: process.env，確保環境變數不遺失
    const result = execInteractive('test -n "$HOME"')
    assert.strictEqual(result, true, 'HOME 環境變數應被傳遞至子進程')
  })
})
