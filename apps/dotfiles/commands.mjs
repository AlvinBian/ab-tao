#!/usr/bin/env node

/**
 * dotfiles 指令定義與執行
 *
 * 用途：
 *   1. 被 root package.json 直接呼叫（"d:setup": "node apps/dotfiles/commands.mjs"）
 *   2. 被 help.mjs 匯入讀取指令清單
 */

import { execSync } from 'node:child_process';

export const pkg = '@ab-tao/dotfiles';

export const commands = {
  setup: '完整環境部署精靈',
  scan: '技術棧掃描 + 技能庫生成',
  doctor: '環境診斷',
  status: '配置狀態儀表板',
  report: '瀏覽器 HTML Dashboard',
  restore: '還原備份',
  hooks: 'Hook 管理',
  uninstall: '移除 ab-dotfiles',
};

export const aliases = {};

// ── 直接執行時，從 npm_lifecycle_event 解析指令 ──────────────────
const event = process.env.npm_lifecycle_event;
if (event?.includes(':')) {
  const cmd = event.slice(event.indexOf(':') + 1);
  const extra = process.argv.slice(2).join(' ');
  const full = extra
    ? `pnpm --filter ${pkg} run ${cmd} -- ${extra}`
    : `pnpm --filter ${pkg} run ${cmd}`;
  try {
    execSync(full, { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}
