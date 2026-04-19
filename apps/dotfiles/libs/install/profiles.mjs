/**
 * profiles.mjs — Multi-profile 管理（Phase 11′）
 *
 * profile 存放於 ~/.claude/.ab-tao/profiles/
 *   active.json        — {"profile": "personal"}
 *   personal.yml       — 個人開發環境配置
 *   work.yml           — 公司環境（限制外部 MCP、強化安全）
 *   oss.yml            — 開源貢獻環境
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { P } from "../core/paths.mjs";

const PROFILES_DIR = path.join(P.abTaoDir, "profiles");
const ACTIVE_FILE = path.join(PROFILES_DIR, "active.json");

export const BUILTIN_PROFILES = ["personal", "work", "oss"];

/** 確保 profiles 目錄存在 */
function ensureProfilesDir() {
	if (!fs.existsSync(PROFILES_DIR)) {
		fs.mkdirSync(PROFILES_DIR, { recursive: true });
	}
}

/**
 * 讀取當前 active profile 名稱
 * @returns {string} profile 名稱（預設 "personal"）
 */
export function loadActiveProfile() {
	try {
		const raw = fs.readFileSync(ACTIVE_FILE, "utf8");
		return JSON.parse(raw).profile ?? "personal";
	} catch {
		return "personal";
	}
}

/**
 * 設定 active profile
 * @param {string} name
 */
export function setActiveProfile(name) {
	ensureProfilesDir();
	fs.writeFileSync(
		ACTIVE_FILE,
		JSON.stringify({ profile: name }, null, 2),
		"utf8",
	);
}

/**
 * 列出所有可用 profile（已存在的 yml 檔）
 * @returns {string[]}
 */
export function listProfiles() {
	ensureProfilesDir();
	const existing = fs.existsSync(PROFILES_DIR)
		? fs
				.readdirSync(PROFILES_DIR)
				.filter((f) => f.endsWith(".yml"))
				.map((f) => f.replace(/\.yml$/, ""))
		: [];
	// 合併內建 + 自訂，去重
	return [...new Set([...BUILTIN_PROFILES, ...existing])];
}

/**
 * 讀取指定 profile 的 YAML 配置
 * @param {string} name
 * @returns {Record<string, unknown> | null}
 */
export function loadProfile(name) {
	const ymlPath = path.join(PROFILES_DIR, `${name}.yml`);
	if (!fs.existsSync(ymlPath)) return null;
	try {
		return parseYaml(fs.readFileSync(ymlPath, "utf8")) ?? {};
	} catch {
		return null;
	}
}

/**
 * 初始化預設 profile 檔（若不存在）
 * 從 ab-tao source templates 複製
 * @param {string} templatesDir  ab-tao 的 profile templates 目錄
 */
export function initDefaultProfiles(templatesDir) {
	ensureProfilesDir();

	// 初始化 active.json（若不存在）
	if (!fs.existsSync(ACTIVE_FILE)) {
		setActiveProfile("personal");
	}

	if (!fs.existsSync(templatesDir)) return;

	for (const name of BUILTIN_PROFILES) {
		const src = path.join(templatesDir, `${name}.yml`);
		const dst = path.join(PROFILES_DIR, `${name}.yml`);
		if (fs.existsSync(src) && !fs.existsSync(dst)) {
			fs.copyFileSync(src, dst);
		}
	}
}

/**
 * 取得 profile 的 plugin overrides（供 plugin-manager 使用）
 * @param {string} profile
 * @param {Record<string, unknown>} pluginsYml plugins.yml 的 profile_overrides 區塊
 * @returns {{ disable: string[], enable: string[] }}
 */
export function getProfilePluginOverrides(profile, pluginsYml) {
	const overrides = pluginsYml?.profile_overrides?.[profile] ?? {};
	return {
		disable: overrides.disable ?? [],
		enable: overrides.enable ?? [],
	};
}
