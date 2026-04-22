/**
 * /api/restore/* — 備份列表與還原
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOTFILES_BIN, runningTasks, sseHeaders, sseSend } from "../sse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_ROOT = path.resolve(DOTFILES_BIN, "..");
const BACKUP_BASE = path.join(DOTFILES_ROOT, "dist", "backup");
const HOME = process.env.HOME ?? "";

function formatBytes(bytes) {
	if (!bytes) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

function countDir(dir) {
	let fileCount = 0;
	let size = 0;
	try {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				const sub = countDir(p);
				fileCount += sub.fileCount;
				size += sub.size;
			} else {
				fileCount++;
				size += fs.statSync(p).size;
			}
		}
	} catch {
		/* 忽略無法讀取的目錄 */
	}
	return { fileCount, size };
}

function cpDir(src, dest) {
	fs.cpSync(src, dest, { recursive: true, force: true });
}

function getBackups() {
	if (!fs.existsSync(BACKUP_BASE)) return [];
	return fs
		.readdirSync(BACKUP_BASE, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => {
			const dir = path.join(BACKUP_BASE, d.name);
			const { fileCount, size } = countDir(dir);
			const contents = fs.readdirSync(dir);
			return { id: d.name, dir, fileCount, size, contents };
		})
		.sort((a, b) => b.id.localeCompare(a.id));
}

export async function restoreRouter(req, res, url, json) {
	// ── GET /api/restore/backups ──
	if (req.method === "GET" && url.pathname === "/api/restore/backups") {
		try {
			const backups = getBackups().map(({ id, fileCount, size, contents }) => ({
				id,
				fileCount,
				size: formatBytes(size),
				contents,
			}));
			json(res, 0, "ok", backups);
		} catch (e) {
			json(res, 500, e.message, null, 500);
		}
		return true;
	}

	// ── POST /api/restore/execute ── SSE 串流還原
	if (req.method === "POST" && url.pathname === "/api/restore/execute") {
		const { backupId, dryRun = false } = req._body ?? {};
		if (!backupId) {
			json(res, 400, "backupId 必填", null, 400);
			return true;
		}
		const SAFE_ID = /^[A-Za-z0-9_-]+$/;
		if (!SAFE_ID.test(backupId)) {
			json(res, 400, "backupId 格式無效", null, 400);
			return true;
		}
		const backupDir = path.join(BACKUP_BASE, backupId);
		if (
			!backupDir.startsWith(BACKUP_BASE + path.sep) &&
			backupDir !== BACKUP_BASE
		) {
			json(res, 400, "backupId 格式無效", null, 400);
			return true;
		}
		if (!fs.existsSync(backupDir)) {
			json(res, 404, `備份不存在：${backupId}`, null, 404);
			return true;
		}

		sseHeaders(res);
		runningTasks.set("restore", true); // boolean sentinel（restore 無 cancel 端點，不需 kill handle）
		try {
			const contents = fs.readdirSync(backupDir);
			sseSend(res, {
				type: "log",
				message: `${dryRun ? "[DRY-RUN] " : ""}開始還原備份 ${backupId}（${contents.length} 項）`,
			});
			for (const item of contents) {
				if (path.basename(item) !== item) continue;
				const src = path.join(backupDir, item);
				let dest;
				if (item === "zshrc") dest = path.join(HOME, ".zshrc");
				else if (item === "zsh") dest = path.join(HOME, ".zsh");
				else if (item === "claude") dest = path.join(HOME, ".claude");
				else dest = path.join(HOME, `.${item}`);

				if (dryRun) {
					sseSend(res, {
						type: "log",
						message: `[DRY-RUN] 將還原：${item} → ${dest}`,
					});
				} else {
					const stat = fs.statSync(src);
					if (stat.isDirectory()) cpDir(src, dest);
					else fs.copyFileSync(src, dest);
					sseSend(res, { type: "log", message: `✓ 還原：${item} → ${dest}` });
				}
			}
			sseSend(res, { type: "done", success: true, dryRun });
		} catch (e) {
			sseSend(res, { type: "error", message: e.message });
			sseSend(res, { type: "done", success: false });
		} finally {
			runningTasks.delete("restore");
			res.end();
		}
		return true;
	}

	return false;
}
