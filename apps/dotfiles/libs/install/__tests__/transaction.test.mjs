import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, before, describe, it } from 'node:test'
import {
  _resetForTest,
  beginTransaction,
  commitTransaction,
  isCommitted,
  isTransactionActive,
  removeCreated,
  restoreFromSnapshot,
  rollbackTransaction,
  snapshotTargets,
} from '../transaction.mjs'

// ── 測試工具 ──

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ab-tao-txn-test-'))
}

function buildTargets(base) {
  return [
    { absPath: path.join(base, 'dir-a'), label: 'dir-a', type: 'dir' },
    { absPath: path.join(base, 'file-b.txt'), label: 'file-b.txt', type: 'file' },
    { absPath: path.join(base, 'nonexist-c'), label: 'nonexist-c', type: 'dir' },
  ]
}

let TMP

before(() => {
  TMP = makeTmpDir()
})
afterEach(() => _resetForTest())
after(() => {
  try {
    fs.rmSync(TMP, { recursive: true })
  }
  catch {}
})

// ── 純函式測試 ──

describe('snapshotTargets', () => {
  it('快照目錄與檔案，回傳正確 existed 旗標', () => {
    const base = path.join(TMP, 'snap-1')
    fs.mkdirSync(path.join(base, 'dir-a'), { recursive: true })
    fs.writeFileSync(path.join(base, 'dir-a', 'hello.md'), '# hi')
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'world')

    const targets = buildTargets(base)
    const snapshotDir = path.join(TMP, 'snap-1-snap')
    const manifest = snapshotTargets(targets, snapshotDir)

    assert.equal(manifest.length, 3)
    assert.equal(manifest[0].existed, true)
    assert.equal(manifest[1].existed, true)
    assert.equal(manifest[2].existed, false)

    assert.ok(fs.existsSync(path.join(snapshotDir, 'dir-a', 'hello.md')))
    assert.ok(fs.existsSync(path.join(snapshotDir, 'file-b.txt')))
    assert.ok(!fs.existsSync(path.join(snapshotDir, 'nonexist-c')))
  })

  it('target 不存在時不寫快照、existed=false', () => {
    const base = path.join(TMP, 'snap-2')
    fs.mkdirSync(base, { recursive: true })
    const targets = [{ absPath: path.join(base, 'ghost.txt'), label: 'ghost.txt', type: 'file' }]
    const snapshotDir = path.join(TMP, 'snap-2-snap')
    const manifest = snapshotTargets(targets, snapshotDir)

    assert.equal(manifest[0].existed, false)
    assert.ok(!fs.existsSync(path.join(snapshotDir, 'ghost.txt')))
  })
})

describe('restoreFromSnapshot', () => {
  it('還原已存在條目、移除 install 新增子項', () => {
    const base = path.join(TMP, 'restore-1')
    fs.mkdirSync(path.join(base, 'dir-a'), { recursive: true })
    fs.writeFileSync(path.join(base, 'dir-a', 'orig.md'), 'original')
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'world')

    const targets = buildTargets(base)
    const snapshotDir = path.join(TMP, 'restore-1-snap')
    const manifest = snapshotTargets(targets, snapshotDir)

    // 模擬 install：修改 + 新增檔案
    fs.writeFileSync(path.join(base, 'dir-a', 'orig.md'), 'mutated')
    fs.writeFileSync(path.join(base, 'dir-a', 'new.md'), 'new file')
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'mutated')

    const result = restoreFromSnapshot(manifest, snapshotDir)
    assert.deepEqual(result.failed, [])
    assert.equal(fs.readFileSync(path.join(base, 'dir-a', 'orig.md'), 'utf8'), 'original')
    assert.equal(fs.readFileSync(path.join(base, 'file-b.txt'), 'utf8'), 'world')
    // install 期間新增的 new.md 被清除（wipe + restore）
    assert.ok(!fs.existsSync(path.join(base, 'dir-a', 'new.md')))
  })

  it('跳過 existed:false 條目', () => {
    const base = path.join(TMP, 'restore-2')
    fs.mkdirSync(base, { recursive: true })
    const manifest = [{ absPath: path.join(base, 'ghost'), label: 'ghost', type: 'dir', existed: false }]
    const snapshotDir = path.join(TMP, 'restore-2-snap')
    const result = restoreFromSnapshot(manifest, snapshotDir)
    assert.deepEqual(result.failed, [])
  })

  it('best-effort：單條失敗不影響其餘條目', () => {
    const base = path.join(TMP, 'restore-3')
    fs.mkdirSync(path.join(base, 'dir-a'), { recursive: true })
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'ok')

    const targets = buildTargets(base)
    const snapshotDir = path.join(TMP, 'restore-3-snap')
    const manifest = snapshotTargets(targets, snapshotDir)

    // 破壞 dir-a 的快照讓還原失敗
    fs.rmSync(path.join(snapshotDir, 'dir-a'), { recursive: true })

    const result = restoreFromSnapshot(manifest, snapshotDir)
    assert.equal(result.failed.length, 1)
    assert.ok(result.failed[0].startsWith('dir-a:'))
    // file-b.txt 仍正常還原
    assert.ok(result.success.includes('file-b.txt'))
  })
})

