#!/usr/bin/env node

/**
 * 統一指令分發器
 *
 * 從 npm_lifecycle_event 讀取 script 名稱（如 "d:setup"），
 * 解析命名空間與指令，轉發到對應的 workspace package。
 *
 * 命名空間映射在此集中管理，新增指令只需在 package.json 加一行。
 */

import { execSync } from 'node:child_process';

// ── 命名空間 → package 映射 ──────────────────────────────────────
const PACKAGES = {
  d: '@ab-tao/dotfiles',
  c: '@ab-tao/commons',
};

// ── 特殊指令映射（指令名 → 實際 run script + 額外參數）──────────
const ALIASES = {
  'c:sync:select': { cmd: 'sync', args: '--select' },
  'c:sync:all': { cmd: 'sync', args: '--all' },
};

// ── 解析與執行 ───────────────────────────────────────────────────
const event = process.env.npm_lifecycle_event;
if (!event) {
  console.error('此腳本須透過 pnpm run 執行');
  process.exit(1);
}

// 檢查特殊映射
const alias = ALIASES[event];
if (alias) {
  const [ns] = event.split(':');
  const pkg = PACKAGES[ns];
  execSync(`pnpm --filter ${pkg} run ${alias.cmd} -- ${alias.args}`, {
    stdio: 'inherit',
  });
} else {
  // 一般格式：ns:command
  const colonIdx = event.indexOf(':');
  if (colonIdx === -1) {
    console.error(`無法解析指令: ${event}`);
    process.exit(1);
  }

  const ns = event.slice(0, colonIdx);
  const cmd = event.slice(colonIdx + 1);
  const pkg = PACKAGES[ns];

  if (!pkg) {
    console.error(`未知的命名空間: ${ns}（可用: ${Object.keys(PACKAGES).join(', ')}）`);
    process.exit(1);
  }

  // 透傳所有額外參數（-- 之後的）
  const extraArgs = process.argv.slice(2).join(' ');
  const fullCmd = extraArgs
    ? `pnpm --filter ${pkg} run ${cmd} -- ${extraArgs}`
    : `pnpm --filter ${pkg} run ${cmd}`;

  try {
    execSync(fullCmd, { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}
