/**
 * anysearch Feature — Web 搜尋 + 垂直領域搜尋整合
 *
 * 依賴：ANYSEARCH_API_KEY 環境變數（格式 as_sk_...）
 * MCP 類型：HTTP remote（type: http）— 不需本地進程
 */

import fs from 'node:fs'
import { P } from '../../core/paths.mjs'

export default {
  id: 'anysearch',
  label: '🔎 AnySearch',
  hint: 'Web 搜尋 + 垂直領域搜尋（finance / travel / academic…）— 需設定 API key',
  dependsOn: [],
  conflicts: [],

  async envCheck() {
    const apiKey = process.env.ANYSEARCH_API_KEY
    if (!apiKey) {
      return {
        ok: false,
        message: 'AnySearch 缺少環境變數 ANYSEARCH_API_KEY（格式：as_sk_...）',
      }
    }
    if (!apiKey.startsWith('as_sk_')) {
      return {
        ok: false,
        message: `ANYSEARCH_API_KEY 格式不符（應以 as_sk_ 開頭，目前：${apiKey.slice(0, 10)}...）`,
      }
    }
    return { ok: true, message: '🔎 AnySearch 環境就緒' }
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

    if (result.skipped.some(s => s.startsWith('anysearch'))) {
      return {
        ok: false,
        message: 'AnySearch MCP server 寫入失敗（API key 缺失）',
      }
    }

    const { stateWrite } = await import('../../state/state.mjs')
    stateWrite((s) => {
      s.integrations ??= {}
      s.integrations.anysearch = {
        enabled: true,
        installedAt: new Date().toISOString(),
      }
      return s
    })

    return { ok: true, message: '🔎 AnySearch MCP 已寫入 settings.json' }
  },

  async verify(_ctx, _result) {
    try {
      const raw = fs.readFileSync(P.settings, 'utf8')
      const settings = JSON.parse(raw)
      const installed = 'anysearch' in (settings.mcpServers ?? {})
      return {
        passed: installed ? 1 : 0,
        total: 1,
        missing: installed ? [] : ['anysearch 未在 mcpServers 中'],
      }
    }
    catch {
      return { passed: 0, total: 1, missing: ['無法讀取 settings.json'] }
    }
  },

  complete(_result) {
    return [
      '✅ AnySearch 安裝完成',
      '   工具清單：',
      '   → search          — 單筆 Web 搜尋',
      '   → batch_search    — 批次多關鍵字搜尋',
      '   → extract         — 擷取指定 URL 內容',
      '   → list_domains    — 列出垂直領域（finance / travel / academic…）',
      '   ⚠️  需重啟 Claude Code 才能載入新 MCP server',
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
