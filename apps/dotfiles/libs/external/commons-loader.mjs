/**
 * Commons 資源載入器
 *
 * 掃描 @ab-tao/commons 已同步的所有 AI 來源（7 個），
 * 將 commands/agents/rules/skills 統一載入供 pipeline 使用。
 */

import fs from "node:fs";
import path from "node:path";
import { TECH_TO_LANG } from "@ab-tao/commons/detect";
import { RESOURCES_DIR } from "@ab-tao/commons/paths";

// 計算 commands 資源時排除的非資源檔名
const EXCLUDED_FILENAMES = [
	"SKILL.md",
	"README.md",
	"CHANGELOG.md",
	"LICENSE.md",
];

/**
 * 各來源的安裝模式元資料
 * 鏡像自 packages/commons/scripts/sync-sources.mjs 的 SOURCES_CONFIG.installMode 欄位。
 * sync-sources.mjs 包含 CLI 入口點（module-level side effects），無法安全直接 import，
 * 故在此維護一份僅含 installMode 相關欄位的精簡副本。
 *
 * plugin 模式：資源透過 Claude Code 官方 plugin marketplace 安裝
 * copy 模式：資源直接複製至 ~/.claude/ 目錄
 */
const SOURCE_INSTALL_MODES = {
	ecc: {
		installMode: "plugin",
		pluginId: "everything-claude-code",
		pluginMarketplace: "https://github.com/affaan-m/everything-claude-code",
	},
	anthropic: {
		installMode: "plugin",
		pluginId: "anthropic-skills",
		pluginMarketplace: "https://github.com/anthropics/skills",
	},
	superpowers: {
		installMode: "plugin",
		pluginId: "superpowers",
		pluginMarketplace: "https://github.com/obra/superpowers",
	},
	bmad: {
		installMode: "plugin",
		pluginId: "bmad-method",
		pluginMarketplace: "https://github.com/bmad-code-org/BMAD-METHOD",
	},
	"context-engineering": { installMode: "copy" },
	"skills-mp": { installMode: "copy" },
	openskills: { installMode: "copy" },
	gstack: { installMode: "copy" },
	"spec-kit": { installMode: "copy" },
	"ai-sdlc": { installMode: "copy" },
};

/**
 * 讀取來源的安裝模式資訊
 * @param {string} sourceName - 來源名稱（如 'ecc', 'anthropic'）
 * @returns {{ installMode: "plugin" | "copy", pluginId?: string, pluginMarketplace?: string }}
 */
export function getSourceInstallMode(sourceName) {
	return SOURCE_INSTALL_MODES[sourceName] ?? { installMode: "copy" };
}

/**
 * 讀取 source 目錄內的 _ab-tao-paths.json manifest
 * @param {string} sourceDir - 來源目錄絕對路徑
 * @returns {{ resourcePaths?: Record<string, string | string[]> }}
 */
function readResourcePaths(sourceDir) {
	try {
		const manifestPath = path.join(sourceDir, "_ab-tao-paths.json");
		const raw = fs.readFileSync(manifestPath, "utf8");
		return JSON.parse(raw);
	} catch {
		return { resourcePaths: {} };
	}
}

/**
 * 從目錄中載入所有 .md 檔案（排除 EXCLUDED_FILENAMES）
 * @returns {{ name: string, content: string }[]}
 */
function loadMdFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md") && !EXCLUDED_FILENAMES.includes(f))
		.map((f) => ({
			name: f,
			content: fs.readFileSync(path.join(dir, f), "utf8"),
		}));
}

// manifest resourcePaths[key] 可能是 string 或 string[]，統一回傳 string[]
function resolveSubPaths(customPaths, key, fallback) {
	const v = customPaths[key] ?? fallback;
	return Array.isArray(v) ? v : [v];
}

/**
 * 從單一 source 目錄載入所有資源
 * 優先讀取 _ab-tao-paths.json manifest 中的自訂路徑（resourcePaths）
 * @param {string} sourceName - 來源名稱（如 'ecc', 'anthropic'）
 * @returns {{ name: string, commands: array, agents: array, rules: array, skills: array, pluginMode?: boolean, pluginId?: string } | null}
 */
function loadSource(sourceName) {
	const sourceDir = path.join(RESOURCES_DIR, sourceName);
	if (!fs.existsSync(sourceDir)) return null;

	const manifest = readResourcePaths(sourceDir);
	const customPaths = manifest.resourcePaths ?? {};

	const collect = (key) => {
		let acc = [];
		for (const sub of resolveSubPaths(customPaths, key, key)) {
			acc = acc.concat(loadMdFiles(path.join(sourceDir, sub)));
		}
		return acc;
	};

	const result = {
		name: sourceName,
		commands: collect("commands"),
		agents: collect("agents"),
		rules: collect("rules"),
		skills: [],
	};

	// 注入 plugin 模式標記（供呼叫端識別 plugin-mode 來源）
	const installInfo = getSourceInstallMode(sourceName);
	if (installInfo.installMode === "plugin") {
		result.pluginMode = true;
		if (installInfo.pluginId) {
			result.pluginId = installInfo.pluginId;
		}
	}

	// 掃描 skills 目錄（SKILL.md 格式，支援多根目錄合併）
	for (const sub of resolveSubPaths(customPaths, "skills", "skills")) {
		const skillsDir = path.join(sourceDir, sub);
		if (!fs.existsSync(skillsDir)) continue;
		for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
			if (fs.existsSync(skillMd)) {
				result.skills.push({
					name: entry.name,
					content: fs.readFileSync(skillMd, "utf8"),
				});
			}
		}
	}

	return result;
}

