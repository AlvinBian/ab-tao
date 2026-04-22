/**
 * /api/sync/* — iCloud 偏好同步 REST + SSE 封裝
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { runningTasks, sseHeaders, sseSend } from "../sse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

let _abAsync = null;
async function getAbAsync() {
	if (!_abAsync) {
		_abAsync = await import(path.join(DOTFILES_LIB, "external/ab-async.mjs"));
	}
	return _abAsync;
}

export async function syncRouter(req, res, url, json) {
	// ── GET /api/sync/status ──
	if (req.method === "GET" && url.pathname === "/api/sync/status") {
		try {
			const { getSyncStatus } = await getAbAsync();
			json(res, 0, "ok", getSyncStatus());
		} catch (e) {
			json(res, 500, e.message, null, 500);
		}
		return true;
	}

	// ── POST /api/sync/push ── SSE（快速但仍同步執行）
	if (req.method === "POST" && url.pathname === "/api/sync/push") {
		if (runningTasks.has("sync-push")) {
			sseHeaders(res);
			sseSend(res, { type: "error", message: "推送任務正在執行中" });
			res.end();
			return true;
		}

		sseHeaders(res);
		runningTasks.set("sync-push", true);
		try {
			const { pushPrefs } = await getAbAsync();
			sseSend(res, { type: "log", message: "推送偏好設定至 iCloud…" });
			const result = await Promise.resolve(
				pushPrefs({
					sync99Local: req._body?.sync99Local,
					dryRun: req._body?.dryRun,
				}),
			);
			for (const f of result.dry ?? [])
				sseSend(res, { type: "log", message: `[DRY-RUN] 將推送：${f}` });
			for (const f of result.pushed ?? [])
				sseSend(res, { type: "log", message: `✓ 推送：${f}` });
			for (const f of result.skipped ?? [])
				sseSend(res, { type: "log", message: `— 跳過：${f}` });
			for (const f of result.errors ?? [])
				sseSend(res, { type: "log", level: "warn", message: `✗ 錯誤：${f}` });
			sseSend(res, { type: "done", success: true, result });
		} catch (e) {
			sseSend(res, { type: "error", message: e.message });
			sseSend(res, { type: "done", success: false });
		} finally {
			runningTasks.delete("sync-push");
			res.end();
		}
		return true;
	}

	// ── POST /api/sync/pull ── SSE
	if (req.method === "POST" && url.pathname === "/api/sync/pull") {
		if (runningTasks.has("sync-pull")) {
			sseHeaders(res);
			sseSend(res, { type: "error", message: "拉取任務正在執行中" });
			res.end();
			return true;
		}

		sseHeaders(res);
		runningTasks.set("sync-pull", true);
		try {
			const { pullPrefs } = await getAbAsync();
			sseSend(res, { type: "log", message: "從 iCloud 拉取偏好設定…" });
			const result = await pullPrefs({
				force: req._body?.force,
				sync99Local: req._body?.sync99Local,
				dryRun: req._body?.dryRun,
			});
			for (const f of result.dry ?? [])
				sseSend(res, { type: "log", message: `[DRY-RUN] 將拉取：${f}` });
			for (const f of result.pulled ?? [])
				sseSend(res, { type: "log", message: `✓ 拉取：${f}` });
			for (const f of result.skipped ?? [])
				sseSend(res, { type: "log", message: `— 跳過：${f}` });
			sseSend(res, { type: "done", success: true, result });
		} catch (e) {
			sseSend(res, { type: "error", message: e.message });
			sseSend(res, { type: "done", success: false });
		} finally {
			runningTasks.delete("sync-pull");
			res.end();
		}
		return true;
	}

	return false;
}
