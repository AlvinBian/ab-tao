#!/usr/bin/env node

/**
 * hooks 互動式管理 — 啟用/停用個別 hook，不需重跑 setup
 * 資料源：repo claude/hooks/defs/*.json（規格）+ ~/.claude/settings.json（狀態）
 */

import fs from 'node:fs'
import path from 'node:path'
import * as p from '@clack/prompts'
import { getDirname, P } from '../libs/core/paths.mjs'

const DEFS_DIR = path.join(
  getDirname(import.meta),
  '..',
  'claude',
  'hooks',
  'defs',
)

function loadPluginHooks() {
  const pluginsDir = path.join(path.dirname(P.settings), 'plugins')
  const hooks = []
  if (!fs.existsSync(pluginsDir))
    return hooks
  for (const pluginName of fs.readdirSync(pluginsDir)) {
    const hooksJson = path.join(pluginsDir, pluginName, 'hooks', 'hooks.json')
    if (!fs.existsSync(hooksJson))
      continue
    let data
    try {
      data = JSON.parse(fs.readFileSync(hooksJson, 'utf8'))
    }
    catch {
      continue
    }
    const hooksMap = data.hooks ?? data
    if (typeof hooksMap !== 'object' || Array.isArray(hooksMap))
      continue
    for (const [event, handlers] of Object.entries(hooksMap)) {
      for (const h of Array.isArray(handlers) ? handlers : [handlers]) {
        const script = path.basename(
          h.command ?? h.run ?? h.script ?? '(prompt)',
        )
        hooks.push({ source: pluginName, event, script })
      }
    }
  }
  return hooks
}

function loadCanonicalDefs() {
  if (!fs.existsSync(DEFS_DIR))
    return []
  const defs = []
  for (const file of fs
    .readdirSync(DEFS_DIR)
    .filter(f => f.endsWith('.json'))) {
    const raw = JSON.parse(fs.readFileSync(path.join(DEFS_DIR, file), 'utf8'))
    for (const hook of raw.hooks ?? []) {
      defs.push({ event: raw.event, ...hook })
    }
  }
  return defs
}

function loadSettings() {
  if (!fs.existsSync(P.settings))
    return null
  return JSON.parse(fs.readFileSync(P.settings, 'utf8'))
}

function saveSettings(data) {
  fs.writeFileSync(P.settings, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function getActiveIds(settings) {
  const ids = new Set()
  for (const handlers of Object.values(settings.hooks ?? {})) {
    for (const h of handlers) {
      if (h.id)
        ids.add(h.id)
    }
  }
  return ids
}

async function main() {
  p.intro(' hooks 管理 ')

  const defs = loadCanonicalDefs()
  if (defs.length === 0) {
    p.log.error(`找不到 hook 定義（${DEFS_DIR}）\n請先執行 pnpm run d:setup`)
    p.outro()
    return
  }

  const settings = loadSettings()
  if (!settings) {
    p.log.error('找不到 ~/.claude/settings.json\n請先執行 pnpm run d:setup')
    p.outro()
    return
  }
  settings.hooks = settings.hooks ?? {}

  const activeIds = getActiveIds(settings)

  // 顯示當前狀態
  const statusLines = defs
    .map(
      d =>
        `  ${activeIds.has(d.id) ? '✅' : '⭕'} ${d.description ?? d.id}（${d.event}）`,
    )
    .join('\n')
  p.log.info(`ab-tao hooks（${defs.length} 個）：\n${statusLines}`)

  const pluginHooks = loadPluginHooks()
  if (pluginHooks.length > 0) {
    const pluginLines = pluginHooks
      .map((h) => {
        const warn = ''
        return `  📦 [${h.source}] ${h.event}：${h.script}${warn}`
      })
      .join('\n')
    p.log.info(`plugin hooks（${pluginHooks.length} 個）：\n${pluginLines}`)
  }

  // 選擇操作
  const action = await p.select({
    message: '操作',
    options: [
      { value: 'toggle', label: '啟用/停用 hooks' },
      { value: 'exit', label: '← 退出' },
    ],
  })

  if (p.isCancel(action) || action === 'exit') {
    p.outro()
    return
  }

  // toggle: multiselect 選啟用的
  const selected = await p.multiselect({
    message: '選擇要啟用的 hooks（Space 切換，Enter 確認）',
    options: defs.map(d => ({
      value: d.id,
      label: d.description ?? d.id,
      hint: d.event,
    })),
    initialValues: defs.filter(d => activeIds.has(d.id)).map(d => d.id),
  })

  if (p.isCancel(selected)) {
    p.outro('已取消')
    return
  }

  const selectedSet = new Set(selected)

  // 重建 settings.hooks：保留非 ab-tao: 的外掛 hooks（ECC 等），再疊加選中的 ab-tao hooks
  for (const [event, handlers] of Object.entries(settings.hooks)) {
    settings.hooks[event] = handlers.filter(
      h => !h.id?.startsWith('ab-tao:'),
    )
  }

  for (const def of defs) {
    if (!selectedSet.has(def.id))
      continue
    const { event, ...entry } = def
    const existing = settings.hooks[event] ?? []
    if (!existing.some(h => h.id === def.id)) {
      settings.hooks[event] = [...existing, entry]
    }
  }

  // 清理空 event key
  for (const event of Object.keys(settings.hooks)) {
    if (settings.hooks[event].length === 0)
      delete settings.hooks[event]
  }

  saveSettings(settings)

  const enabledCount = selected.length
  const disabledCount = defs.length - enabledCount
  p.log.success(`已更新：${enabledCount} 個啟用 · ${disabledCount} 個停用`)
  p.outro('hooks 管理完成')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
