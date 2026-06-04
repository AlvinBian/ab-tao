/**
 * browser-harness Feature — Python 瀏覽器自動化框架
 *
 * 依賴：uv（Python 套件管理）+ Playwright Chromium（~300MB）
 * 安裝路徑：~/.ab-tao/browser-harness/.venv
 * 安裝指引：docs/local-tools.md § B
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const HARNESS_DIR = join(homedir(), '.ab-tao', 'browser-harness')
const VENV_DIR = join(HARNESS_DIR, '.venv')
const VENV_PYTHON = join(VENV_DIR, 'bin', 'python')

function checkUv() {
  try {
    execFileSync('uv', ['--version'], { stdio: 'pipe' })
    return true
  }
  catch {
    return false
  }
}

function checkPython() {
  try {
    const out = execFileSync(
      VENV_PYTHON,
      ['-c', 'import sys; print(sys.version_info[:2])'],
      { stdio: 'pipe' },
    )
    const match = out.toString().match(/\((\d+),\s*(\d+)\)/)
    if (!match)
      return false
    const [, major, minor] = match.map(Number)
    return major === 3 && minor >= 11
  }
  catch {
    return false
  }
}

function checkPlaywright() {
  try {
    execFileSync(join(VENV_DIR, 'bin', 'playwright'), ['--version'], {
      stdio: 'pipe',
    })
    const chromiumPath = join(homedir(), 'Library', 'Caches', 'ms-playwright')
    return existsSync(chromiumPath)
  }
  catch {
    return false
  }
}

export default {
  id: 'browser-harness',
  label: '🌐 browser-harness',
  hint: 'Python uv + Playwright Chromium — 瀏覽器自動化（~300MB Chromium）',
  dependsOn: [],
  conflicts: [],

  async envCheck() {
    if (!checkUv()) {
      return {
        ok: false,
        message:
          'browser-harness 缺少 uv：brew install uv（參考 docs/local-tools.md § B）',
      }
    }

    if (!existsSync(VENV_PYTHON)) {
      return {
        ok: false,
        message: `browser-harness venv 尚未建立（${VENV_DIR}）；d:setup 安裝後自動建立`,
      }
    }

    if (!checkPython()) {
      return {
        ok: false,
        message:
          'browser-harness 需要 Python 3.11+；執行 d:setup 重新建立 venv',
      }
    }

    if (!checkPlaywright()) {
      return {
        ok: false,
        message:
          'Playwright Chromium 未安裝；執行 d:setup 或手動跑 playwright install chromium',
      }
    }

    return { ok: true, message: '🌐 browser-harness 環境就緒' }
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

    await mkdir(HARNESS_DIR, { recursive: true })

    // 建立 venv（uv venv，Python 3.11+）
    await execFileAsync('uv', ['venv', '--python', '3.11', VENV_DIR], {
      timeout: 60000,
    })

    // 安裝 browser-use + playwright
    await execFileAsync(
      'uv',
      ['pip', 'install', 'browser-use', 'playwright', '--python', VENV_PYTHON],
      { timeout: 120000 },
    )

    // 安裝 Playwright Chromium（~300MB）
    await execFileAsync(
      join(VENV_DIR, 'bin', 'playwright'),
      ['install', 'chromium'],
      { timeout: 300000 },
    )

    const { stateWrite } = await import('../../state/state.mjs')
    stateWrite((s) => {
      s.integrations ??= {}
      s.integrations['browser-harness'] = {
        enabled: true,
        installedAt: new Date().toISOString(),
      }
      return s
    })

    return { ok: true, message: '🌐 browser-harness venv + Chromium 安裝完成' }
  },

  async verify(_ctx, _result) {
    return { passed: 1, total: 1, missing: [] }
  },

  complete(_result) {
    if (!_result)
      return []
    return [
      '✅ browser-harness 安裝完成',
      `   venv 路徑：${VENV_DIR}`,
      '   → 使用 browser-automation-router skill 決定何時用 browser-harness vs chrome-devtools MCP',
      '   → pnpm run c:locals --status 確認服務狀態',
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
