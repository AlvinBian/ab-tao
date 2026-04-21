/**
 * settings.mjs — /api/settings/* / /api/preferences / /api/plugins/* 路由
 *
 * 讀寫 ~/.claude/settings.json 及偏好設定檔。
 * mutation 前自動備份；所有 mutation 需通過 assertTrustedOrigin 驗證。
 */

import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { backupSettings } from "../utils/backup.mjs";
import { LockedError, withSettingsLock } from "../utils/lock.mjs";
import { assertTrustedOrigin } from "../utils/security.mjs";
import { HOOKS_DEDUP_KEY, mergeSettings } from "../utils/settings-merge.mjs";

export { backupSettings };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

let _P = null;
let _PREF_DEFAULTS = null;
let _readPrefsFromDisk = null;
let _deployZshPrefs = null;
let _deployHookPrefs = null;

async function getP() {
	if (!_P) {
		const m = await import(path.join(DOTFILES_LIB, "core/paths.mjs"));
		_P = m.P;
	}
	return _P;
}

async function getPrefsUtils() {
	if (!_PREF_DEFAULTS) {
		const m = await import(path.join(DOTFILES_LIB, "core/preferences.mjs"));
		_PREF_DEFAULTS = m.PREF_DEFAULTS;
		_readPrefsFromDisk = m.readPrefsFromDisk;
		_deployZshPrefs = m.deployZshPrefs;
		_deployHookPrefs = m.deployHookPrefs;
	}
	return {
		PREF_DEFAULTS: _PREF_DEFAULTS,
		readPrefsFromDisk: _readPrefsFromDisk,
		deployZshPrefs: _deployZshPrefs,
		deployHookPrefs: _deployHookPrefs,
	};
}