describe('removeCreated', () => {
  it('移除 existed:false 的路徑', () => {
    const base = path.join(TMP, 'remove-1')
    fs.mkdirSync(base, { recursive: true })
    const newFile = path.join(base, 'install-created.md')
    fs.writeFileSync(newFile, 'new')

    const manifest = [
      { absPath: newFile, label: 'install-created.md', type: 'file', existed: false },
    ]
    removeCreated(manifest)
    assert.ok(!fs.existsSync(newFile))
  })

  it('忽略 existed:true 條目', () => {
    const base = path.join(TMP, 'remove-2')
    fs.mkdirSync(base, { recursive: true })
    const file = path.join(base, 'keep.md')
    fs.writeFileSync(file, 'keep')

    const manifest = [{ absPath: file, label: 'keep.md', type: 'file', existed: true }]
    removeCreated(manifest)
    assert.ok(fs.existsSync(file))
  })
})

// ── Phase 2：skipNames + per-file .zshrc.d 測試 ──

describe('snapshotTargets + skipNames（via cpDir）', () => {
  it('快照目錄時跳過 .git 子目錄', () => {
    const base = path.join(TMP, 'skip-1')
    fs.mkdirSync(path.join(base, 'conf'), { recursive: true })
    fs.writeFileSync(path.join(base, 'conf', 'module.zsh'), 'content')
    // 模擬 sheldon/repos/.git/objects 結構
    fs.mkdirSync(path.join(base, '.git', 'objects'), { recursive: true })
    fs.writeFileSync(path.join(base, '.git', 'objects', 'abc123'), 'blob')

    const targets = [{ absPath: base, label: 'skip-test', type: 'dir' }]
    const snapshotDir = path.join(TMP, 'skip-1-snap')
    snapshotTargets(targets, snapshotDir)

    // conf/module.zsh 應被快照
    assert.ok(fs.existsSync(path.join(snapshotDir, 'skip-test', 'conf', 'module.zsh')))
    // .git 整支跳過
    assert.ok(!fs.existsSync(path.join(snapshotDir, 'skip-test', '.git')))
  })

  it('restoreFromSnapshot 還原後不會寫入 .git 目錄', () => {
    const base = path.join(TMP, 'skip-2')
    fs.mkdirSync(path.join(base, 'conf'), { recursive: true })
    fs.writeFileSync(path.join(base, 'conf', 'orig.zsh'), 'orig')
    fs.mkdirSync(path.join(base, '.git', 'objects'), { recursive: true })
    fs.writeFileSync(path.join(base, '.git', 'objects', 'abc'), 'blob')

    const targets = [{ absPath: base, label: 'skip-restore', type: 'dir' }]
    const snapshotDir = path.join(TMP, 'skip-2-snap')
    const manifest = snapshotTargets(targets, snapshotDir)

    // 模擬 install 修改
    fs.writeFileSync(path.join(base, 'conf', 'orig.zsh'), 'mutated')

    const result = restoreFromSnapshot(manifest, snapshotDir)
    assert.deepEqual(result.failed, [])
    assert.equal(fs.readFileSync(path.join(base, 'conf', 'orig.zsh'), 'utf8'), 'orig')
    // .git 在還原後仍不存在於快照（skipNames 保護 restore 路徑也一致）
    assert.ok(!fs.existsSync(path.join(snapshotDir, 'skip-restore', '.git')))
  })
})

