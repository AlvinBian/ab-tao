/**
 * GET /api/sse/failure-patterns — 讀取 failure-patterns.md 並以 SSE 串流輸出
 * 首次連線送出全檔內容，fs.watchFile 偵測變更後重新送出
 */

import fs from "node:fs";
import path from "node:path";
import { DOTFILES_BIN, sseHeaders, sseSend } from "../sse.mjs";

const DOTFILES_ROOT = path.resolve(DOTFILES_BIN, "..");
const DOTFILES_LIB = path.resolve(DOTFILES_ROOT, "libs");

let _P = null;
async function getP() {
	if (!_P) {
		const m = await import(path.join(DOTFILES_LIB, "core/paths.mjs"));
		_P = m.P;
	}
	return _P;
}

export async function sseFailurePatternsRouter(req, res, url) {
	if (req.method !== "GET" || url.pathname !== "/api/sse/failure-patterns")
		return false;

	const P = await getP();
	const filePath = path.join(P.abTao.corrections, "failure-patterns.md");

	sseHeaders(res);

	// 送出當前全檔內容
	function sendContent() {
		if (res.writableEnded) return;
		if (!fs.existsSync(filePath)) {
			sseSend(res, {
				type: "content",
				content: "（尚無 failure-patterns.md 內容）",
			});
			return;
		}
		const content = fs.readFileSync(filePath, "utf8");
		sseSend(res, { type: "content", content });
	}

	sendContent();

	// 監聽檔案變更
	const watchOptions = { persistent: false, interval: 2000 };
	fs.watchFile(filePath, watchOptions, (curr, prev) => {
		if (curr.mtime > prev.mtime) {
			sendContent();
		}
	});

	req.on("close", () => {
		fs.unwatchFile(filePath);
	});

	return true;
}
