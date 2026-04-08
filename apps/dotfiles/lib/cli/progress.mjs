/**
 * 進度追蹤 — 解析子程序 stdout，驅動進度條
 *
 * 支持動態 total：子程序第一行輸出 `TOTAL:XX` 時自動設定 total
 */

import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires control chars
const ANSI_RE = /\x1B\[[0-?]*[ -/]*[@-~]/g;
export function stripAnsi(str) {
	return str.replace(ANSI_RE, "");
}

/**
 * 執行命令並追蹤進度
 *
 * @param {string} cmd - 完整命令字串（用空白切割）
 * @param {Object} opts
 * @param {string} opts.cwd - 工作目錄
 * @param {number} opts.total - 預估進度總數（若子程序輸出 TOTAL:XX 則自動覆蓋）
 * @param {Function} opts.parseProgress - 解析每行 stdout，回傳 label 字串 / null / { statusOnly }
 * @param {Object} opts.logger - { progress, done, failure } 介面
 */
export function runWithProgress(cmd, { cwd, total, parseProgress, logger }) {
	return new Promise((resolve, reject) => {
		let current = 0;
		let dynamicTotal = total;

		const [spawnCmd, ...spawnArgs] = cmd.trim().split(/\s+/);
		const child = spawn(spawnCmd, spawnArgs, { cwd });
		let buf = "";
		const stderrChunks = [];
		const decoder = new StringDecoder("utf8");

		child.on("error", (error) => {
			logger?.failure(current, dynamicTotal);
			reject(new Error(`執行失敗：${error.message}`));
		});

		child.stdout.on("data", (chunk) => {
			buf += decoder.write(chunk);
			const lines = buf.split("\n");
			buf = lines.pop();
			for (const line of lines) {
				const stripped = stripAnsi(line);

				// 動態 total：子程序第一行輸出 TOTAL:XX
				const totalMatch = stripped.match(/^TOTAL:(\d+)$/);
				if (totalMatch) {
					dynamicTotal = Number.parseInt(totalMatch[1], 10);
					continue;
				}

				const result = parseProgress(stripped);
				if (result === null) continue;
				if (typeof result === "object" && result.statusOnly) {
					// 狀態更新不推進計數
				} else if (current < dynamicTotal) {
					current++;
					const label = typeof result === "string" ? result : result.label;
					logger?.progress(current, dynamicTotal, label);
				}
			}
		});
		child.stderr.on("data", (chunk) => {
			stderrChunks.push(chunk);
		});

		child.on("close", (code) => {
			if (code !== 0) {
				logger?.failure(current, dynamicTotal);
				const stderr = Buffer.concat(stderrChunks).toString().trim();
				reject(
					new Error(`執行失敗（代碼 ${code}）${stderr ? `\n${stderr}` : ""}`),
				);
			} else {
				if (current < dynamicTotal) logger?.done(dynamicTotal);
				resolve();
			}
		});
	});
}