describe('per-file .zshrc.d targets snapshot/restore', () => {
  it('conf 子目錄與單獨檔案快照後可還原', () => {
    const base = path.join(TMP, 'zshrc-1')
    // 模擬 ~/.zshrc.d 結構
    fs.mkdirSync(path.join(base, 'conf'), { recursive: true })
    fs.writeFileSync(path.join(base, 'conf', '10-env.zsh'), 'env')
    fs.writeFileSync(path.join(base, '.prefs.zsh'), 'prefs')
    fs.mkdirSync(path.join(base, 'sheldon'), { recursive: true })
    fs.writeFileSync(path.join(base, 'sheldon', 'plugins.toml'), 'toml')
    // repos 目錄模擬 sheldon cache（不應被快照）
    fs.mkdirSync(path.join(base, 'sheldon', 'repos', 'github.com', 'zsh-users', 'zsh-comp', '.git', 'objects'), { recursive: true })
    fs.writeFileSync(path.join(base, 'sheldon', 'repos', 'github.com', 'zsh-users', 'zsh-comp', '.git', 'objects', 'abc'), 'blob')

    const targets = [
      { absPath: path.join(base, 'conf'), label: 'zshrc.d/conf', type: 'dir' },
      { absPath: path.join(base, '.prefs.zsh'), label: 'zshrc.d/.prefs.zsh', type: 'file' },
      { absPath: path.join(base, 'sheldon', 'plugins.toml'), label: 'zshrc.d/sheldon/plugins.toml', type: 'file' },
    ]
    const snapshotDir = path.join(TMP, 'zshrc-1-snap')
    const manifest = snapshotTargets(targets, snapshotDir)

    // 三個條目均 existed:true
    assert.equal(manifest.filter(m => m.existed).length, 3)

    // 模擬 install 修改
    fs.writeFileSync(path.join(base, 'conf', '10-env.zsh'), 'mutated')
    fs.writeFileSync(path.join(base, '.prefs.zsh'), 'mutated')
    fs.writeFileSync(path.join(base, 'sheldon', 'plugins.toml'), 'mutated')

    const result = restoreFromSnapshot(manifest, snapshotDir)
    assert.deepEqual(result.failed, [])
    assert.equal(fs.readFileSync(path.join(base, 'conf', '10-env.zsh'), 'utf8'), 'env')
    assert.equal(fs.readFileSync(path.join(base, '.prefs.zsh'), 'utf8'), 'prefs')
    assert.equal(fs.readFileSync(path.join(base, 'sheldon', 'plugins.toml'), 'utf8'), 'toml')

    // repos 目錄從未被快照，還原後依然存在（sheldon cache 不受觸碰）
    assert.ok(fs.existsSync(path.join(base, 'sheldon', 'repos')))
  })
})

// ── 有狀態包裝測試 ──

describe('beginTransaction / rollbackTransaction / commitTransaction', () => {
  it('begin → rollback 還原快照', () => {
    const base = path.join(TMP, 'state-1')
    fs.mkdirSync(path.join(base, 'dir-a'), { recursive: true })
    fs.writeFileSync(path.join(base, 'dir-a', 'orig.md'), 'orig')
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'b')

    const snapshotDir = path.join(TMP, 'state-1-snap')
    const targets = buildTargets(base)
    beginTransaction({ targets, snapshotDir })
    assert.ok(isTransactionActive())

    // 模擬 install mutation
    fs.writeFileSync(path.join(base, 'dir-a', 'orig.md'), 'mutated')

    rollbackTransaction('test')
    assert.equal(fs.readFileSync(path.join(base, 'dir-a', 'orig.md'), 'utf8'), 'orig')
    assert.ok(!isTransactionActive())
  })

  it('begin 為 idempotent — 第二次呼叫 no-op', () => {
    const base = path.join(TMP, 'state-2')
    fs.mkdirSync(path.join(base, 'dir-a'), { recursive: true })
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'initial')

    const snapshotDir = path.join(TMP, 'state-2-snap')
    const targets = buildTargets(base)
    beginTransaction({ targets, snapshotDir })

    // 改檔後再次呼叫 begin（應 no-op，不重建快照）
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'after-first-begin')
    beginTransaction({ targets, snapshotDir }) // no-op

    rollbackTransaction('idempotent-test')
    // 快照是第一次 begin 時拍的 → 還原 initial
    assert.equal(fs.readFileSync(path.join(base, 'file-b.txt'), 'utf8'), 'initial')
  })

  it('commit → rollback 為 no-op（不還原）', () => {
    const base = path.join(TMP, 'state-3')
    fs.mkdirSync(path.join(base, 'dir-a'), { recursive: true })
    fs.writeFileSync(path.join(base, 'file-b.txt'), 'original')

    const snapshotDir = path.join(TMP, 'state-3-snap')
    const targets = buildTargets(base)
    beginTransaction({ targets, snapshotDir })

    fs.writeFileSync(path.join(base, 'file-b.txt'), 'committed-value')
    commitTransaction()
    assert.ok(isCommitted())

    rollbackTransaction('should-noop')
    // committed 後 rollback 不還原 → 維持 committed-value
    assert.equal(fs.readFileSync(path.join(base, 'file-b.txt'), 'utf8'), 'committed-value')
  })

  it('install 新建（existed:false）的路徑在 rollback 後被移除', () => {
    const base = path.join(TMP, 'state-4')
    fs.mkdirSync(base, { recursive: true })
    // nonexist-c 不存在於 base — targets[2]

    const snapshotDir = path.join(TMP, 'state-4-snap')
    const targets = buildTargets(base)
    beginTransaction({ targets, snapshotDir })

    // 模擬 install 新建 nonexist-c
    fs.mkdirSync(path.join(base, 'nonexist-c'), { recursive: true })
    fs.writeFileSync(path.join(base, 'nonexist-c', 'new.md'), 'new')

    rollbackTransaction('existed-false-test')
    assert.ok(!fs.existsSync(path.join(base, 'nonexist-c')))
  })
})
