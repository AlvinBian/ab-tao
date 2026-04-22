/**
 * iCloud 偏好同步 API
 *
 * 同步目標：~/.zshrc.d/.prefs.zsh · ~/.zshrc.d/.selected-modules
 *           ~/.claude/hooks/.prefs · ~/.claude/hooks/.protected-files
 *           ~/.claude/hooks/.dangerous-patterns
 *
 * iCloud 路徑：~/Library/Mobile Documents/com~apple~CloudDocs/ab-async/prefs/
 * 同步狀態：~/.claude/.ab-sync.json（v2 per-file 追蹤）
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

/** 基礎同步檔案清單（本地路徑 → iCloud 相對路徑） */
const BASE_SYNC_FILES = [
	{
		local: path.join(HOME, ".zshrc.d", ".prefs.zsh"),
		remote: "zsh-prefs.zsh",
		label: ".prefs.zsh（ZSH 偏好）",
	},
	{
		local: path.join(HOME, ".zshrc.d", ".selected-modules"),
		remote: "zsh-selected-modules",
		label: ".selected-modules（ZSH 模組選擇）",
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

/**
 * 取得完整同步檔案清單，根據偏好動態決定是否包含 99-local.zsh
 * @param {{ sync99Local?: boolean }} opts
 * @returns {Array<{local: string, remote: string, label: string}>}
 */
export function getSyncFiles(opts = {}) {
	const files = [...BASE_SYNC_FILES];
	if (opts.sync99Local) {
		files.push({
			local: path.join(HOME, ".zshrc.d", "conf", "99-local.zsh"),
			remote: "zsh-99-local.zsh",
			label: "99-local.zsh（本機專屬設定）",
		});
	}
	return files;
}

/**
 * 預設同步檔案清單（向後相容）
 * @deprecated 請改用 getSyncFiles(opts) 以支援 99-local.zsh 可選同步
 */
export const SYNC_FILES = BASE_SYNC_FILES;

// ── Metadata 處理 ─────────────────────────────────────────────────

/**
 * v1 metadata 遷移至 v2 格式（僅在記憶體中轉換，不寫入）
 * v1：{ lastPush, lastPull, device }
 * v2：{ version: 2, device, files: { [remote]: { pushedAt, pulledAt, size } } }
 */
function migrateToV2(meta) {
	const files = {};
	for (const { remote } of SYNC_FILES) {
		files[remote] = {
			pushedAt: meta.lastPush ?? null,
			pulledAt: meta.lastPull ?? null,
			size: null,
		};
	}
	return {
		version: 2,
		device: meta.device ?? os.hostname(),
		files,
	};
}

/** 檢查 iCloud Drive 是否可用 */
export function isICloudAvailable() {
	return fs.existsSync(ICLOUD_ROOT);
}

/** 讀取同步 metadata，自動將 v1 升級為 v2 格式 */
export function readSyncMeta() {
	if (!fs.existsSync(SYNC_META_FILE)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(SYNC_META_FILE, "utf8"));
		if (raw.version === 2) return raw;
		// v1 → v2 自動遷移（讀取時轉換，下次 push/pull 時持久化）
		return migrateToV2(raw);
	} catch {
		return null;
	}
}

/** 寫入同步 metadata（始終寫入 v2 格式） */
function writeSyncMeta(data) {
	const dir = path.dirname(SYNC_META_FILE);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(SYNC_META_FILE, JSON.stringify(data, null, 2));
}

/** 從 v2 metadata 計算最新 lastPush / lastPull */
function computeLastTimestamps(meta) {
	if (!meta?.files) return { lastPush: null, lastPull: null };
	const pushTimes = Object.values(meta.files)
		.map((f) => f.pushedAt)
		.filter(Boolean);
	const pullTimes = Object.values(meta.files)
		.map((f) => f.pulledAt)
		.filter(Boolean);
	return {
		lastPush: pushTimes.length ? pushTimes.sort().at(-1) : null,
		lastPull: pullTimes.length ? pullTimes.sort().at(-1) : null,
	};
}

// ── 核心 API ──────────────────────────────────────────────────────

/**
 * 確認 iCloud 端是否存在偏好檔案（至少有 zsh-prefs.zsh）
 * 用於 d:setup --from-icloud 快速判斷
 */
export function hasRemotePrefs() {
	if (!isICloudAvailable()) return false;
	return fs.existsSync(path.join(ICLOUD_SYNC_DIR, "zsh-prefs.zsh"));
}

/**
 * 取得 remote mtime 比 local 更新的檔案列表
 * 用於 d:setup 啟動時提示「iCloud 有更新的偏好」
 * @returns {Array<{label: string, remote: string}>}
 */
export function getRemoteNewerFiles() {
	if (!isICloudAvailable()) return [];
	const newer = [];
	for (const { local, remote, label } of SYNC_FILES) {
		const remotePath = path.join(ICLOUD_SYNC_DIR, remote);
		if (!fs.existsSync(remotePath)) continue;
		if (!fs.existsSync(local)) {
			newer.push({ label, remote });
			continue;
		}
		try {
			const remoteMtime = fs.statSync(remotePath).mtimeMs;
			const localMtime = fs.statSync(local).mtimeMs;
			if (remoteMtime > localMtime) newer.push({ label, remote });
		} catch {
			// 無法比較時略過
		}
	}
	return newer;
}

/**
 * 取得同步狀態（不執行同步）
 * @param {{ sync99Local?: boolean }} opts
 * @returns {{ available: boolean, lastPush: string|null, lastPull: string|null,
 *             device: string|null, diffs: Array<{label, status}> }}
 */
export function getSyncStatus(opts = {}) {
	const available = isICloudAvailable();
	const meta = readSyncMeta();
	const { lastPush, lastPull } = computeLastTimestamps(meta);

	const diffs = getSyncFiles(opts).map(({ local, remote, label }) => {
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
		lastPush,
		lastPull,
		device: meta?.device ?? null,
		diffs,
	};
}

/**
 * 推送本地偏好 → iCloud
 * @param {{ sync99Local?: boolean, dryRun?: boolean }} opts
 * @returns {{ pushed: string[], skipped: string[], errors: string[], dry?: string[] }}
 */
export function pushPrefs(opts = {}) {
	const { dryRun = false } = opts;
	if (!isICloudAvailable()) {
		throw new Error("iCloud Drive 不可用（未登入或系統不支援）");
	}

	if (!dryRun) fs.mkdirSync(ICLOUD_SYNC_DIR, { recursive: true });

	const pushed = [];
	const skipped = [];
	const errors = [];
	const dry = [];
	const now = new Date().toISOString();

	// 讀取現有 metadata，確保保留 pull 時間戳
	const meta = readSyncMeta() ?? {
		version: 2,
		device: os.hostname(),
		files: {},
	};
	if (!meta.files) meta.files = {};

	for (const { local, remote, label } of getSyncFiles(opts)) {
		if (!fs.existsSync(local)) {
			skipped.push(label);
			continue;
		}
		if (dryRun) {
			dry.push(label);
			continue;
		}
		try {
			const remotePath = path.join(ICLOUD_SYNC_DIR, remote);
			fs.copyFileSync(local, remotePath);
			const size = fs.statSync(local).size;
			meta.files[remote] = {
				pushedAt: now,
				pulledAt: meta.files[remote]?.pulledAt ?? null,
				size,
			};
			pushed.push(label);
		} catch (err) {
			errors.push(`${label}：${err.message}`);
		}
	}

	if (!dryRun) {
		meta.device = os.hostname();
		meta.version = 2;
		writeSyncMeta(meta);
	}

	return { pushed, skipped, errors, ...(dryRun ? { dry } : {}) };
}

/**
 * 從 iCloud 拉取偏好 → 本地
 * @param {{ force?: boolean, sync99Local?: boolean, dryRun?: boolean }} opts - force=true 跳過衝突確認
 * @returns {{ pulled: string[], skipped: string[], errors: string[], dry?: string[] }}
 */
export async function pullPrefs({
	force = false,
	sync99Local = false,
	dryRun = false,
} = {}) {
	if (!isICloudAvailable()) {
		throw new Error("iCloud Drive 不可用（未登入或系統不支援）");
	}

	const pulled = [];
	const skipped = [];
	const errors = [];
	const dry = [];
	const now = new Date().toISOString();

	const meta = readSyncMeta() ?? {
		version: 2,
		device: os.hostname(),
		files: {},
	};
	if (!meta.files) meta.files = {};

	for (const { local, remote, label } of getSyncFiles({ sync99Local })) {
		const remotePath = path.join(ICLOUD_SYNC_DIR, remote);
		if (!fs.existsSync(remotePath)) {
			skipped.push(label);
			continue;
		}
		if (dryRun) {
			dry.push(label);
			continue;
		}
		try {
			// symlink 防護：拒絕複製 symlink（防 iCloud 被劫後植入符號連結）
			const remoteStat = fs.lstatSync(remotePath);
			if (remoteStat.isSymbolicLink()) {
				errors.push(`${label}：遠端為 symlink，拒絕複製`);
				continue;
			}

			// 安全驗證（eval/sudo/rm-rf 等危險 pattern）
			const remoteContent = fs.readFileSync(remotePath, "utf8");
			let validateFn;
			try {
				({ validateFileContent: validateFn } = await import(
					"@ab-tao/commons/security"
				));
			} catch {
				/* commons 不可用時跳過 */
			}
			if (validateFn) {
				const { errors: secErrors } = validateFn(remote, remoteContent, {
					strict: true,
				});
				if (secErrors.length > 0) {
					errors.push(`${label}：安全驗證失敗 — ${secErrors[0].message}`);
					continue;
				}
			}

			// 本地存在且有差異時，若非 force 則備份（timestamp 避免覆蓋）
			if (fs.existsSync(local) && !force) {
				const localContent = fs.readFileSync(local, "utf8");
				if (localContent !== remoteContent) {
					const bak = `${local}.bak.${Date.now()}`;
					if (!fs.existsSync(bak)) fs.copyFileSync(local, bak);
				}
			}
			fs.mkdirSync(path.dirname(local), { recursive: true });
			fs.writeFileSync(local, remoteContent, "utf8");
			meta.files[remote] = {
				pushedAt: meta.files[remote]?.pushedAt ?? null,
				pulledAt: now,
				size: fs.statSync(local).size,
			};
			pulled.push(label);
		} catch (err) {
			errors.push(`${label}：${err.message}`);
		}
	}

	if (!dryRun) {
		meta.device = os.hostname();
		meta.version = 2;
		writeSyncMeta(meta);
	}

	return { pulled, skipped, errors, ...(dryRun ? { dry } : {}) };
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
