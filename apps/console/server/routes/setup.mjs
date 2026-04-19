/**
 * /api/setup/* — d:setup 互動精靈的 REST + SSE 封裝
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	DOTFILES_BIN,
	runningTasks,
	spawnSse,
	sseHeaders,
	sseSend,
} from "../sse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

let _loadSession = null;
let _clearSessionProgress = null;

async function getSession() {
	if (!_loadSession) {
		const m = await import(path.join(DOTFILES_LIB, "core/session.mjs"));
		_loadSession = m.loadSession;
		_clearSessionProgress = m.clearSessionProgress;
	}
	return {
		loadSession: _loadSession,
		clearSessionProgress: _clearSessionProgress,
	};
}

export async function setupRouter(req, res, url, json) {
	// ── GET /api/setup/session ──
	if (req.method === "GET" && url.pathname === "/api/setup/session") {
		try {
			const { loadSession } = await getSession();
			const session = loadSession();
			json(res, 0, "ok", session ?? {});
		} catch (e) {
			json(res, 500, e.message, null, 500);
		}
		return true;
	}

	// ── DELETE /api/setup/progress ──
	if (req.method === "DELETE" && url.pathname === "/api/setup/progress") {
		try {
			const { clearSessionProgress } = await getSession();
			clearSessionProgress();
			json(res, 0, "進度已清除", null);
		} catch (e) {
			json(res, 500, e.message, null, 500);
		}
		return true;
	}

	// ── GET /api/setup/status ── 是否有任務正在執行
	if (req.method === "GET" && url.pathname === "/api/setup/status") {
		json(res, 0, "ok", {
			running: runningTasks.has("setup"),
			tasks: [...runningTasks.keys()],
		});
		return true;
	}

	// ── DELETE /api/setup/execute ── 取消正在執行的 setup
	if (req.method === "DELETE" && url.pathname === "/api/setup/execute") {
		const child = runningTasks.get("setup");
		if (child) {
			child.kill("SIGTERM");
			runningTasks.delete("setup");
			json(res, 0, "任務已取消", null);
		} else {
			json(res, 404, "無正在執行的 setup 任務", null, 404);
		}
		return true;
	}

	// ── POST /api/setup/execute ── SSE：執行 d:setup --quick（非互動式快速安裝）
	if (req.method === "POST" && url.pathname === "/api/setup/execute") {
		if (runningTasks.has("setup")) {
			sseHeaders(res);
			sseSend(res, {
				type: "error",
				message: "setup 任務正在執行中，請稍後再試",
			});
			res.end();
			return true;
		}

		const { flags = [] } = req._body ?? {};
		// 強制加上 --yes 跳過所有確認
		const extraFlags = Array.isArray(flags) ? flags : [];
		if (!extraFlags.includes("--yes")) extraFlags.push("--yes");

		spawnSse(
			res,
			"setup",
			process.execPath,
			[path.join(DOTFILES_BIN, "setup.mjs"), ...extraFlags],
			{ cwd: path.resolve(DOTFILES_BIN, "..") },
		);
		return true;
	}

	return false;
}
