/**
 * awesome-ai-pedia Feature — AI 知識庫同步
 *
 * 透過 commons sync-sources 機制同步 Awesome-AI-Pedia git repo。
 * 安裝路徑：~/.ab-tao/external/awesome-ai-pedia/
 * 使用方式：awesome-ai-search skill
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const INSTALL_PATH = join(homedir(), '.ab-tao', 'external', 'awesome-ai-pedia')
const REPO_URL = 'https://github.com/qdleader/Awesome-AI-Pedia.git'

function checkGit() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' })
    return true
  }
  catch {
    return false
  }
}

function isInstalled() {
  return existsSync(join(INSTALL_PATH, '.git'))
}

function isStale() {
  if (!isInstalled())
    return false
  try {
    const lastFetch = execFileSync(
      'git',
      ['-C', INSTALL_PATH, 'log', '-1', '--format=%ct', 'FETCH_HEAD'],
      { stdio: 'pipe' },
    )
      .toString()
      .trim()
    if (!lastFetch)
      return true
    const daysSince = (Date.now() / 1000 - Number(lastFetch)) / 86400
    return daysSince > 30
  }
  catch {
    return true
  }
}

export default {
  id: 'awesome-ai-pedia',
  label: '📖 Awesome-AI-Pedia',
  hint: 'AI 知識庫（工具 / 模型 / 提示詞 / Agent）— 按需同步，optional',
  dependsOn: [],
  conflicts: [],

  async envCheck() {
    if (!checkGit()) {
      return {
        ok: false,
        message: 'awesome-ai-pedia 需要 git（brew install git）',
      }
    }

    if (!isInstalled()) {
      return {
        ok: false,
        message: `awesome-ai-pedia 尚未同步；執行 pnpm run c:ai-sync --source awesome-ai-pedia`,
      }
    }

    if (isStale()) {
      return {
        ok: true,
        message:
          '⚠️  awesome-ai-pedia 超過 30 天未更新；建議執行 pnpm run c:ai-sync --source awesome-ai-pedia',
      }
    }

    return { ok: true, message: '📖 awesome-ai-pedia 已同步且為最新' }
  },

  async backup(_ctx) {
    return { files: [], dir: '' }
  },

  async configure() {
    return { ok: true }
  },

  async plan(_ctx, _config) {
    return { actions: [], summary: this.label }
  },

  async confirm(_ctx, _plan) {
    return true
  },

  async install() {
    const { execFile } = await import('node:child_process')
    const { mkdir } = await import('node:fs/promises')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)
    const parentDir = join(homedir(), '.ab-tao', 'external')

    await mkdir(parentDir, { recursive: true })

    if (isInstalled()) {
      // 已存在則 pull 更新
      await execFileAsync('git', ['-C', INSTALL_PATH, 'pull', '--ff-only'], {
        timeout: 60000,
      })
    }
    else {
      // 首次 clone（shallow，只取最新）
      await execFileAsync(
        'git',
        ['clone', '--depth', '1', REPO_URL, INSTALL_PATH],
        { timeout: 120000 },
      )
    }

    const { stateWrite } = await import('../../state/state.mjs')
    stateWrite((s) => {
      s.integrations ??= {}
      s.integrations['awesome-ai-pedia'] = {
        enabled: true,
        installedAt: new Date().toISOString(),
      }
      return s
    })

    return {
      ok: true,
      message: `📖 awesome-ai-pedia 同步完成（${INSTALL_PATH}）`,
    }
  },

  async verify(_ctx, _result) {
    return { passed: 1, total: 1, missing: [] }
  },

  complete(_result) {
    if (!_result)
      return []
    return [
      '✅ awesome-ai-pedia 安裝完成',
      `   路徑：${INSTALL_PATH}`,
      '   → 在 session 中說「搜尋 AI 工具」觸發 awesome-ai-search skill',
      '   → 建議每月執行 pnpm run c:ai-sync --source awesome-ai-pedia 更新',
    ]
  },

  async rollback(_ctx, _backup) {
    return { ok: true }
  },

  async session(_ctx, _result) {
    return {}
  },

  async cleanup(_ctx) {
    return {}
  },

  async report(_ctx, _result) {
    return []
  },
}