/**
 * 載入 commons 中所有已同步的 AI 來源
 * @returns {{ sources: object[], stats: { total: number, loaded: number, resources: number } }}
 */
export function loadAllCommonsResources() {
	if (!fs.existsSync(RESOURCES_DIR)) {
		return { sources: [], stats: { total: 0, loaded: 0, resources: 0 } };
	}

	const entries = fs.readdirSync(RESOURCES_DIR, { withFileTypes: true });
	const sources = [];
	let totalResources = 0;

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const source = loadSource(entry.name);
		if (!source) continue;

		const count =
			source.commands.length +
			source.agents.length +
			source.rules.length +
			source.skills.length;
		if (count > 0) {
			sources.push(source);
			totalResources += count;
		}
	}

	return {
		sources,
		stats: {
			total: entries.filter((e) => e.isDirectory()).length,
			loaded: sources.length,
			resources: totalResources,
		},
	};
}

// ── 語言前綴（用於篩選語言特定資源）────────────────────────────────
const LANG_PREFIXES = [...new Set(Object.values(TECH_TO_LANG))].map(
	(l) => `${l}-`,
);

/**
 * 判斷檔案名是否匹配技術棧
 * - 有語言前綴 → 只有技術棧對應的語言才匹配
 * - 無語言前綴 → 只匹配 "通用" 類型的資源（名稱不含框架特定關鍵字）
 */
const FRAMEWORK_KEYWORDS = new Set([
	"vue",
	"react",
	"angular",
	"svelte",
	"next",
	"nuxt",
	"flutter",
	"dart",
	"swift",
	"kotlin",
	"java",
	"python",
	"rust",
	"go",
	"cpp",
	"php",
	"ruby",
	"django",
	"rails",
	"express",
	"fastapi",
	"spring",
	"laravel",
	"nest",
	"android",
	"pytorch",
	"csharp",
	"dotnet",
	"perl",
]);

function matchesTechStack(fileName, matchedLangs) {
	const name = fileName.replace(".md", "");
	// 有語言前綴 → 精確匹配
	for (const prefix of LANG_PREFIXES) {
		if (name.startsWith(prefix)) {
			return matchedLangs.has(prefix.replace(/-$/, ""));
		}
	}
	// 無語言前綴 → 檢查名稱是否包含框架關鍵字
	const nameLower = name.toLowerCase();
	for (const kw of FRAMEWORK_KEYWORDS) {
		if (nameLower.includes(kw)) {
			// 名稱含框架關鍵字 → 只在對應技術棧存在時匹配
			return matchedLangs.has(kw);
		}
	}
	return true; // 純通用資源（如 code-review、docs）仍匹配
}

/**
 * 根據偵測到的技術棧過濾 commons 資源
 *
 * @param {{ sources: object[] }} commonsResources - loadAllCommonsResources 回傳值
 * @param {string[]} detectedTechs - 偵測到的技術棧 ID（如 ['typescript', 'vue', 'nuxt']）
 * @returns {{ sources: object[], stats: { filtered: number, total: number } }}
 */
export function filterByTechStack(commonsResources, detectedTechs) {
	// 建立語言集合
	const matchedLangs = new Set();
	for (const tech of detectedTechs) {
		const lang = TECH_TO_LANG[tech.toLowerCase()];
		if (lang) matchedLangs.add(lang);
	}

	let filtered = 0;
	let total = 0;

	const filteredSources = commonsResources.sources.map((src) => {
		const commands = src.commands.filter((f) => {
			total++;
			if (matchesTechStack(f.name, matchedLangs)) {
				filtered++;
				return true;
			}
			return false;
		});
		const agents = src.agents.filter((f) => {
			total++;
			if (matchesTechStack(f.name, matchedLangs)) {
				filtered++;
				return true;
			}
			return false;
		});
		const rules = src.rules.filter((f) => {
			total++;
			if (matchesTechStack(f.name, matchedLangs)) {
				filtered++;
				return true;
			}
			return false;
		});
		// skills 也按技術棧過濾（名稱含框架關鍵字時排除不匹配的）
		const skills = src.skills.filter((f) => {
			total++;
			if (matchesTechStack(f.name, matchedLangs)) {
				filtered++;
				return true;
			}
			return false;
		});

		return { ...src, commands, agents, rules, skills };
	});

	return {
		sources: filteredSources.filter(
			(s) =>
				s.commands.length + s.agents.length + s.rules.length + s.skills.length >
				0,
		),
		stats: { filtered, total },
	};
}
