/**
 * @ab-tao/share/libs — 功能庫
 *
 * 有狀態或有副作用的功能模組（日誌、互動式 shell 等）。
 */

import { execSync } from 'node:child_process';

// ── 日誌 ─────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

export function info(msg) {
  console.log(`${CYAN}ℹ${RESET} ${msg}`);
}

export function success(msg) {
  console.log(`${GREEN}✔${RESET} ${msg}`);
}

export function warn(msg) {
  console.warn(`${YELLOW}⚠${RESET} ${msg}`);
}

export function error(msg) {
  console.error(`${RED}✖${RESET} ${msg}`);
}

export function step(label, msg) {
  console.log(`${BOLD}[${label}]${RESET} ${msg}`);
}

export function dim(msg) {
  console.log(`${DIM}${msg}${RESET}`);
}

// ── 互動式 Shell ─────────────────────────────────────────────────

/** 執行指令，繼承 stdio（互動式，支援 TTY） */
export function execInteractive(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}
