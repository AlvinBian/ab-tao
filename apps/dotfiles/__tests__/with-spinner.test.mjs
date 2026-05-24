import assert from 'node:assert/strict'
import { it } from 'vitest'

// 注意：@clack/prompts 的 spinner 在非 TTY 環境下可能行為不同
// 直接測試 logic，mock spinner

it('withSpinner: CI 模式靜默執行', async () => {
  const orig = process.env.CI
  process.env.CI = '1'

  // 動態 import 讓 CI env 生效
  const { withSpinner } = await import('../libs/ui/with-spinner.mjs')

  let callbackCalled = false
  const result = await withSpinner('測試', async (update) => {
    update('進度更新') // 不應拋出
    callbackCalled = true
    return 'success'
  })

  assert.equal(result, 'success')
  assert.equal(callbackCalled, true)

  if (orig === undefined)
    delete process.env.CI
  else process.env.CI = orig
})

it('withSpinner: 錯誤時正確拋出', async () => {
  process.env.CI = '1'
  const { withSpinner } = await import('../libs/ui/with-spinner.mjs')

  await assert.rejects(
    async () =>
      withSpinner('失敗測試', async () => {
        throw new Error('test error')
      }),
    { message: 'test error' },
  )
  process.env.CI = ''
})

it('humanBytes: 格式化正確', async () => {
  const { humanBytes } = await import('../libs/ui/with-spinner.mjs')
  assert.equal(humanBytes(500), '500 B')
  assert.equal(humanBytes(2048), '2.0 KB')
  assert.equal(humanBytes(1024 * 1024 * 1.5), '1.5 MB')
})

it('withProgressSpinner: CI 模式按序執行', async () => {
  process.env.CI = '1'
  const { withProgressSpinner } = await import('../libs/ui/with-spinner.mjs')

  const items = [1, 2, 3]
  const processed = []
  const result = await withProgressSpinner('批次處理', items, async (item) => {
    processed.push(item)
    return item * 2
  })

  assert.deepEqual(processed, [1, 2, 3])
  assert.deepEqual(result, [2, 4, 6])
  process.env.CI = ''
})
