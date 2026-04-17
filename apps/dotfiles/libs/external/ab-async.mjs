/**
 * iCloud 偏好同步 API
 *
 * 同步目標：~/.zshrc.d/.prefs.zsh · ~/.claude/hooks/.prefs
 *           ~/.claude/hooks/.protected-files · ~/.claude/hooks/.dangerous-patterns
 *
 * iCloud 路徑：~/Library/Mobile Documents/com~apple~CloudDocs/ab-async/prefs/
 * 同步狀態：~/.claude/.ab-sync.json
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HOME } from "../core/paths.mjs";

// ── 路徑常數 ─────────────────────────────────────────────────────
const ICLOUD_ROOT = path.join(
	HOME,
	"Library",
	"Mobile Documents",
	"com~apple~CloudDocs",
);
export const ICLOUD_SYNC_DIR = path.join(ICLOUD_ROOT, "ab-async", "prefs");
export const SYNC_META_FILE = path.join(HOME, ".claude", ".ab-sync.json");

/** 同步的檔案清單（本地路徑 → iCloud 相對路徑） */
export const SYNC_FILES = [
	{
		local: path.join(HOME, ".zshrc.d", ".prefs.zsh"),
		remote: "zsh-prefs.zsh",
		label: ".prefs.zsh（ZSH 偏好）",
	},
	{
		local: path.join(HOME, ".claude", "hooks", ".prefs"),
		remote: "hooks-prefs",
		label: "hooks/.prefs（通知設定）",
	},
	{
		local: path.join(HOME, ".claude", "hooks", ".protected-files"),
		remote: "hooks-protected-files",
		label: "hooks/.protected-files（保護清單）",
	},
	{
		local: path.join(HOME, ".claude", "hooks", ".dangerous-patterns"),
		remote: "hooks-dangerous-patterns",
		label: "hooks/.dangerous-patterns（危險模式）",
	},
];

// ── 輔助 ──────────────────────────────────────────────────────────

/** 檢查 iCloud Drive 是否可用 */
export function isICloudAvailable() {
	return fs.existsSync(ICLOUD_ROOT);
}

/** 讀取同步 metadata（最後同步時間、裝置等） */
export function readSyncMeta() {
	if (!fs.existsSync(SYNC_META_FILE)) return null;
	try {
		return JSON.parse(fs.readFileSync(SYNC_META_FILE, "utf8"));
	} catch {
		return null;
	}
}

/** 寫入同步 metadata */
function writeSyncMeta(data) {
	const dir = path.dirname(SYNC_META_FILE);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(SYNC_META_FILE, JSON.stringify(data, null, 2));
}

// ── 核心 API ──────────────────────────────────────────────────────

/**
 * 取得同步狀態（不執行同步）
 * @returns {{ available: boolean, lastPush: string|null, lastPull: string|null,
 *             device: string|null, diffs: Array<{label, status}> }}
 */
export function getSyncStatus() {
	const available = isICloudAvailable();
	const meta = readSyncMeta();

	const diffs = SYNC_FILES.map(({ local, remote, label }) => {
		const remotePath = path.join(ICLOUD_SYNC_DIR, remote);
		const localExists = fs.existsSync(local);
		const remoteExists = available && fs.existsSync(remotePath);

		if (!localExists && !remoteExists) return { label, status: "both-missing" };
		if (!localExists) return { label, status: "remote-only" };
		if (!remoteExists) return { label, status: "local-only" };

		try {
			const localContent = fs.readFileSync(local, "utf8");
			const remoteContent = fs.readFileSync(remotePath, "utf8");
			return {
				label,
				status: localContent === remoteContent ? "in-sync" : "diverged",
			};
		} catch {
			return { label, status: "error" };
		}
	});

	return {
		available,
		lastPush: meta?.lastPush ?? null,
		lastPull: meta?.lastPull ?? null,
		device: meta?.device ?? null,
		diffs,
	};
}

/**
 * 推送本地偏好 → iCloud
 * @returns {{ pushed: string[], skipped: string[], errors: string[] }}
 */
export function pushPrefs() {
	if (!isICloudAvailable()) {
		throw new Error("iCloud Drive 不可用（未登入或系統不支援）");
	}

	fs.mkdirSync(ICLOUD_SYNC_DIR, { recursive: true });

	const pushed = [];
	const skipped = [];
	const errors = [];

	for (const { local, remote, label } of SYNC_FILES) {
		if (!fs.existsSync(local)) {
			skipped.push(label);
			continue;
		}
		try {
			const remotePath = path.join(ICLOUD_SYNC_DIR, remote);
			fs.copyFileSync(local, remotePath);
			pushed.push(label);
		} catch (err) {
			errors.push(`${label}：${err.message}`);
		}
	}

	writeSyncMeta({
		lastPush: new Date().toISOString(),
		lastPull: readSyncMeta()?.lastPull ?? null,
		device: os.hostname(),
	});

	return { pushed, skipped, errors };
}

/**
 * 從 iCloud 拉取偏好 → 本地
 * @param {{ force?: boolean }} opts - force=true 跳過衝突確認
 * @returns {{ pulled: string[], skipped: string[], errors: string[] }}
 */
export function pullPrefs({ force = false } = {}) {
	if (!isICloudAvailable()) {
		throw new Error("iCloud Drive 不可用（未登入或系統不支援）");
	}

	const pulled = [];
	const skipped = [];
	const errors = [];

	for (const { local, remote, label } of SYNC_FILES) {
		const remotePath = path.join(ICLOUD_SYNC_DIR, remote);
		if (!fs.existsSync(remotePath)) {
			skipped.push(label);
			continue;
		}
		try {
			// 本地存在且有差異時，若非 force 則備份
			if (fs.existsSync(local) && !force) {
				const localContent = fs.readFileSync(local, "utf8");
				const remoteContent = fs.readFileSync(remotePath, "utf8");
				if (localContent !== remoteContent) {
					fs.copyFileSync(local, `${local}.bak`);
				}
			}
			fs.mkdirSync(path.dirname(local), { recursive: true });
			fs.copyFileSync(remotePath, local);
			pulled.push(label);
		} catch (err) {
			errors.push(`${label}：${err.message}`);
		}
	}

	writeSyncMeta({
		lastPush: readSyncMeta()?.lastPush ?? null,
		lastPull: new Date().toISOString(),
		device: os.hostname(),
	});

	return { pulled, skipped, errors };
}

/**
 * 清除 iCloud 同步目錄與本地 metadata
 * @returns {{ deleted: boolean }}
 */
export function clearSync() {
	let deleted = false;
	if (fs.existsSync(ICLOUD_SYNC_DIR)) {
		fs.rmSync(ICLOUD_SYNC_DIR, { recursive: true, force: true });
		deleted = true;
	}
	if (fs.existsSync(SYNC_META_FILE)) {
		fs.unlinkSync(SYNC_META_FILE);
		deleted = true;
	}
	return { deleted };
}
