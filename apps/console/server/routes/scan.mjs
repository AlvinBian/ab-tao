/**
 * /api/scan/* — d:scan 技術棧掃描的 REST + SSE 封裝
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

let _P = null;
async function getP() {
	if (!_P) {
		const m = await import(path.join(DOTFILES_LIB, "core/paths.mjs"));
		_P = m.P;
	}
	return _P;
}

export async function scanRouter(req, res, url, json) {
	// ── GET /api/scan/repos ── 已快取的 repos 清單
	if (req.method === "GET" && url.pathname === "/api/scan/repos") {
		try {
			const P = await getP();
			const { readFile } = await import("node:fs/promises");
			const raw = await readFile(P.cachedRepos, "utf8").catch(() => "[]");
			const parsed = JSON.parse(raw);
			json(res, 0, "ok", Array.isArray(parsed) ? parsed : []);
		} catch (e) {
			json(res, 500, e.message, null, 500);
		}
		return true;
	}

	// ── GET /api/scan/stacks ── 已快取的 techStacks
	if (req.method === "GET" && url.pathname === "/api/scan/stacks") {
		try {
			const P = await getP();
			const { readFile } = await import("node:fs/promises");
			const raw = await readFile(P.cachedTechStacks, "utf8").catch(() => "{}");
			const parsed = JSON.parse(raw);
			json(
				res,
				0,
				"ok",
				parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
					? parsed
					: {},
			);
		} catch (e) {
			json(res, 500, e.message, null, 500);
		}
		return true;
	}

	// ── GET /api/scan/status ── 是否有掃描任務進行中
	if (req.method === "GET" && url.pathname === "/api/scan/status") {
		json(res, 0, "ok", { running: runningTasks.has("scan") });
		return true;
	}

	// ── DELETE /api/scan ── 取消掃描
	if (req.method === "DELETE" && url.pathname === "/api/scan") {
		const child = runningTasks.get("scan");
		if (child) {
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!child.killed) child.kill("SIGKILL");
			}, 3000);
			json(res, 0, "掃描已取消", null);
		} else {
			json(res, 404, "無正在執行的掃描任務", null, 404);
		}
		return true;
	}

	// ── POST /api/scan ── SSE：執行 d:scan
	if (req.method === "POST" && url.pathname === "/api/scan") {
		if (runningTasks.has("scan")) {
			sseHeaders(res);
			sseSend(res, {
				type: "error",
				message: "掃描任務正在執行中，請稍後再試",
			});
			sseSend(res, { type: "done", success: false });
			res.end();
			return true;
		}

		const {
			init = false,
			noAi = false,
			org,
			top,
			skills,
			dryRun = false,
		} = req._body ?? {};
		const args = [path.join(DOTFILES_BIN, "scan.mjs")];
		if (init) args.push("--init");
		if (noAi) args.push("--no-ai");
		if (org) args.push("--org", String(org));
		if (top) args.push("--top", String(top));
		if (skills) args.push("--skills", String(skills));
		if (dryRun) args.push("--dry-run");

		spawnSse(res, req, "scan", process.execPath, args, {
			cwd: path.resolve(DOTFILES_BIN, ".."),
		});
		return true;
	}

	return false;
}
