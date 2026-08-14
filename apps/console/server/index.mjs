/**
 * ab-tao Console API Server
 *
 * 基於 Node 18+ 內建 node:http，零外部依賴（除 dotfiles libs）。
 * 端口：5478（避開 3000 / 5173 / 8080）
 * 格式：統一 { code, message, data }
 */

import { createServer } from 'node:http'
import { URL } from 'node:url'
// assertTrustedOrigin 已就緒，供 A3 新增 mutation endpoint 時使用
// import { assertTrustedOrigin } from "./utils/security.mjs";
import { aiUsageRouter } from './routes/ai-usage.mjs'
import { chromeRouter } from './routes/chrome.mjs'
import { hooksRouter } from './routes/hooks.mjs'
import { mcpRouter } from './routes/mcp.mjs'
import { reposRouter } from './routes/repos.mjs'
import { resourcesRouter } from './routes/resources.mjs'
import { restoreRouter } from './routes/restore.mjs'
import { scanRouter } from './routes/scan.mjs'
import { settingsRouter } from './routes/settings.mjs'
import { setupRouter } from './routes/setup.mjs'
import { sseFailurePatternsRouter } from './routes/sse-failure-patterns.mjs'
import { sseInstallProgressRouter } from './routes/sse-install-progress.mjs'
import { sseMetricsRouter } from './routes/sse-metrics.mjs'
import { statusRouter } from './routes/status.mjs'
import { worklogRouter } from './routes/worklog.mjs'

const PORT = Number(process.env.PORT) || 5478

/** 解析 request body（JSON） */
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      }
      catch {
        resolve({})
      }
    })
  })
}

/** 統一回應輔助 */
function json(res, code, message, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ code, message, data }))
}

const server = createServer(async (req, res) => {
  // CORS — 允許所有 localhost 來源（端口動態分配）
  const origin = req.headers.origin ?? ''
  if (/^http:\/\/localhost:\d+$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS',
  )
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  req._parsedUrl = url
  req._body = await parseBody(req)

  try {
    // /api/health — 健康檢查
    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 0, 'ok', { status: 'healthy', version: '0.1.0' })
      return
    }

    // /api/status/ai-usage — AI 使用統計
    if (await aiUsageRouter(req, res, url, json))
      return

    // /api/status/* — 狀態資料
    if (url.pathname.startsWith('/api/status')) {
      const handled = await statusRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/resources/* — 資源管理（CRUD）
    if (url.pathname.startsWith('/api/resources')) {
      const handled = await resourcesRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/settings/* + /api/preferences — 設定管理
    if (
      url.pathname.startsWith('/api/settings')
      || url.pathname.startsWith('/api/preferences')
    ) {
      const handled = await settingsRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/setup/* — d:setup 安裝精靈
    if (url.pathname.startsWith('/api/setup')) {
      const handled = await setupRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/scan/* — d:scan 技術棧掃描
    if (url.pathname.startsWith('/api/scan')) {
      const handled = await scanRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/restore/* — 備份還原
    if (url.pathname.startsWith('/api/restore')) {
      const handled = await restoreRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/hooks/* — Hook 重新部署
    if (url.pathname.startsWith('/api/hooks')) {
      const handled = await hooksRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/chrome/* — Chrome 優化
    if (url.pathname.startsWith('/api/chrome')) {
      const handled = await chromeRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/mcp/* — MCP Servers / Plugins / Marketplace
    if (url.pathname.startsWith('/api/mcp')) {
      const handled = await mcpRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/repos/* — Repo 清單與掃描
    if (url.pathname.startsWith('/api/repos')) {
      const handled = await reposRouter(req, res, url, json)
      if (handled)
        return
    }

    // /api/worklog/* — Worklog 草稿管理
    if (await worklogRouter(req, res, url, json))
      return

    // /api/sse/* — SSE 串流端點
    if (url.pathname.startsWith('/api/sse')) {
      if (await sseMetricsRouter(req, res, url))
        return
      if (await sseFailurePatternsRouter(req, res, url))
        return
      if (await sseInstallProgressRouter(req, res, url))
        return
    }

    // 未匹配路由
    json(res, 404, 'Not Found', null, 404)
  }
  catch (err) {
    console.error('[API Error]', err)
    json(
      res,
      500,
      err instanceof Error ? err.message : 'Internal Server Error',
      null,
      500,
    )
  }
})

server.listen(PORT, () => {
  console.log(`✓ ab-tao Console API  →  http://localhost:${PORT}`)
})
