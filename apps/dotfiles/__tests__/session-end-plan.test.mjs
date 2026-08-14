import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

const HOOK_SCRIPT = path.resolve(
  new URL('..', import.meta.url).pathname,
  'claude/hooks/session-end.sh',
)

let tmpDir

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-tao-session-end-test-'))
})

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function runHook(cwd, home) {
  const input = JSON.stringify({ cwd, message: 'test' })
  execFileSync('/bin/bash', [HOOK_SCRIPT], {
    input,
    env: { ...process.env, HOME: home },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function setupEnv(testName) {
  const home = path.join(tmpDir, testName)
  const plansDir = path.join(home, '.claude', 'plans')
  const projectsDir = path.join(home, '.claude', 'projects')
  fs.mkdirSync(plansDir, { recursive: true })
  fs.mkdirSync(projectsDir, { recursive: true })
  return { home, plansDir, projectsDir }
}

function writePlan(plansDir, slug, content) {
  const fp = path.join(plansDir, slug)
  fs.writeFileSync(fp, content, 'utf8')
  return fp
}

function encodedPath(cwd) {
  return cwd.replace(/\//g, '-')
}

describe('session-end.sh plan 歸位', () => {
  it('ticket+topic frontmatter → {ticket}-{topic}.md', () => {
    const { home, plansDir, projectsDir } = setupEnv('test-ticket-topic')
    const cwd = '/Users/test/project'
    writePlan(
      plansDir,
      'random-slug-abc.md',
      '---\nticket: VM-9999\ntopic: demo-feature\nstatus: draft\n---\n\n# 計畫內容\n',
    )

    runHook(cwd, home)

    const encoded = encodedPath(cwd)
    const targetDir = path.join(projectsDir, encoded, 'plans')
    assert.ok(
      fs.existsSync(path.join(targetDir, 'VM-9999-demo-feature.md')),
      '應生成 VM-9999-demo-feature.md',
    )
    assert.ok(
      !fs.existsSync(path.join(plansDir, 'random-slug-abc.md')),
      '原始 slug 應移除',
    )
  })

  it('只有 topic → {topic}.md', () => {
    const { home, plansDir, projectsDir } = setupEnv('test-topic-only')
    const cwd = '/Users/test/project'
    writePlan(
      plansDir,
      'some-random-slug.md',
      '---\ntopic: refactor-auth\n---\n\n# Auth 重構\n',
    )

    runHook(cwd, home)

    const encoded = encodedPath(cwd)
    const targetDir = path.join(projectsDir, encoded, 'plans')
    assert.ok(
      fs.existsSync(path.join(targetDir, 'refactor-auth.md')),
      '應生成 refactor-auth.md',
    )
  })

  it('無 frontmatter → 保留原 slug（不加 timestamp）', () => {
    const { home, plansDir, projectsDir } = setupEnv('test-no-frontmatter')
    const cwd = '/Users/test/project'
    const originalSlug = 'image-5-repos-shiny-conway.md'
    writePlan(plansDir, originalSlug, '# 無 frontmatter 計畫\n\n一些內容\n')

    runHook(cwd, home)

    const encoded = encodedPath(cwd)
    const targetDir = path.join(projectsDir, encoded, 'plans')
    assert.ok(
      fs.existsSync(path.join(targetDir, originalSlug)),
      '應保留原始 slug',
    )
  })

  it('衝突 slug → append -2', () => {
    const { home, plansDir, projectsDir } = setupEnv('test-collision')
    const cwd = '/Users/test/project'
    const encoded = encodedPath(cwd)
    const targetDir = path.join(projectsDir, encoded, 'plans')
    fs.mkdirSync(targetDir, { recursive: true })

    // 預先建立同名目標檔案
    fs.writeFileSync(path.join(targetDir, 'VM-1234-feature.md'), '# 已存在\n')
    writePlan(
      plansDir,
      'another-slug.md',
      '---\nticket: VM-1234\ntopic: feature\n---\n\n# 新計畫\n',
    )

    runHook(cwd, home)

    assert.ok(
      fs.existsSync(path.join(targetDir, 'VM-1234-feature-2.md')),
      '衝突時應生成 -2 後綴',
    )
  })

  it('index.md：已有 sentinel 時只 append，不重建', () => {
    const { home, plansDir, projectsDir } = setupEnv('test-index-append')
    const cwd = '/Users/test/project'
    const encoded = encodedPath(cwd)
    const targetDir = path.join(projectsDir, encoded, 'plans')
    fs.mkdirSync(targetDir, { recursive: true })

    // 預先建立含手寫內容的 index.md
    const existingIndex = [
      '# Plans',
      '',
      '## Tier 1（緊急）',
      '- [重要計畫](important.md)',
      '',
      '<!-- auto-appended below -->',
    ].join('\n')
    fs.writeFileSync(path.join(targetDir, 'index.md'), existingIndex)

    writePlan(plansDir, 'new-plan.md', '---\ntopic: new-plan\n---\n# 新計畫\n')
    runHook(cwd, home)

    const indexContent = fs.readFileSync(
      path.join(targetDir, 'index.md'),
      'utf8',
    )
    assert.ok(indexContent.includes('重要計畫'), '手寫 Tier 1 應保留')
    assert.ok(indexContent.includes('new-plan.md'), '新計畫應 append')
  })
})
