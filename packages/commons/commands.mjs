#!/usr/bin/env node

/**
 * commons 指令定義與執行
 *
 * 用途：
 *   1. 被 root package.json 直接呼叫（"c:sync": "node packages/commons/commands.mjs"）
 *   2. 被 help.mjs 匯入讀取指令清單
 */

import { execSync } from 'node:child_process';

export const pkg = '@ab-tao/commons';

export const commands = {
  sync: '列出 AI 來源與狀態',
  validate: '驗證資源結構 + 安全檢查',
};

export const aliases = {
  'sync:select': { cmd: 'sync', args: '--select', desc: '互動式選擇同步' },
  'sync:all': { cmd: 'sync', args: '--all', desc: '同步全部 7 個來源' },
};

// ── 直接執行時，從 npm_lifecycle_event 解析指令 ──────────────────
const event = process.env.npm_lifecycle_event;
if (event?.includes(':')) {
  const cmdKey = event.slice(event.indexOf(':') + 1);
  const alias = aliases[cmdKey];
  const extra = process.argv.slice(2).join(' ');

  let full;
  if (alias) {
    full = `pnpm --filter ${pkg} run ${alias.cmd} -- ${alias.args}${extra ? ` ${extra}` : ''}`;
  } else {
    full = extra
      ? `pnpm --filter ${pkg} run ${cmdKey} -- ${extra}`
      : `pnpm --filter ${pkg} run ${cmdKey}`;
  }

  try {
    execSync(full, { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}
