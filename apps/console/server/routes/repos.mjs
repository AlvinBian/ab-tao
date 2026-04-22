/**
 * repos.mjs — /api/repos/* 路由
 *
 * GET  /api/repos            — 讀取快取 repos 並附加 role 分類
 * POST /api/repos/:name/scan — 觸發單一 repo 重新掃描（stub）
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * 根據路徑/名稱推斷 repo 角色
 * @param {string} repoPath
 * @param {string} repoName
 * @returns {"main" | "temp" | "archived"}
 */
function classifyRole(repoPath, repoName) {
	const haystack = `${repoPath ?? ""} ${repoName ?? ""}`.toLowerCase();
	// 已歸檔：含 temp / tmp / archive / bak / .trash / backup
	if (/\/(temp|tmp|archive|bak|\.trash|backup)(\/|$)/.test(haystack)) {
		return "archived";
	}
	// 主要工作目錄：~/projects、~/work、~/dev、~/src、~/code
	if (/\/(projects?|work|dev|src|code)(\/|$)/.test(repoPath ?? "")) {
		return "main";
	}
	return "temp";
}

/**
 * 豐富單一 repo 物件
 * @param {Record<string, unknown>} repo  — 原始快取 repo
 * @param {Record<string, string[]>} stacks — cachedTechStacks
 * @returns {object}
 */
function enrichRepo(repo, stacks) {
	const rawPath = String(repo.localPath ?? "");
	const rawName = repo.name
		? String(repo.name)
		: (rawPath.split("/").filter(Boolean).pop() ?? "—");

	// 若 repo 本身已帶 role 則沿用，否則依路徑推斷
	const role =
		repo.role && ["main", "temp", "archived"].includes(String(repo.role))
			? String(repo.role)
			: classifyRole(rawPath, rawName);

	// techStacks：優先從 stacks map 查詢（以 localPath 或 name 為 key）
	const techStacks =
		(Array.isArray(repo.techStacks) ? repo.techStacks : null) ??
		stacks[rawPath] ??
		stacks[rawName] ??
		[];

	return {
		name: rawName,
		path: rawPath,
		role,
		techStacks,
		branch: repo.branch != null ? String(repo.branch) : null,
		lastCommit: repo.lastCommit != null ? String(repo.lastCommit) : null,
	};
}

/** reposRouter — 處理 /api/repos/* */
export async function reposRouter(req, res, url, json) {
	// ── GET /api/repos ──
	if (req.method === "GET" && url.pathname === "/api/repos") {
		try {
			const P = await getP();
			const { readFile } = await import("node:fs/promises");

			// 資料來源：last-report-data.json（由 d:status 產生）
			const cacheFile = `${P.cache}/last-report-data.json`;
			const raw = await readFile(cacheFile, "utf8").catch(() => "{}");
			const cached = JSON.parse(raw);

			/** @type {Record<string, unknown>[]} */
			const repos = Array.isArray(cached.repos) ? cached.repos : [];
			/** @type {Record<string, string[]>} */
			const stacks =
				cached.techStacks && typeof cached.techStacks === "object"
					? cached.techStacks
					: {};

			const enriched = repos.map((r) => enrichRepo(r, stacks));
			json(res, 0, "ok", enriched);
		} catch (e) {
			json(res, 500, e.message, null, 500);
		}
		return true;
	}

	// ── POST /api/repos/open ──
	if (req.method === "POST" && url.pathname === "/api/repos/open") {
		const repoPath = req._body?.path;
		if (
			typeof repoPath !== "string" ||
			!path.isAbsolute(repoPath) ||
			!existsSync(repoPath)
		) {
			json(res, 400, "path 無效或不存在", null, 400);
			return true;
		}
		execFile("open", [repoPath], (err) => {
			if (err) {
				json(res, 500, `無法開啟：${err.message}`, null, 500);
			} else {
				json(res, 0, "已在 Finder 開啟", { path: repoPath });
			}
		});
		return true;
	}

	return false;
}
