#!/usr/bin/env node

/**
 * dotfiles 指令定義與執行
 */

import { run } from '@ab-tao/root/run';

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

run(pkg, aliases);
