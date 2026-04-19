/**
 * 共用 SSE helper：設定 headers、發送事件、管理子進程生命週期。
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DOTFILES_BIN = path.resolve(__dirname, "../../dotfiles/bin");

/** 正在執行的長任務子進程（taskType → child） */
export const runningTasks = new Map();

export function sseHeaders(res) {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
		"Access-Control-Allow-Origin": "*",
	});
}

export function sseSend(res, data) {
	res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * spawn 子進程，把 stdout/stderr 轉成 SSE log 事件。
 * 結束時送 { type: 'done', code } 或 { type: 'error', message }。
 */
export function spawnSse(res, taskType, cmd, args, opts = {}) {
	if (runningTasks.has(taskType)) {
		sseSend(res, {
			type: "error",
			message: `${taskType} 任務正在執行中，請稍後再試`,
		});
		res.end();
		return null;
	}

	sseHeaders(res);

	const child = spawn(cmd, args, {
		...opts,
		env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
	});
	runningTasks.set(taskType, child);

	child.stdout?.on("data", (chunk) => {
		for (const line of chunk.toString().split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			// 嘗試解析 JSON 進度事件（子進程可用 console.log(JSON.stringify({type,…})) 輸出）
			try {
				const parsed = JSON.parse(trimmed);
				if (parsed.type) {
					sseSend(res, parsed);
					return;
				}
			} catch {
				// 非 JSON，當普通 log
			}
			sseSend(res, { type: "log", message: trimmed });
		}
	});

	child.stderr?.on("data", (chunk) => {
		for (const line of chunk.toString().split("\n")) {
			const trimmed = line.trim();
			if (trimmed)
				sseSend(res, { type: "log", level: "warn", message: trimmed });
		}
	});

	child.on("close", (code) => {
		runningTasks.delete(taskType);
		sseSend(res, { type: "done", code: code ?? 0, success: (code ?? 0) === 0 });
		res.end();
	});

	child.on("error", (err) => {
		runningTasks.delete(taskType);
		sseSend(res, { type: "error", message: err.message });
		res.end();
	});

	return child;
}
