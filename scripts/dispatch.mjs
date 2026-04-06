#!/usr/bin/env node

/**
 * 統一指令分發器
 *
 * 從 npm_lifecycle_event 讀取 script 名稱（如 "d:setup"），
 * 解析命名空間與指令，轉發到對應的 workspace package。
 *
 * 指令定義在各 package 自己的 commands.mjs 中管理。
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 命名空間 → package 路徑與名稱 ───────────────────────────────
const NAMESPACES = {
  d: { pkg: '@ab-tao/dotfiles', dir: 'apps/dotfiles' },
  c: { pkg: '@ab-tao/commons', dir: 'packages/commons' },
};

// ── 載入各 package 的指令定義 ────────────────────────────────────
async function loadAliases() {
  const allAliases = {};
  for (const [ns, { dir }] of Object.entries(NAMESPACES)) {
    try {
      const mod = await import(path.join(ROOT, dir, 'commands.mjs'));
      if (mod.aliases) {
        for (const [key, val] of Object.entries(mod.aliases)) {
          allAliases[`${ns}:${key}`] = val;
        }
      }
    } catch {
      // commands.mjs 不存在則跳過
    }
  }
  return allAliases;
}

// ── 解析與執行 ───────────────────────────────────────────────────
const event = process.env.npm_lifecycle_event;
if (!event) {
  console.error('此腳本須透過 pnpm run 執行');
  process.exit(1);
}

const aliases = await loadAliases();

// 檢查特殊映射
const alias = aliases[event];
if (alias) {
  const ns = event.split(':')[0];
  const { pkg } = NAMESPACES[ns];
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
  const nsConfig = NAMESPACES[ns];

  if (!nsConfig) {
    console.error(`未知的命名空間: ${ns}（可用: ${Object.keys(NAMESPACES).join(', ')}）`);
    process.exit(1);
  }

  // 透傳額外參數
  const extraArgs = process.argv.slice(2).join(' ');
  const fullCmd = extraArgs
    ? `pnpm --filter ${nsConfig.pkg} run ${cmd} -- ${extraArgs}`
    : `pnpm --filter ${nsConfig.pkg} run ${cmd}`;

  try {
    execSync(fullCmd, { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}
