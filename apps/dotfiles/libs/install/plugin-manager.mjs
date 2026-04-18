import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { P } from "../core/paths.mjs";

const PLUGINS_YML = path.join(import.meta.dirname, "../../claude/plugins.yml");

/** 讀取 plugins.yml 宣告 */
export function loadPluginsYml() {
	const raw = fs.readFileSync(PLUGINS_YML, "utf8");
	return parseYaml(raw);
}

/**
 * 取得 settings.json 的 enabledPlugins
 * @returns {Record<string, boolean>}
 */
export function getEnabledPlugins() {
	try {
		const raw = fs.readFileSync(P.settings, "utf8");
		return JSON.parse(raw).enabledPlugins ?? {};
	} catch {
		return {};
	}
}

/**
 * 驗證 enabledPlugins 無 phantom（enabled=true 但 plugins.yml 中無宣告）
 * @returns {{ phantoms: string[], valid: string[] }}
 */
export function verifyPluginIntegrity() {
	const { plugins } = loadPluginsYml();
	const enabled = getEnabledPlugins();
	const declared = new Set(
		Object.keys(plugins).map(
			(name) =>
				`${name}@${plugins[name].marketplace ?? "claude-plugins-official"}`,
		),
	);

	const phantoms = [];
	const valid = [];
	for (const [key, isEnabled] of Object.entries(enabled)) {
		if (!isEnabled) continue;
		if (declared.has(key)) {
			valid.push(key);
		} else {
			phantoms.push(key);
		}
	}
	return { phantoms, valid };
}

/**
 * 列出所有宣告的 plugin 及其狀態
 */
export function listPlugins() {
	const { plugins } = loadPluginsYml();
	const enabled = getEnabledPlugins();
	return Object.entries(plugins).map(([name, cfg]) => {
		const key = `${name}@${cfg.marketplace ?? "claude-plugins-official"}`;
		return {
			name,
			key,
			declared: cfg.enabled !== false,
			installed: key in enabled,
			active: enabled[key] === true,
			description: cfg.description ?? "",
		};
	});
}

/**
 * 同步 plugins：安裝缺失的（dry-run 模式僅印出）
 * @param {{ dryRun?: boolean, profile?: string }} opts
 */
export function syncPlugins({ dryRun = false, profile } = {}) {
	const { plugins, profile_overrides } = loadPluginsYml();
	const overrides = profile ? profile_overrides?.[profile] : undefined;
	const results = { installed: [], skipped: [] };

	for (const [name, cfg] of Object.entries(plugins)) {
		const marketplace = cfg.marketplace ?? "claude-plugins-official";
		let shouldEnable = cfg.enabled !== false;

		if (overrides?.disable?.includes(name)) shouldEnable = false;
		if (overrides?.enable?.includes(name)) shouldEnable = true;

		if (!shouldEnable) continue;

		const key = `${name}@${marketplace}`;
		const installed = key in getEnabledPlugins();

		if (installed) {
			results.skipped.push(key);
		} else if (dryRun) {
			console.log(`[dry-run] 將安裝：${key}`);
		} else {
			try {
				execFileSync(
					"claude",
					["plugin", "install", name, "--marketplace", marketplace],
					{
						stdio: "inherit",
					},
				);
				results.installed.push(key);
			} catch (err) {
				console.error(`安裝失敗：${key}`, err.message);
			}
		}
	}

	return results;
}
