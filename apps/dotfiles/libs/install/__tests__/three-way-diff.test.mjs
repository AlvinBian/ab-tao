import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'vitest'
import {
  DiffType,
  sha256OfFile,
  sha256OfString,
  threeWayDiff,
} from '../three-way-diff.mjs'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-tao-diff-test-'))

describe('three-way-diff.mjs', () => {
  after(() => {
    try {
      fs.rmSync(TMP, { recursive: true })
    }
    catch {}
  })

  const write = (name, content) => {
    const p = path.join(TMP, name)
    fs.writeFileSync(p, content)
    return p
  }

  it('sAME：source == target（無 drift）', () => {
    const src = write('a-src.md', 'hello')
    const tgt = write('a-tgt.md', 'hello')
    const sha = sha256OfFile(src)
    const r = threeWayDiff({
      sourcePath: src,
      targetPath: tgt,
      ancestorSha256: sha,
    })
    assert.equal(r.type, DiffType.SAME)
  })

  it('lOCAL_ONLY_CHANGE：target 修改、source 未動', () => {
    const src = write('b-src.md', 'original')
    const tgt = write('b-tgt.md', 'user-modified')
    const ancestorSha = sha256OfString('original')
    const r = threeWayDiff({
      sourcePath: src,
      targetPath: tgt,
      ancestorSha256: ancestorSha,
    })
    assert.equal(r.type, DiffType.LOCAL_ONLY_CHANGE)
  })

  it('sOURCE_ONLY_CHANGE：source 更新、target 未動', () => {
    const src = write('c-src.md', 'upstream-updated')
    const tgt = write('c-tgt.md', 'original')
    const ancestorSha = sha256OfString('original')
    const r = threeWayDiff({
      sourcePath: src,
      targetPath: tgt,
      ancestorSha256: ancestorSha,
    })
    assert.equal(r.type, DiffType.SOURCE_ONLY_CHANGE)
  })

  it('bOTH_CHANGED：雙方都改（真衝突）', () => {
    const src = write('d-src.md', 'upstream-changed')
    const tgt = write('d-tgt.md', 'user-changed')
    const ancestorSha = sha256OfString('original')
    const r = threeWayDiff({
      sourcePath: src,
      targetPath: tgt,
      ancestorSha256: ancestorSha,
    })
    assert.equal(r.type, DiffType.BOTH_CHANGED)
  })

  it('nEW_FILE：ancestor null（首次安裝）', () => {
    const src = write('e-src.md', 'new')
    const tgt = write('e-tgt.md', 'local')
    const r = threeWayDiff({
      sourcePath: src,
      targetPath: tgt,
      ancestorSha256: null,
    })
    assert.equal(r.type, DiffType.NEW_FILE)
  })

  it('dELETED_LOCAL：target 不存在', () => {
    const src = write('f-src.md', 'content')
    const r = threeWayDiff({
      sourcePath: src,
      targetPath: path.join(TMP, 'ghost.md'),
      ancestorSha256: null,
    })
    assert.equal(r.type, DiffType.DELETED_LOCAL)
  })
})
