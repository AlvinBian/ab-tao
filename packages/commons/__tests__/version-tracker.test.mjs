import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VERSIONS_PATH = path.resolve(__dirname, '../.versions.json')

let originalContent

beforeEach(() => {
  originalContent = fs.readFileSync(VERSIONS_PATH, 'utf8')
})

afterEach(() => {
  fs.writeFileSync(VERSIONS_PATH, originalContent)
})

// 動態載入以取得全新模組狀態
async function loadTracker() {
  const timestamp = Date.now()
  return import(`../scripts/version-tracker.mjs?t=${timestamp}`)
}

describe('version-tracker', () => {
  it('應讀取現有版本', async () => {
    const { readVersions } = await loadTracker()
    const versions = readVersions()
    assert.ok(versions.ecc)
    assert.ok(versions.anthropic)
    assert.equal(versions.ecc.locked, false)
  })

  it('應記錄同步的 SHA 與日期', async () => {
    const { recordSync, readVersions } = await loadTracker()
    const sha = 'abc123def456'
    const result = recordSync('ecc', sha)
    assert.equal(result, true)

    const versions = readVersions()
    assert.equal(versions.ecc.sha, sha)
    assert.ok(versions.ecc.date)
  })

  it('不應更新已鎖定的來源', async () => {
    const { lockSource, recordSync, readVersions } = await loadTracker()
    lockSource('ecc')
    const result = recordSync('ecc', 'new-sha')
    assert.equal(result, false)

    const versions = readVersions()
    assert.notEqual(versions.ecc.sha, 'new-sha')
  })

  it('未知來源應自動建立條目（支援新來源動態加入）', async () => {
    const { recordSync, readVersions } = await loadTracker()
    const result = recordSync('unknown-source', 'new-sha')
    assert.equal(result, true)
    const versions = readVersions()
    assert.equal(versions['unknown-source'].sha, 'new-sha')
  })

  it('應偵測是否需要同步', async () => {
    const { needsSync, recordSync } = await loadTracker()

    // 空 SHA → 需要同步
    assert.equal(needsSync('ecc', 'remote-sha'), true)

    // 記錄後 → 相同 SHA 不需同步
    recordSync('ecc', 'remote-sha')
    assert.equal(needsSync('ecc', 'remote-sha'), false)

    // 不同 SHA → 需要同步
    assert.equal(needsSync('ecc', 'different-sha'), true)
  })

  it('應能鎖定與解鎖來源', async () => {
    const { lockSource, unlockSource, needsSync, readVersions }
      = await loadTracker()

    lockSource('ecc')
    assert.equal(readVersions().ecc.locked, true)
    assert.equal(needsSync('ecc', 'any-sha'), false)

    unlockSource('ecc')
    assert.equal(readVersions().ecc.locked, false)
  })
})
