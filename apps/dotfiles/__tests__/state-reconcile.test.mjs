import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

// 依賴注入版本的 verifyManaged，不讀真實 state.json
function verifyManagedFromPath(statePath, claudeBaseDir) {
  let state
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  }
  catch {
    return { ghost: [], driftSha: [], deadIncluded: [], orphans: [] }
  }

  const ghost = []
  const driftSha = []
  const deadIncluded = []
  const orphans = []

  for (const [relPath, entry] of Object.entries(state.managed ?? {})) {
    const fullPath = path.join(claudeBaseDir, relPath)
    if (!fs.existsSync(fullPath)) {
      ghost.push(
        entry.userOverride === true ? `${relPath} [kept-by-user]` : relPath,
      )
    }
    else if (entry.sha256) {
      const actual = createHash('sha256')
        .update(fs.readFileSync(fullPath))
        .digest('hex')
      if (actual !== entry.sha256)
        driftSha.push(relPath)
    }
  }

  const managedKeys = new Set(Object.keys(state.managed ?? {}))
  for (const includedPath of state.sync?.included ?? []) {
    const fullIncludedPath = path.join(claudeBaseDir, includedPath)
    if (!fs.existsSync(fullIncludedPath)) {
      deadIncluded.push(includedPath)
      continue
    }
    let stat
    try {
      stat = fs.statSync(fullIncludedPath)
    }
    catch {
      continue
    }
    if (!stat.isDirectory())
      continue
    let entries
    try {
      entries = fs.readdirSync(fullIncludedPath, { withFileTypes: true })
    }
    catch {
      continue
    }
    for (const dirent of entries) {
      if (!dirent.isFile() || !dirent.name.endsWith('.md'))
        continue
      const fileRelPath = path
        .join(includedPath, dirent.name)
        .replace(/\\/g, '/')
      if (!managedKeys.has(fileRelPath))
        orphans.push(fileRelPath)
    }
  }

  return { ghost, driftSha, deadIncluded, orphans }
}

let tmpDir
let claudeBase
let statePath

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-tao-state-test-'))
  claudeBase = path.join(tmpDir, 'claude')
  statePath = path.join(tmpDir, 'state.json')
  fs.mkdirSync(claudeBase, { recursive: true })
})

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8')
}

function writeFile(relPath, content = '# test\n') {
  const full = path.join(claudeBase, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
  return full
}

function sha256Of(content) {
  return createHash('sha256').update(content).digest('hex')
}

describe('verifyManaged', () => {
  it('ghost detection：managed 但檔案不存在', () => {
    writeState({
      managed: { 'claude-md/00-identity.md': { sha256: 'abc123' } },
      sync: { included: [] },
    })
    const { ghost } = verifyManagedFromPath(statePath, claudeBase)
    assert.equal(ghost.length, 1)
    assert.ok(ghost[0].includes('claude-md/00-identity.md'))
  })

  it('kept-by-user ghost 加標籤', () => {
    writeState({
      managed: { 'claude-md/custom.md': { sha256: 'abc', userOverride: true } },
      sync: { included: [] },
    })
    const { ghost } = verifyManagedFromPath(statePath, claudeBase)
    assert.equal(ghost.length, 1)
    assert.ok(ghost[0].includes('[kept-by-user]'))
  })

  it('sHA drift：檔案存在但 sha 不符', () => {
    const content = '# modified content\n'
    writeFile('rules/ab-vue-nuxt.md', content)
    const wrongSha = '0'.repeat(64)
    writeState({
      managed: { 'rules/ab-vue-nuxt.md': { sha256: wrongSha } },
      sync: { included: [] },
    })
    const { driftSha } = verifyManagedFromPath(statePath, claudeBase)
    assert.equal(driftSha.length, 1)
    assert.ok(driftSha[0].includes('rules/ab-vue-nuxt.md'))
    // 確認 sha 正確時不誤報
    const correctSha = sha256Of(content)
    writeState({
      managed: { 'rules/ab-vue-nuxt.md': { sha256: correctSha } },
      sync: { included: [] },
    })
    const { driftSha: driftSha2 } = verifyManagedFromPath(
      statePath,
      claudeBase,
    )
    assert.equal(driftSha2.length, 0)
  })

  it('deadIncluded：sync.included 路徑不存在', () => {
    writeState({
      managed: {},
      sync: { included: ['memory/preferences/', 'memory/nonexistent/'] },
    })
    const { deadIncluded } = verifyManagedFromPath(statePath, claudeBase)
    assert.ok(deadIncluded.includes('memory/preferences/'))
    assert.ok(deadIncluded.includes('memory/nonexistent/'))
  })

  it('無問題時各陣列均為空', () => {
    const content = '# identity\n'
    writeFile('claude-md/00-identity.md', content)
    const sha = sha256Of(content)
    writeState({
      managed: { 'claude-md/00-identity.md': { sha256: sha } },
      sync: { included: [] },
    })
    const result = verifyManagedFromPath(statePath, claudeBase)
    assert.equal(result.ghost.length, 0)
    assert.equal(result.driftSha.length, 0)
    assert.equal(result.deadIncluded.length, 0)
  })
})
