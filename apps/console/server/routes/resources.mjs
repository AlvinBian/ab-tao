/**
 * resources.mjs — /api/resources/* 路由
 *
 * 提供 Skills / Commands / Agents / Rules 的清單查詢與 enable/disable 切換。
 * 切換透過 fs.rename 實作（不走 child process）；所有 mutation 前先備份。
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { copyFile, readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 靜態 import 路徑：routes/ → server/ → console/ → apps/dotfiles/libs/core/
// （3 層上去抵達 apps/，dotfiles 為 console 同層目錄）
import { parseSource } from '../../../dotfiles/libs/core/source-classifier.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOTFILES_LIB = path.resolve(__dirname, '../../../dotfiles/libs')

/** 懶載入 P（paths.mjs） */
let _P = null
async function getP() {
  if (!_P) {
    const m = await import(path.join(DOTFILES_LIB, 'core/paths.mjs'))
    _P = m.P
  }
  return _P
}

/** 懶載入 scanSkills */
let _scanSkills = null
async function getScanSkills() {
  if (!_scanSkills) {
    const m = await import(path.join(DOTFILES_LIB, 'core/usage-scanner.mjs'))
    _scanSkills = m.scanSkills
  }
  return _scanSkills
}

/** 從 YAML frontmatter 提取 description 欄位 */
function parseFrontmatterDescription(filePath) {
  try {
    const head = readFileSync(filePath, 'utf8').slice(0, 1024)
    const fmMatch = head.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch)
      return undefined
    const fm = fmMatch[1]
    const m = fm.match(/^description:[ \t]*(\S.*)$/m)
    if (!m)
      return undefined
    const val = m[1].trim()
    if (/^[>|][-+]?$/.test(val)) {
      const blockM = fm.match(/^description:\s*[>|][-+]?\r?\n[ \t]+(.+)/m)
      return blockM?.[1].trim()
    }
    return val.replace(/^["']|["']$/g, '')
  }
  catch {
    return undefined
  }
}

/** 讀取 .md / .md.disabled 通用掃描（commands / agents / rules） */
async function scanFlatResources(dir) {
  if (!existsSync(dir))
    return []
  const entries = await readdir(dir)
  const items = []
  for (const entry of entries) {
    const enabled = entry.endsWith('.md') && !entry.endsWith('.md.disabled')
    const disabled = entry.endsWith('.md.disabled')
    if (!enabled && !disabled)
      continue
    const name = enabled ? entry.slice(0, -3) : entry.slice(0, -11)
    const filePath = path.join(dir, entry)
    // 呼叫共用分類器，修復「所有資源顯示為 custom」的 bug
    const source = parseSource(filePath)
    const description = parseFrontmatterDescription(filePath)
    items.push({ name, enabled, source, description })
  }
  return items
}

/** 建立備份目錄，回傳路徑 */
async function ensureBackupDir(P) {
  const now = new Date()
  const stamp = now
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(':', '-')
  const dir = path.join(P.abTaoDir, `backups/console-${stamp}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 備份單一檔案 */
async function backupFile(src, backupDir) {
  if (!existsSync(src))
    return
  const dest = path.join(backupDir, path.basename(src))
  await copyFile(src, dest)
}

/**
 * 切換 flat 資源（commands / agents / rules）
 * @param {string} dir   — P.commands / P.agents / P.rules
 * @param {string} name  — 資源名稱（不含副檔名）
 * @param {boolean} enabled — 目標狀態
 */
async function toggleFlatResource(dir, name, enabled) {
  const P = await getP()
  const enabledPath = path.join(dir, `${name}.md`)
  const disabledPath = path.join(dir, `${name}.md.disabled`)
  const src = enabled ? disabledPath : enabledPath
  const dest = enabled ? enabledPath : disabledPath

  if (!existsSync(src)) {
    throw new Error(`找不到資源檔案：${src}`)
  }

  const backupDir = await ensureBackupDir(P)
  await backupFile(src, backupDir)
  await rename(src, dest)
}

/**
 * 切換 Skill（SKILL.md / SKILL.md.disabled）
 * @param {string} skillsDir — P.skills
 * @param {string} name      — skill 名稱（子目錄名）
 * @param {boolean} enabled
 */
async function toggleSkill(skillsDir, name, enabled) {
  const P = await getP()
  const skillDir = path.join(skillsDir, name)
  const enabledPath = path.join(skillDir, 'SKILL.md')
  const disabledPath = path.join(skillDir, 'SKILL.md.disabled')
  const src = enabled ? disabledPath : enabledPath
  const dest = enabled ? enabledPath : disabledPath

  if (!existsSync(src)) {
    throw new Error(`找不到 Skill 檔案：${src}`)
  }

  const backupDir = await ensureBackupDir(P)
  await backupFile(src, backupDir)
  await rename(src, dest)
}

/** resourcesRouter — 處理 /api/resources/ */
export async function resourcesRouter(req, res, url, json) {
  const P = await getP()

  // ── GET /api/resources/skills ──
  if (req.method === 'GET' && url.pathname === '/api/resources/skills') {
    const scanSkills = await getScanSkills()
    const skills = scanSkills(P.skills)
    json(res, 0, 'ok', skills)
    return true
  }

  // ── GET /api/resources/commands ──
  if (req.method === 'GET' && url.pathname === '/api/resources/commands') {
    const items = await scanFlatResources(P.commands)
    json(res, 0, 'ok', items)
    return true
  }

  // ── GET /api/resources/agents ──
  if (req.method === 'GET' && url.pathname === '/api/resources/agents') {
    const items = await scanFlatResources(P.agents)
    json(res, 0, 'ok', items)
    return true
  }

  // ── GET /api/resources/rules ──
  if (req.method === 'GET' && url.pathname === '/api/resources/rules') {
    const items = await scanFlatResources(P.rules)
    json(res, 0, 'ok', items)
    return true
  }

  // ── PATCH /api/resources/:kind/:name/enabled ──
  const toggleMatch = url.pathname.match(
    /^\/api\/resources\/(skills|commands|agents|rules)\/(.+)\/enabled$/,
  )
  if (req.method === 'PATCH' && toggleMatch) {
    const kind = toggleMatch[1]
    const name = decodeURIComponent(toggleMatch[2])
    const SAFE_NAME = /^[\w.-]+$/
    if (!SAFE_NAME.test(name) || path.basename(name) !== name) {
      json(res, 400, 'name 格式無效', null, 400)
      return true
    }
    const { enabled } = req._body ?? {}

    if (typeof enabled !== 'boolean') {
      json(res, 400, 'body.enabled 必須為 boolean', null, 400)
      return true
    }

    try {
      if (kind === 'skills') {
        await toggleSkill(P.skills, name, enabled)
      }
      else {
        const dirMap = {
          commands: P.commands,
          agents: P.agents,
          rules: P.rules,
        }
        await toggleFlatResource(dirMap[kind], name, enabled)
      }

      // 回傳最新清單
      let items
      if (kind === 'skills') {
        const scanSkills = await getScanSkills()
        items = scanSkills(P.skills)
      }
      else {
        const dirMap = {
          commands: P.commands,
          agents: P.agents,
          rules: P.rules,
        }
        items = await scanFlatResources(dirMap[kind])
      }
      json(res, 0, `${name} 已${enabled ? '啟用' : '停用'}`, items)
    }
    catch (err) {
      json(res, 500, err.message, null, 500)
    }
    return true
  }

  return false
}
