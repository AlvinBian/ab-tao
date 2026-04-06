/**
 * 公共執行器 — 各 package 的 commands.mjs 共用
 *
 * 從 npm_lifecycle_event 解析指令，轉發到指定 package。
 */

import { execSync } from 'node:child_process';

/**
 * @param {string} pkg - package filter 名稱（如 '@ab-tao/dotfiles'）
 * @param {Record<string, object>} aliases - 特殊指令映射
 */
export function run(pkg, aliases = {}) {
  const event = process.env.npm_lifecycle_event;
  if (!event?.includes(':')) return;

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