async function readSettings(P) {
	try {
		const raw = await readFile(P.settings, "utf8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function writeSettings(P, settings) {
	const json = JSON.stringify(settings, null, "\t");
	await writeFile(P.settings, json, "utf8");
}

/**
 * 根據 settings.json 的 mtime + size 計算 ETag（16 位 MD5 hex）。
 * 檔案不存在時回傳 null。
 *
 * @param {object} P — paths 物件
 * @returns {string|null}
 */
function computeEtag(P) {
	try {
		const s = statSync(P.settings);
		return createHash("md5")
			.update(`${s.mtimeMs}-${s.size}`)
			.digest("hex")
			.slice(0, 16);
	} catch {
		return null;
	}
}

/**
 * 統一處理 mutation 的互斥鎖錯誤。
 * 若 d:setup 或 Console 並發寫入時，回傳 423 Locked。
 *
 * @param {object} res
 * @param {Function} json
 * @param {Function} fn
 */
async function withLock(res, json, fn) {
	try {
		return await withSettingsLock(fn);
	} catch (e) {
		if (e instanceof LockedError) {
			json(
				res,
				423,
				e.message,
				{ code: e.code, owner: e.owner, since: e.since },
				423,
			);
			return null;
		}
		throw e;
	}
}

/**
 * 統一執行 assertTrustedOrigin，失敗時直接回傳 403 並中止。
 * 回傳 true 表示驗證失敗（呼叫方應立即 return true）。
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} json
 * @returns {boolean} 是否已拒絕請求
 */
function rejectUntrusted(req, res, json) {
	try {
		assertTrustedOrigin(req);
		return false;
	} catch (e) {
		json(res, 403, e.message, { code: e.code }, 403);
		return true;
	}
}

/**
 * 統一執行備份；備份失敗時回傳 503 並中止（在 withSettingsLock callback 內使用）。
 * 回傳 true 表示備份失敗（呼叫方應立即 return）。
 *
 * @param {object} P
 * @param {object} res
 * @param {Function} json
 * @returns {Promise<boolean>} 是否備份失敗
 */
async function backupOrFail(P, res, json) {
	try {
		await backupSettings(P);
		return false;
	} catch (e) {
		json(
			res,
			503,
			`備份失敗，寫入已中止：${e.message}`,
			{ code: "BACKUP_FAILED" },
			503,
		);
		return true;
	}
}

/**
 * 確保 hooks[event] 為陣列並套用 HOOKS_DEDUP_KEY 去重。
 * 修改 settings 物件（in-place）。
 *
 * @param {object} settings
 * @param {string} event
 */
function deduplicateHooks(settings, event) {
	if (!settings.hooks) settings.hooks = {};
	if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];

	// 套用 HOOKS_DEDUP_KEY 去重（HOOKS_DEDUP_KEY 是 (entry) => string 的函式）
	if (typeof HOOKS_DEDUP_KEY === "function") {
		const seen = new Set();
		settings.hooks[event] = settings.hooks[event].filter((h) => {
			const key =
				typeof h === "object" && h !== null ? HOOKS_DEDUP_KEY(h) : String(h);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}
}

export async function settingsRouter(req, res, url, json) {
	const P = await getP();

	// ── GET /api/settings ──
	if (req.method === "GET" && url.pathname === "/api/settings") {
		const settings = await readSettings(P);
		const etag = computeEtag(P);
		if (etag) res.setHeader("ETag", etag);
		json(res, 0, "ok", settings);
		return true;
	}

	// ── PUT /api/settings（原子寫入，JSON editor 用） ──
	if (req.method === "PUT" && url.pathname === "/api/settings") {
		if (rejectUntrusted(req, res, json)) return true;

		// 驗證 If-Match header（防止 stale write）
		const ifMatch = req.headers["if-match"];
		if (!ifMatch) {
			json(
				res,
				428,
				"缺少 If-Match header，請帶入目前的 ETag",
				{ code: "ETAG_REQUIRED" },
				428,
			);
			return true;
		}

		const currentEtag = computeEtag(P);
		if (currentEtag && ifMatch !== currentEtag) {
			json(
				res,
				409,
				"設定已被其他操作修改，請重新載入後再提交",
				{ code: "SETTINGS_STALE", currentEtag },
				409,
			);
			return true;
		}

		const incoming = req._body;
		if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
			json(
				res,
				400,
				"請求 body 必須為 JSON 物件",
				{ code: "INVALID_BODY" },
				400,
			);
			return true;
		}

		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;

			const current = await readSettings(P);
			const merged = mergeSettings(incoming, current);

			// 基本完整性驗證（Ajv 完整驗證於 Phase B 實作）
			if (!merged || typeof merged !== "object" || Array.isArray(merged)) {
				json(
					res,
					400,
					"合併後的設定格式不合法",
					{ code: "INVALID_MERGED" },
					400,
				);
				return;
			}

			await writeSettings(P, merged);

			const newEtag = computeEtag(P);
			if (newEtag) res.setHeader("ETag", newEtag);
			json(res, 0, "Settings 已更新", { _etag: newEtag });
		});
		return true;
	}

	// ── PATCH /api/settings/permissions ──
	if (req.method === "PATCH" && url.pathname === "/api/settings/permissions") {
		if (rejectUntrusted(req, res, json)) return true;

		const { allow, deny } = req._body ?? {};
		if (!Array.isArray(allow) || !Array.isArray(deny)) {
			json(
				res,
				400,
				"allow 與 deny 必須為陣列",
				{ code: "INVALID_PARAMS" },
				400,
			);
			return true;
		}
		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;
			const settings = await readSettings(P);
			if (!settings.permissions) settings.permissions = {};
			settings.permissions.allow = allow;
			settings.permissions.deny = deny;
			await writeSettings(P, settings);
			json(res, 0, "Permissions 已更新", { allow, deny });
		});
		return true;
	}

	// ── PATCH /api/settings/ai ──
	if (req.method === "PATCH" && url.pathname === "/api/settings/ai") {
		if (rejectUntrusted(req, res, json)) return true;

		const { model, effortLevel } = req._body ?? {};
		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;
			const settings = await readSettings(P);
			if (model !== undefined) settings.model = model;
			if (effortLevel !== undefined) settings.effortLevel = effortLevel;
			await writeSettings(P, settings);
			json(res, 0, "AI 設定已更新", {
				model: settings.model,
				effortLevel: settings.effortLevel,
			});
		});
		return true;
	}

	// ── PATCH /api/settings/statusline ──
	if (req.method === "PATCH" && url.pathname === "/api/settings/statusline") {
		if (rejectUntrusted(req, res, json)) return true;

		const { command } = req._body ?? {};
		if (!command) {
			json(res, 400, "command 為必填", { code: "MISSING_COMMAND" }, 400);
			return true;
		}
		// 防止 shell 注入：限制字元集，不允許 shell metacharacters
		const SAFE_CMD = /^[^;|&`$<>\n\r]{1,256}$/;
		if (!SAFE_CMD.test(command)) {
			json(
				res,
				400,
				"command 包含不允許的字元",
				{ code: "UNSAFE_COMMAND" },
				400,
			);
			return true;
		}
		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;
			const settings = await readSettings(P);
			settings.statusLine = { type: "command", command };
			await writeSettings(P, settings);
			json(res, 0, "StatusLine 已更新", settings.statusLine);
		});
		return true;
	}

	// ── PATCH /api/settings/plugins/:name/enabled ──
	const pluginMatch = url.pathname.match(
		/^\/api\/settings\/plugins\/(.+)\/enabled$/,
	);
	if (req.method === "PATCH" && pluginMatch) {
		if (rejectUntrusted(req, res, json)) return true;

		const pluginName = decodeURIComponent(pluginMatch[1]);
		const { enabled } = req._body ?? {};
		if (typeof enabled !== "boolean") {
			json(res, 400, "enabled 必須為 boolean", { code: "INVALID_PARAMS" }, 400);
			return true;
		}
		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;
			const settings = await readSettings(P);
			if (!settings.enabledPlugins) settings.enabledPlugins = {};
			settings.enabledPlugins[pluginName] = enabled;
			await writeSettings(P, settings);
			json(
				res,
				0,
				`${pluginName} 已${enabled ? "啟用" : "停用"}`,
				settings.enabledPlugins,
			);
		});
		return true;
	}

	// ── POST /api/settings/hooks/:event（新增 hook） ──
	const hookEventPostMatch = url.pathname.match(
		/^\/api\/settings\/hooks\/([^/]+)$/,
	);
	if (req.method === "POST" && hookEventPostMatch) {
		if (rejectUntrusted(req, res, json)) return true;

		const event = decodeURIComponent(hookEventPostMatch[1]);
		const body = req._body ?? {};
		const { command, matcher, hooks: hooksArr } = body;

		// 支援兩種格式：
		//   1. { command, matcher? } — 新增單一 hook entry
		//   2. { hooks: [...] }     — 批次新增（e.g. 整個 event 陣列）
		const newEntries = Array.isArray(hooksArr)
			? hooksArr
			: command !== undefined
				? [
						{
							type: "command",
							command,
							...(matcher !== undefined ? { matcher } : {}),
						},
					]
				: null;

		if (!newEntries) {
			json(
				res,
				400,
				"需提供 command 或 hooks 陣列",
				{ code: "MISSING_PARAMS" },
				400,
			);
			return true;
		}

		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;
			const settings = await readSettings(P);
			if (!settings.hooks) settings.hooks = {};
			if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
			settings.hooks[event].push(...newEntries);
			deduplicateHooks(settings, event);
			await writeSettings(P, settings);
			json(res, 0, `已新增 hook 至 ${event}`, {
				event,
				hooks: settings.hooks[event],
			});
		});
		return true;
	}

	// ── PATCH /api/settings/hooks/:event/:idx（修改 hook） ──
	const hookPatchMatch = url.pathname.match(
		/^\/api\/settings\/hooks\/([^/]+)\/(\d+)$/,
	);
	if (req.method === "PATCH" && hookPatchMatch) {
		if (rejectUntrusted(req, res, json)) return true;

		const event = decodeURIComponent(hookPatchMatch[1]);
		const idx = parseInt(hookPatchMatch[2], 10);
		if (Number.isNaN(idx) || idx < 0) {
			json(res, 400, "idx 必須為非負整數", { code: "INVALID_IDX" }, 400);
			return true;
		}

		const body = req._body ?? {};
		const { enabled, command, matcher } = body;

		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;
			const settings = await readSettings(P);
			if (!settings.hooks) settings.hooks = {};
			if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];

			const hooksArr = settings.hooks[event];

			if (idx >= hooksArr.length) {
				json(
					res,
					400,
					`idx ${idx} 超出範圍（目前共 ${hooksArr.length} 個 hook）`,
					{ code: "IDX_OUT_OF_RANGE" },
					400,
				);
				return;
			}

			if (enabled === false) {
				// 物理移動：從 hooks[event] 移至 _abTao.disabledHooks[event]
				const [removed] = hooksArr.splice(idx, 1);
				if (!settings._abTao) settings._abTao = {};
				if (!settings._abTao.disabledHooks) settings._abTao.disabledHooks = {};
				if (!Array.isArray(settings._abTao.disabledHooks[event])) {
					settings._abTao.disabledHooks[event] = [];
				}
				settings._abTao.disabledHooks[event].push(removed);
				deduplicateHooks(settings, event);
				await writeSettings(P, settings);
				json(res, 0, `已停用並移出 ${event}[${idx}]`, {
					event,
					hooks: settings.hooks[event],
					disabledHooks: settings._abTao.disabledHooks[event],
				});
			} else if (enabled === true) {
				// 還原：從 _abTao.disabledHooks[event] 找匹配並移回 hooks[event]
				// 以目前 idx 對應的 hook 內容（若有）或 body 中的 command/matcher 比對
				const disabledArr = settings._abTao?.disabledHooks?.[event];
				if (!Array.isArray(disabledArr) || disabledArr.length === 0) {
					json(
						res,
						400,
						`_abTao.disabledHooks.${event} 無可還原的 hook`,
						{ code: "NO_DISABLED_HOOKS" },
						400,
					);
					return;
				}

				// 取第一個（FIFO 語義）或依 command 匹配
				let restoreIdx = 0;
				if (command !== undefined) {
					const found = disabledArr.findIndex((h) => h?.command === command);
					if (found !== -1) restoreIdx = found;
				}

				const [restored] = disabledArr.splice(restoreIdx, 1);
				if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
				settings.hooks[event].push(restored);
				deduplicateHooks(settings, event);
				await writeSettings(P, settings);
				json(res, 0, `已還原 hook 至 ${event}`, {
					event,
					hooks: settings.hooks[event],
					disabledHooks: settings._abTao.disabledHooks[event],
				});
			} else {
				// 就地更新 command / matcher（in-place update）
				const hook = hooksArr[idx];
				if (command !== undefined) hook.command = command;
				if (matcher !== undefined) hook.matcher = matcher;
				deduplicateHooks(settings, event);
				await writeSettings(P, settings);
				json(res, 0, `已更新 ${event}[${idx}]`, {
					event,
					hooks: settings.hooks[event],
				});
			}
		});
		return true;
	}

	// ── DELETE /api/settings/hooks/:event/:idx（永久刪除 hook） ──
	const hookDeleteMatch = url.pathname.match(
		/^\/api\/settings\/hooks\/([^/]+)\/(\d+)$/,
	);
	if (req.method === "DELETE" && hookDeleteMatch) {
		if (rejectUntrusted(req, res, json)) return true;

		const event = decodeURIComponent(hookDeleteMatch[1]);
		const idx = parseInt(hookDeleteMatch[2], 10);
		if (Number.isNaN(idx) || idx < 0) {
			json(res, 400, "idx 必須為非負整數", { code: "INVALID_IDX" }, 400);
			return true;
		}

		await withLock(res, json, async () => {
			if (await backupOrFail(P, res, json)) return;
			const settings = await readSettings(P);
			const hooksArr = settings.hooks?.[event];

			if (!Array.isArray(hooksArr) || idx >= hooksArr.length) {
				json(
					res,
					400,
					`idx ${idx} 超出範圍（目前共 ${hooksArr?.length ?? 0} 個 hook）`,
					{ code: "IDX_OUT_OF_RANGE" },
					400,
				);
				return;
			}

			const [removed] = hooksArr.splice(idx, 1);
			await writeSettings(P, settings);
			json(res, 0, `已永久刪除 ${event}[${idx}]`, {
				event,
				removed,
				hooks: hooksArr,
			});
		});
		return true;
	}

	// ── GET /api/preferences ──
	if (req.method === "GET" && url.pathname === "/api/preferences") {
		try {
			const { PREF_DEFAULTS, readPrefsFromDisk } = await getPrefsUtils();
			const prefs = readPrefsFromDisk();
			json(res, 0, "ok", { prefs, defaults: PREF_DEFAULTS });
		} catch {
			json(res, 500, "讀取 preferences 失敗", null, 500);
		}
		return true;
	}

	// ── PUT /api/preferences ──
	if (req.method === "PUT" && url.pathname === "/api/preferences") {
		try {
			const { deployZshPrefs, deployHookPrefs } = await getPrefsUtils();
			const prefs = req._body ?? {};
			deployZshPrefs(prefs);
			deployHookPrefs(prefs);
			json(res, 0, "Preferences 已部署", null);
		} catch (err) {
			json(res, 500, err.message, null, 500);
		}
		return true;
	}

	return false;
}
