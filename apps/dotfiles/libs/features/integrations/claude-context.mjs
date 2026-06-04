/**
 * claude-context Feature — 語義代碼搜尋整合
 *
 * 依賴：LM Studio（port 1234）+ Milvus standalone Docker（port 19530）
 * 安裝指引：docs/local-tools.md § A
 */

import { execFileSync } from 'node:child_process'

function checkMilvus() {
  try {
    // 9091 是 HTTP health check port；19530 是 gRPC API port
    execFileSync('curl', [
      '-sf',
      '--max-time',
      '2',
      'http://127.0.0.1:9091/healthz',
    ])
    return true
  }
  catch {
    return false
  }
}

function checkLmStudio() {
  try {
    execFileSync('curl', [
      '-sf',
      '--max-time',
      '2',
      'http://127.0.0.1:1234/v1/models',
    ])
    return true
  }
  catch {
    return false
  }
}

export default {
  id: 'claude-context',
  label: '🔍 語義代碼搜尋',
  hint: 'LM Studio + Milvus Docker — 需先手動啟動本地服務',
  dependsOn: [],
  conflicts: [],

  async envCheck() {
    const missingEnv = [
      'CLAUDE_CONTEXT_PROVIDER',
      'CLAUDE_CONTEXT_MODEL',
      'CLAUDE_CONTEXT_API_KEY',
      'CLAUDE_CONTEXT_BASE_URL',
      'CLAUDE_CONTEXT_EMBEDDING_DIM',
      'CLAUDE_CONTEXT_MILVUS_ADDRESS',
    ].filter(k => !process.env[k])

    if (missingEnv.length > 0) {
      return {
        ok: false,
        message: `claude-context 缺少環境變數：${missingEnv.join(', ')}（請填入 apps/dotfiles/.env.local，參考 .env.example）`,
      }
    }

    const lmStudioOk = checkLmStudio()
    const milvusOk = checkMilvus()

    if (!lmStudioOk || !milvusOk) {
      const missing = [
        !lmStudioOk && 'LM Studio (port 1234)',
        !milvusOk && 'Milvus (port 9091 health check)',
      ]
        .filter(Boolean)
        .join(', ')
      return {
        ok: false,
        message: `claude-context 本地服務未啟動：${missing}\n  → Milvus：pnpm run c:locals --start\n  → LM Studio：開啟 GUI 並按下 "Start Server"（port 1234）`,
      }
    }

    return { ok: true, message: '🔍 claude-context 環境就緒' }
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

  async install(ctx) {
    const { applyMcpServers } = await import('../../install/mcp-manager.mjs')
    const result = applyMcpServers({ profile: ctx.profile ?? 'personal' })

    if (result.skipped.some(s => s.startsWith('claude-context'))) {
      return {
        ok: false,
        message: 'claude-context MCP server 寫入失敗（env 缺失或服務未啟動）',
      }
    }

    const { stateWrite } = await import('../../state/state.mjs')
    stateWrite((s) => {
      s.integrations ??= {}
      s.integrations['claude-context'] = {
        enabled: true,
        installedAt: new Date().toISOString(),
      }
      return s
    })

    return { ok: true, message: `🔍 claude-context MCP 已寫入 settings.json` }
  },

  async verify(_ctx, _result) {
    return { passed: 1, total: 1, missing: [] }
  },

  complete(_result) {
    if (!_result)
      return []
    return [
      '✅ claude-context 安裝完成',
      '   → 在 session 中說「初始化代碼索引」觸發首次索引（約 1–5 分鐘）',
      '   → skill 不會自動觸發；每次新 repo 第一次需說「初始化代碼索引」',
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
