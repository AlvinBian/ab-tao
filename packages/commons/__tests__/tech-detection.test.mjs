import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { detectTechStack } from '../scripts/tech-detection.mjs'

describe('detectTechStack', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-detect-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('應從 package.json 偵測 JavaScript', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      '{"name":"test"}',
      'utf8',
    )
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.ok(result.technologies.some(t => t.name === 'javascript'))
  })

  it('應從 tsconfig.json 偵測 TypeScript', async () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8')
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.ok(result.technologies.some(t => t.name === 'typescript'))
  })

  it('應從 package.json 依賴偵測 React', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      'utf8',
    )
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.ok(result.technologies.some(t => t.name === 'react'))
  })

  it('應從 requirements.txt 偵測 Python', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'requirements.txt'),
      'flask==2.0',
      'utf8',
    )
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.ok(result.technologies.some(t => t.name === 'python'))
  })

  it('應從 go.mod 偵測 Go', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'go.mod'),
      'module example.com/app',
      'utf8',
    )
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.ok(result.technologies.some(t => t.name === 'go'))
  })

  it('應從 Cargo.toml 偵測 Rust', async () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]', 'utf8')
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.ok(result.technologies.some(t => t.name === 'rust'))
  })

  it('應從 devDependencies 偵測測試框架', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
      'utf8',
    )
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.ok(result.technologies.some(t => t.name === 'testing'))
  })

  it('應按信心度由高到低排序', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18', typescript: '^5' } }),
      'utf8',
    )
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8')
    const result = await detectTechStack({ localPaths: [tmpDir] })
    for (let i = 1; i < result.technologies.length; i++) {
      assert.ok(
        result.technologies[i - 1].confidence
        >= result.technologies[i].confidence,
      )
    }
  })

  it('無技術特徵的目錄應回傳空陣列', async () => {
    const result = await detectTechStack({ localPaths: [tmpDir] })
    assert.equal(result.technologies.length, 0)
  })
})
