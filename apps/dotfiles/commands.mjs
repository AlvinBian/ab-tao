#!/usr/bin/env node

/**
 * dotfiles 指令定義與執行（v1.0.0）
 */

import { run } from '@ab-tao/share/libs'

export const pkg = '@ab-tao/dotfiles'

export const commands = {
  setup:
    '完整環境部署精靈（--scan / --doctor / --restore / --dry-run / --reset-choices）',
  status: '配置狀態儀表板（--html 輸出 HTML）',
  hooks: 'Hook 管理（開關、狀態）',
  scan: '技術棧掃描 + 技能庫生成',
  restore: '還原備份',
  report: '生成 HTML Dashboard 並在瀏覽器開啟',
  uninstall: '移除 ab-tao',
  doctor: 'State 健康診斷（--fix 自動修復 ghost / dead sync.included）',
}

export const aliases = {}

run(pkg, aliases)
