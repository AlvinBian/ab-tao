/**
 * 指令分發器 — 各 package 的 commands.mjs 共用
 *
 * 從 npm_lifecycle_event 解析指令，轉發到指定 package。
 *
 * 設計：
 *   - 避免遞迴：檢查 npm_lifecycle_event 確保只轉發一層
 */

import { execSync } from "node:child_process";

/**
 * @param {string} pkg - package filter 名稱（如 '@ab-tao/dotfiles'）
 * @param {Record<string, object>} aliases - 特殊指令映射
 */
export function run(pkg, aliases = {}) {
	const event = process.env.npm_lifecycle_event;
	// 只在頂層 npm 命令中轉發（包含 : 的）
	if (!event?.includes(":")) return;

	const cmdKey = event.slice(event.indexOf(":") + 1);
	const alias = aliases[cmdKey];
	const extra = process.argv.slice(2).join(" ");

	let full;
	if (alias) {
		full = `pnpm --filter ${pkg} run ${alias.cmd} -- ${alias.args}${extra ? ` ${extra}` : ""}`;
	} else {
		full = extra
			? `pnpm --filter ${pkg} run ${cmdKey} -- ${extra}`
			: `pnpm --filter ${pkg} run ${cmdKey}`;
	}

	try {
		execSync(full, { stdio: "inherit" });
	} catch (err) {
		// 保留原始退出碼
		process.exit(err.status || 1);
	}
}

/** 執行指令，繼承 stdio（互動式，支援 TTY） */
export function execInteractive(cmd) {
	try {
		execSync(cmd, { stdio: "inherit" });
		return true;
	} catch {
		return false;
	}
}
