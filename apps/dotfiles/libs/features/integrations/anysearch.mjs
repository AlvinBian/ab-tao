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
    if (apiKey && apiKey.startsWith('as_sk_'))
      return { ok: true, message: '🔎 AnySearch 環境就緒' }
    return { ok: true, message: '🔎 AnySearch：尚未設定 API key，稍後將引導填入' }
  },

  async backup(_ctx) {
    return { files: [], dir: '' }
  },

  async configure(ctx) {
    const p = await import('@clack/prompts')
    const { setEnvLocal } = await import('../../core/env.mjs')

    const existing = process.env.ANYSEARCH_API_KEY
    // 已有合法 key → 不打擾，直接通過
    if (existing && existing.startsWith('as_sk_'))
      return { ok: true }

    // 配置引導說明
    p.log.info(
      'AnySearch 需要 API key 才能啟用：\n'
      + '  官網：https://www.anysearch.com/home\n'
      + '  申請 key：https://anysearch.com/console/api-keys\n'
      + '  1. 至上方連結登入後建立 API key（格式 as_sk_...）\n'
      + '  2. key 將寫入本地 apps/dotfiles/.env.local（已 gitignore，不會上傳）\n'
      + '  3. 用途：search / batch_search / extract / list_domains',
    )

    // dryRun：只顯示引導，不互動、不寫檔
    if (ctx?.flags?.dryRun) {
      p.log.warn('dry-run：略過 API key 輸入與寫入')
      return { ok: true }
    }

    const key = await p.text({
      message: '請貼上 AnySearch API key（留空略過，不配置 AnySearch）',
      placeholder: 'as_sk_...（空白 Enter = 略過）',
      validate(v) {
        if (v && v.trim() && !v.trim().startsWith('as_sk_'))
          return '格式不符，應以 as_sk_ 開頭'
      },
    })

    if (p.isCancel(key)) {
      p.log.warn('已取消 AnySearch 設定，略過此 feature')
      return null
    }

    if (!key || !key.trim()) {
      p.log.warn('未填入 API key，略過 AnySearch 配置')
      return null
    }

    setEnvLocal('ANYSEARCH_API_KEY', key.trim())
    p.log.success('API key 已寫入 .env.local')
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

  complete(result) {
    if (!result)
      return []
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
