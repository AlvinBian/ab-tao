/**
 * 日誌輸出
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

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
