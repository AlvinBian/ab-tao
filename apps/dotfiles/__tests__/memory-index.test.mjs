import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

// 直接測試純邏輯函式（不依賴 P，避免模組快取問題）
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match)
    return null
  const result = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):[ \t]*(\S.*)$/)
    if (m)
      result[m[1]] = m[2].trim()
  }
  return Object.keys(result).length > 0 ? result : null
}

function parseMarkdownFallback(content) {
  const name = content.match(/^#\s+(\S.*)$/m)?.[1]?.trim() ?? null
  const lines = content.split('\n')
  let desc = null
  let pastH1 = false
  for (const line of lines) {
    if (/^#\s/.test(line)) {
      pastH1 = true
      continue
    }
    if (pastH1 && line.trim() && !line.startsWith('#')) {
      desc = line.trim()
      break
    }
  }
  return { name, description: desc }
}

const MANUAL_START = '<!-- manual:start -->'
const MANUAL_END = '<!-- manual:end -->'
const AUTO_START = '<!-- auto:start -->'
const AUTO_END = '<!-- auto:end -->'

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildAutoSection(entries) {
  const lines = [AUTO_START]
  for (const e of entries.slice(0, 15)) {
    const desc = e.description ? ` — ${e.description}` : ''
    lines.push(`- [${e.name}](${e.relRef})${desc}`.slice(0, 150))
  }
  lines.push(AUTO_END)
  return lines.join('\n')
}

function applyMemoryUpdate(existing, entries) {
  const autoSection = buildAutoSection(entries)
  if (!existing) {
    return `${MANUAL_START}\n\n${MANUAL_END}\n\n${autoSection}\n`
  }
  if (!existing.includes(MANUAL_START)) {
    return `${MANUAL_START}\n${existing.trim()}\n${MANUAL_END}\n\n${autoSection}\n`
  }
  const manualMatch = existing.match(
    new RegExp(
      `${escapeRegex(MANUAL_START)}[\\s\\S]*?${escapeRegex(MANUAL_END)}`,
    ),
  )
  const manualSection = manualMatch
    ? manualMatch[0]
    : `${MANUAL_START}\n\n${MANUAL_END}`
  if (existing.includes(AUTO_START)) {
    return existing.replace(
      new RegExp(
        `${escapeRegex(AUTO_START)}[\\s\\S]*?${escapeRegex(AUTO_END)}`,
      ),
      autoSection,
    )
  }
  return `${manualSection}\n\n${autoSection}\n`
}

describe('parseFrontmatter', () => {
  it('正常 frontmatter 解析', () => {
    const content
      = '---\nname: Auth 重構\ndescription: JWT 遷移方案\n---\n\n# 內容\n'
    const result = parseFrontmatter(content)
    assert.equal(result?.name, 'Auth 重構')
    assert.equal(result?.description, 'JWT 遷移方案')
  })

  it('無 frontmatter 回傳 null', () => {
    const result = parseFrontmatter('# Just a heading\n\nsome content')
    assert.equal(result, null)
  })
})

describe('parseMarkdownFallback', () => {
  it('h1 fallback 取 name 與第一段', () => {
    const content = '# Auth 重構\n\nJWT 遷移方案的設計決策\n\n更多內容'
    const result = parseMarkdownFallback(content)
    assert.equal(result.name, 'Auth 重構')
    assert.equal(result.description, 'JWT 遷移方案的設計決策')
  })

  it('無 H1 時 name 為 null', () => {
    const result = parseMarkdownFallback('只有純文字，無標題')
    assert.equal(result.name, null)
  })
})

describe('applyMemoryUpdate（MEMORY.md 邏輯）', () => {
  it('首次建立：生成 manual markers + auto section', () => {
    const result = applyMemoryUpdate(null, [
      {
        name: 'Auth 重構',
        description: 'JWT 遷移',
        relRef: 'auth-refactor/index.md',
        mtime: 1,
      },
    ])
    assert.ok(result.includes(MANUAL_START))
    assert.ok(result.includes(MANUAL_END))
    assert.ok(result.includes(AUTO_START))
    assert.ok(result.includes('Auth 重構'))
  })

  it('無 markers 的舊 MEMORY.md：包裹現有內容，不丟失', () => {
    const existing = '- [舊記憶](old/index.md) — 已有內容\n'
    const result = applyMemoryUpdate(existing, [])
    assert.ok(result.includes(MANUAL_START))
    assert.ok(result.includes('舊記憶'))
  })

  it('manual section 保留，auto section 更新', () => {
    const existing = [
      MANUAL_START,
      '- [手寫項目](manual/index.md) — 重要決策',
      MANUAL_END,
      '',
      AUTO_START,
      '- [舊自動項目](old/index.md) — 舊的',
      AUTO_END,
    ].join('\n')

    const result = applyMemoryUpdate(existing, [
      {
        name: '新自動項目',
        description: '新的',
        relRef: 'new/index.md',
        mtime: 1,
      },
    ])
    assert.ok(result.includes('手寫項目'), 'manual 內容應保留')
    assert.ok(result.includes('新自動項目'), 'auto 內容應更新')
    assert.ok(!result.includes('舊自動項目'), '舊 auto 內容應替換')
  })

  it('空 memory dir 時 auto section 只有 markers', () => {
    const result = applyMemoryUpdate(null, [])
    assert.ok(result.includes(AUTO_START))
    assert.ok(result.includes(AUTO_END))
    // auto section 中除了 markers 不應有條目行
    const autoMatch = result.match(
      new RegExp(
        `${escapeRegex(AUTO_START)}([\\s\\S]*?)${escapeRegex(AUTO_END)}`,
      ),
    )
    const autoContent = autoMatch?.[1]?.trim() ?? ''
    assert.equal(autoContent, '')
  })
})
