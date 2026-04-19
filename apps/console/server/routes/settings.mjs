/**
 * settings.mjs — /api/settings/* / /api/preferences / /api/plugins/* 路由
 *
 * 讀寫 ~/.claude/settings.json 及偏好設定檔。
 * mutation 前自動備份。
 */

import { existsSync, mkdirSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function backupSettings(P) {
	if (!existsSync(P.settings)) return;
	const now = new Date();
	const stamp = now
		.toISOString()
		.slice(0, 16)
		.replace("T", "-")
		.replace(":", "-");
	const dir = path.join(P.abTaoDir, `backups/console-${stamp}`);
	mkdirSync(dir, { recursive: true });
	await copyFile(P.settings, path.join(dir, "settings.json"));
}

export async function settingsRouter(req, res, url, json) {
	const P = await getP();

	// ── GET /api/settings ──
	if (req.method === "GET" && url.pathname === "/api/settings") {
		const settings = await readSettings(P);
		json(res, 0, "ok", settings);
		return true;
	}

	// ── PATCH /api/settings/permissions ──
	if (req.method === "PATCH" && url.pathname === "/api/settings/permissions") {
		const { allow, deny } = req._body ?? {};
		if (!Array.isArray(allow) || !Array.isArray(deny)) {
			json(res, 400, "allow 與 deny 必須為陣列", null, 400);
			return true;
		}
		await backupSettings(P);
		const settings = await readSettings(P);
		if (!settings.permissions) settings.permissions = {};
		settings.permissions.allow = allow;
		settings.permissions.deny = deny;
		await writeSettings(P, settings);
		json(res, 0, "Permissions 已更新", { allow, deny });
		return true;
	}

	// ── PATCH /api/settings/ai ──
	if (req.method === "PATCH" && url.pathname === "/api/settings/ai") {
		const { model, effortLevel } = req._body ?? {};
		await backupSettings(P);
		const settings = await readSettings(P);
		if (model !== undefined) settings.model = model;
		if (effortLevel !== undefined) settings.effortLevel = effortLevel;
		await writeSettings(P, settings);
		json(res, 0, "AI 設定已更新", {
			model: settings.model,
			effortLevel: settings.effortLevel,
		});
		return true;
	}

	// ── PATCH /api/settings/statusline ──
	if (req.method === "PATCH" && url.pathname === "/api/settings/statusline") {
		const { command } = req._body ?? {};
		if (!command) {
			json(res, 400, "command 為必填", null, 400);
			return true;
		}
		await backupSettings(P);
		const settings = await readSettings(P);
		settings.statusLine = { type: "command", command };
		await writeSettings(P, settings);
		json(res, 0, "StatusLine 已更新", settings.statusLine);
		return true;
	}

	// ── PATCH /api/settings/plugins/:name/enabled ──
	const pluginMatch = url.pathname.match(
		/^\/api\/settings\/plugins\/(.+)\/enabled$/,
	);
	if (req.method === "PATCH" && pluginMatch) {
		const pluginName = decodeURIComponent(pluginMatch[1]);
		const { enabled } = req._body ?? {};
		if (typeof enabled !== "boolean") {
			json(res, 400, "enabled 必須為 boolean", null, 400);
			return true;
		}
		await backupSettings(P);
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
