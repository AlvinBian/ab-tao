/**
 * forbidden-dirs-guard.test.mjs — buildSyncPlan 對 FORBIDDEN_DIRS 的防護測試
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'vitest'
import {
  ADDITIVE_DIRS,
  FORBIDDEN_DIRS,
} from '../libs/config/preserve-policy.mjs'
import { buildSyncPlan } from '../libs/install/config-sync.mjs'

/**
 * 建立臨時 template 目錄，包含 forbidden、additive、普通檔案
 */
function createMockTemplate() {
  const templateRoot = mkdtempSync(join(tmpdir(), 'abtao-tpl-'))

  // 普通檔案（應被 create/overwrite）
  writeFileSync(
    join(templateRoot, 'settings.json'),
    JSON.stringify({ model: 'sonnet' }),
  )
  writeFileSync(join(templateRoot, 'CLAUDE.md'), '# test')

  // forbidden 目錄（應被 forbiddenSkip）
  for (const dir of ['projects', 'sessions', 'memory']) {
    mkdirSync(join(templateRoot, dir), { recursive: true })
    writeFileSync(
      join(templateRoot, dir, 'some-file.txt'),
      'forbidden content',
    )
  }

  // additive 目錄（.md 檔有 drift 應為 additiveKeep）
  mkdirSync(join(templateRoot, 'commands'), { recursive: true })
  writeFileSync(
    join(templateRoot, 'commands', 'test-cmd.md'),
    '# test command',
  )

  return templateRoot
}

// ── 測試 ─────────────────────────────────────────────────────────

it('buildSyncPlan：FORBIDDEN_DIRS 內的項目回傳 forbiddenSkip', async () => {
  const templateRoot = createMockTemplate()
  const homeRoot = mkdtempSync(join(tmpdir(), 'abtao-home-'))

  try {
    const policy = {
      additiveDirs: ADDITIVE_DIRS,
      forbiddenDirs: FORBIDDEN_DIRS,
    }

    const plan = await buildSyncPlan(homeRoot, templateRoot, policy)

    // 找出所有 forbiddenSkip 項目
    const forbiddenItems = plan.filter(i => i.action === 'forbiddenSkip')
    const forbiddenRelPaths = forbiddenItems.map(i => i.relPath)

    // 確認 projects/some-file.txt 等被標記為 forbiddenSkip
    const hasForbiddenProjects = forbiddenRelPaths.some(p =>
      p.startsWith('projects'),
    )
    const hasForbiddenSessions = forbiddenRelPaths.some(p =>
      p.startsWith('sessions'),
    )

    assert.ok(hasForbiddenProjects, 'projects/ 下的檔案應為 forbiddenSkip')
    assert.ok(hasForbiddenSessions, 'sessions/ 下的檔案應為 forbiddenSkip')
  }
  finally {
    rmSync(templateRoot, { recursive: true, force: true })
    rmSync(homeRoot, { recursive: true, force: true })
  }
})

it('buildSyncPlan：FORBIDDEN_DIRS 項目不產生 create 或 overwriteFile', async () => {
  const templateRoot = createMockTemplate()
  const homeRoot = mkdtempSync(join(tmpdir(), 'abtao-home-'))

  try {
    const policy = {
      additiveDirs: ADDITIVE_DIRS,
      forbiddenDirs: FORBIDDEN_DIRS,
    }

    const plan = await buildSyncPlan(homeRoot, templateRoot, policy)

    // forbidden 目錄下的路徑不應有 create 或 overwriteFile 動作
    for (const item of plan) {
      const topDir = item.relPath.split('/')[0]
      if (FORBIDDEN_DIRS.includes(topDir)) {
        assert.notEqual(
          item.action,
          'create',
          `forbidden 目錄 "${topDir}" 不應產生 create：${item.relPath}`,
        )
        assert.notEqual(
          item.action,
          'overwriteFile',
          `forbidden 目錄 "${topDir}" 不應產生 overwriteFile：${item.relPath}`,
        )
        assert.notEqual(
          item.action,
          'mergeJson',
          `forbidden 目錄 "${topDir}" 不應產生 mergeJson：${item.relPath}`,
        )
      }
    }
  }
  finally {
    rmSync(templateRoot, { recursive: true, force: true })
    rmSync(homeRoot, { recursive: true, force: true })
  }
})

it('buildSyncPlan：非 forbidden 的普通檔案（home 不存在）應為 create', async () => {
  const templateRoot = createMockTemplate()
  const homeRoot = mkdtempSync(join(tmpdir(), 'abtao-home-'))

  try {
    const policy = {
      additiveDirs: ADDITIVE_DIRS,
      forbiddenDirs: FORBIDDEN_DIRS,
    }

    const plan = await buildSyncPlan(homeRoot, templateRoot, policy)

    // settings.json 在 home 不存在 → 應為 create
    const settingsItem = plan.find(i => i.relPath === 'settings.json')
    assert.ok(settingsItem, 'settings.json 應在計畫中')
    assert.equal(
      settingsItem.action,
      'create',
      'settings.json（home 不存在）應為 create',
    )

    // CLAUDE.md 在 home 不存在 → 應為 create
    const claudeMdItem = plan.find(i => i.relPath === 'CLAUDE.md')
    assert.ok(claudeMdItem, 'CLAUDE.md 應在計畫中')
    assert.equal(
      claudeMdItem.action,
      'create',
      'CLAUDE.md（home 不存在）應為 create',
    )
  }
  finally {
    rmSync(templateRoot, { recursive: true, force: true })
    rmSync(homeRoot, { recursive: true, force: true })
  }
})

it('buildSyncPlan：ADDITIVE_DIRS 中 drift 的檔案為 additiveKeep', async () => {
  const templateRoot = createMockTemplate()
  const homeRoot = mkdtempSync(join(tmpdir(), 'abtao-home-'))

  try {
    // 在 home 的 commands/ 建立一個不同內容的同名檔案（drift）
    mkdirSync(join(homeRoot, 'commands'), { recursive: true })
    writeFileSync(
      join(homeRoot, 'commands', 'test-cmd.md'),
      '# modified by user',
    )

    const policy = {
      additiveDirs: ADDITIVE_DIRS,
      forbiddenDirs: FORBIDDEN_DIRS,
    }

    const plan = await buildSyncPlan(homeRoot, templateRoot, policy)

    // commands/test-cmd.md 有 drift 且在 additive dir → 應為 additiveKeep
    const cmdItem = plan.find(i => i.relPath === 'commands/test-cmd.md')
    assert.ok(cmdItem, 'commands/test-cmd.md 應在計畫中')
    assert.equal(
      cmdItem.action,
      'additiveKeep',
      'additive 目錄中 drift 檔案應為 additiveKeep',
    )
  }
  finally {
    rmSync(templateRoot, { recursive: true, force: true })
    rmSync(homeRoot, { recursive: true, force: true })
  }
})
