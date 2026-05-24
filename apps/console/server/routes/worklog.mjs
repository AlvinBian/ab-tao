import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOTFILES_LIB = path.resolve(__dirname, '../../../dotfiles/libs')

async function getModule() {
  return await import(path.join(DOTFILES_LIB, 'core/worklog.mjs'))
}

export async function worklogRouter(req, res, url, json) {
  if (!url.pathname.startsWith('/api/worklog'))
    return false

  const mod = await getModule()
  const body = req._body ?? {}

  // GET /api/worklog/drafts
  if (req.method === 'GET' && url.pathname === '/api/worklog/drafts') {
    const drafts = mod.readDrafts()
    json(res, 0, 'ok', { drafts, count: drafts.length })
    return true
  }

  // POST /api/worklog/dismiss { ids: string[] }
  if (req.method === 'POST' && url.pathname === '/api/worklog/dismiss') {
    const ids = Array.isArray(body?.ids) ? body.ids : []
    const removed = mod.dismissDrafts(ids)
    json(res, 0, 'ok', { removed })
    return true
  }

  // PATCH /api/worklog/draft { id: string, patch: Partial<WorklogDraft> }
  if (req.method === 'PATCH' && url.pathname === '/api/worklog/draft') {
    const ok = mod.updateDraft(body?.id, body?.patch ?? {})
    json(res, ok ? 0 : 404, ok ? 'ok' : 'not found', { updated: ok })
    return true
  }

  return false
}
