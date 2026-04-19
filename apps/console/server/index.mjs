/**
 * ab-tao Console API Server
 *
 * 基於 Node 18+ 內建 node:http，零外部依賴（除 dotfiles libs）。
 * 端口：5478（避開 3000 / 5173 / 8080）
 * 格式：統一 { code, message, data }
 */

import { createServer } from "node:http";
import { URL } from "node:url";
import { resourcesRouter } from "./routes/resources.mjs";
import { statusRouter } from "./routes/status.mjs";

const PORT = 5478;

/** 解析 request body（JSON） */
async function parseBody(req) {
	return new Promise((resolve) => {
		let body = "";
		req.on("data", (chunk) => (body += chunk));
		req.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch {
				resolve({});
			}
		});
	});
}

/** 統一回應輔助 */
function json(res, code, message, data, status = 200) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ code, message, data }));
}

const server = createServer(async (req, res) => {
	// CORS — 僅供 localhost 開發使用
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, PATCH, DELETE, OPTIONS",
	);
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	const url = new URL(req.url, `http://localhost:${PORT}`);
	req._parsedUrl = url;
	req._body = await parseBody(req);

	try {
		// /api/health — 健康檢查
		if (req.method === "GET" && url.pathname === "/api/health") {
			json(res, 0, "ok", { status: "healthy", version: "0.1.0" });
			return;
		}

		// /api/status/* — 狀態資料
		if (url.pathname.startsWith("/api/status")) {
			const handled = await statusRouter(req, res, url, json);
			if (handled) return;
		}

		// /api/resources/* — 資源管理（CRUD）
		if (url.pathname.startsWith("/api/resources")) {
			const handled = await resourcesRouter(req, res, url, json);
			if (handled) return;
		}

		// 未匹配路由
		json(res, 404, "Not Found", null, 404);
	} catch (err) {
		console.error("[API Error]", err);
		json(
			res,
			500,
			err instanceof Error ? err.message : "Internal Server Error",
			null,
			500,
		);
	}
});

server.listen(PORT, () => {
	console.log(`✓ ab-tao Console API  →  http://localhost:${PORT}`);
});
