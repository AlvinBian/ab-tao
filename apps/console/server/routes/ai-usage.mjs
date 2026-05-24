/**
 * ai-usage.mjs — /api/status/ai-usage 路由
 *
 * 讀取 ~/.claude/projects/**\/<uuid>.jsonl，aggregate assistant 訊息的 token 用量。
 * 支援 range 參數：7d | 30d | all（預設 7d）
 */
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOTFILES_LIB = path.resolve(__dirname, '../../../dotfiles/libs')

const MAX_FILES = 200
const MAX_LINES_PER_FILE = 20_000
const UUID_RE
  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i

async function getP() {
  const { P } = await import(path.join(DOTFILES_LIB, 'core/paths.mjs'))
  return P
}

function rangeCutoff(range) {
  if (range === 'all')
    return 0
  const map = { '7d': 7, '30d': 30 }
  const days = map[range] ?? 7
  return Date.now() - days * 86400000
}

/** 收集所有 session JSONL 路徑（各專案目錄下的 uuid.jsonl），按 mtime DESC 排序 */
function collectSessionFiles(projectsDir, cutoffMs) {
  const files = []
  let projectDirs
  try {
    projectDirs = readdirSync(projectsDir, { withFileTypes: true })
  }
  catch {
    return files
  }

  for (const projEnt of projectDirs) {
    if (!projEnt.isDirectory())
      continue
    const projPath = path.join(projectsDir, projEnt.name)
    let entries
    try {
      entries = readdirSync(projPath, { withFileTypes: true })
    }
    catch {
      continue
    }
    for (const ent of entries) {
      if (!ent.isFile() || !UUID_RE.test(ent.name))
        continue
      const filePath = path.join(projPath, ent.name)
      let mtime = 0
      try {
        mtime = statSync(filePath).mtimeMs
      }
      catch {
        continue
      }
      // 跳過整個檔案（mtime 早於 cutoff 且 range 非 all）
      if (cutoffMs > 0 && mtime < cutoffMs)
        continue
      files.push({ filePath, mtime })
    }
  }

  files.sort((a, b) => b.mtime - a.mtime)
  return files.slice(0, MAX_FILES)
}

/** 讀取單個 JSONL 檔，提取 assistant 訊息的 usage 資料 */
async function extractUsageFromFile(filePath, cutoffMs) {
  const results = []
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  let lineCount = 0
  for await (const line of rl) {
    if (++lineCount > MAX_LINES_PER_FILE)
      break
    if (!line.trim())
      continue
    let obj
    try {
      obj = JSON.parse(line)
    }
    catch {
      continue
    }
    if (obj.type !== 'assistant' || !obj.message?.usage || !obj.timestamp)
      continue
    // 排除 synthetic / 工具回應假模型
    if (!obj.message.model || obj.message.model.startsWith('<'))
      continue
    const ts = new Date(obj.timestamp).getTime()
    if (Number.isNaN(ts) || (cutoffMs > 0 && ts < cutoffMs))
      continue
    const { model } = obj.message
    const u = obj.message.usage
    results.push({
      day: obj.timestamp.slice(0, 10),
      model: model ?? 'unknown',
      inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
    })
  }
  return results
}

export async function aiUsageRouter(req, res, url, json) {
  if (req.method !== 'GET' || url.pathname !== '/api/status/ai-usage')
    return false

  const range = url.searchParams.get('range') ?? '7d'
  const cutoffMs = rangeCutoff(range)

  let P
  try {
    P = await getP()
  }
  catch {
    json(res, 500, '無法載入路徑配置', null, 500)
    return true
  }

  if (!existsSync(P.projects)) {
    json(res, 0, 'ok', {
      byDay: [],
      byModel: [],
      allModels: [],
      meta: { source: 'absent', range, fileCount: 0, totalRequests: 0 },
    })
    return true
  }

  const sessionFiles = collectSessionFiles(P.projects, cutoffMs)

  // 讀取所有檔案（sequential — 避免大量並行 I/O）
  const allUsage = []
  for (const { filePath } of sessionFiles) {
    try {
      const entries = await extractUsageFromFile(filePath, cutoffMs)
      allUsage.push(...entries)
    }
    catch {
      // 損壞的 JSONL 直接跳過
    }
  }

  // aggregate by day + model
  /** @type {Record<string, Record<string, {inputTokens:number,outputTokens:number,cacheReadTokens:number,requests:number}>>} */
  const dayModelMap = {}
  const modelTotals = {}

  for (const entry of allUsage) {
    if (!dayModelMap[entry.day])
      dayModelMap[entry.day] = {}
    if (!dayModelMap[entry.day][entry.model]) {
      dayModelMap[entry.day][entry.model] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        requests: 0,
      }
    }
    const slot = dayModelMap[entry.day][entry.model]
    slot.inputTokens += entry.inputTokens
    slot.outputTokens += entry.outputTokens
    slot.cacheReadTokens += entry.cacheReadTokens
    slot.requests++

    if (!modelTotals[entry.model]) {
      modelTotals[entry.model] = {
        model: entry.model,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        requests: 0,
      }
    }
    const mt = modelTotals[entry.model]
    mt.inputTokens += entry.inputTokens
    mt.outputTokens += entry.outputTokens
    mt.cacheReadTokens += entry.cacheReadTokens
    mt.requests++
  }

  const byDay = Object.entries(dayModelMap)
    .map(([day, models]) => ({ day, models }))
    .sort((a, b) => a.day.localeCompare(b.day))

  const byModel = Object.values(modelTotals).sort(
    (a, b) => b.requests - a.requests,
  )
  const allModels = byModel.map(m => m.model)
  const totalRequests = allUsage.length

  json(res, 0, 'ok', {
    byDay,
    byModel,
    allModels,
    meta: {
      source: totalRequests > 0 ? 'ok' : 'empty',
      range,
      fileCount: sessionFiles.length,
      totalRequests,
    },
  })
  return true
}
