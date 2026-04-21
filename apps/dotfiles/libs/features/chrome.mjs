/**
 * Chrome Feature — macOS Chrome 優化配置 pipeline
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 * 僅支援 macOS，不依賴任何其他 feature。
 *
 * 涵蓋元件：
 *   flags    — 實驗性 flag（Local State browser.enabled_labs_experiments）
 *   memory   — 記憶體偏好（Default/Preferences）
 *   search   — 搜尋引擎（Web Data sqlite3 keywords table）
 *   zsh      — 35-chrome.zsh → ~/.zshrc.d/conf/
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import { BACK, handleCancel } from "../cli/prompts.mjs";
import { HOME } from "../core/paths.mjs";

// ── Chrome 路徑常數 ───────────────────────────────────────────────
const CHROME_APP = "/Applications/Google Chrome.app";
const CHROME_SUPPORT = path.join(
	HOME,
	"Library/Application Support/Google/Chrome",
);
const LOCAL_STATE = path.join(CHROME_SUPPORT, "Local State");
const DEFAULT_PREFS = path.join(CHROME_SUPPORT, "Default/Preferences");
const WEB_DATA = path.join(CHROME_SUPPORT, "Default/Web Data");

// ── 元件描述 ──────────────────────────────────────────────────────
const COMPONENT_DESCRIPTIONS = {
	flags: "實驗性 Flag（chrome://flags 等效批量配置）",
	memory: "記憶體優化（分頁丟棄閾值 · 後臺限制）",
	search: "自訂搜尋引擎（關鍵字 + URL template 批量匯入）",
	zsh: "ZSH 工具模組（35-chrome.zsh → ~/.zshrc.d/conf/）",
	mcp: "Chrome DevTools MCP（Lighthouse · 記憶體洩漏偵測 · 無障礙除錯）",
};

export default {
	id: "chrome",
	label: "🌐 Chrome 優化配置",
	hint: "flags · 搜尋引擎 · 記憶體優化 · ZSH 工具",
	dependsOn: [],
	conflicts: [],

	/**
	 * 1. 環境檢查
	 *    - macOS 限定
	 *    - Chrome app 是否存在
	 *    - sqlite3 是否可用（搜尋引擎功能需要）
	 */
	async envCheck() {
		if (process.platform !== "darwin") {
			return { ok: false, message: "Chrome feature 僅支援 macOS" };
		}

		const checks = [];

		// Chrome app
		if (fs.existsSync(CHROME_APP)) {
			checks.push("Google Chrome ✅");
		} else {
			checks.push(
				"Google Chrome ❌ （未安裝，請至 https://www.google.com/chrome 下載）",
			);
			return { ok: false, message: checks.join(" · ") };
		}

		// sqlite3（搜尋引擎功能需要）
		try {
			const { execFileSync } = await import("node:child_process");
			execFileSync("which", ["sqlite3"], { stdio: "pipe" });
			checks.push("sqlite3 ✅");
		} catch {
			checks.push("sqlite3 ❌ （搜尋引擎功能將跳過）");
		}

		return { ok: true, message: checks.join(" · ") };
	},

	/**
	 * 2. 備份
	 *    - Local State（flags 修改目標）
	 *    - Default/Preferences（memory 修改目標）
	 */
	async backup(ctx) {
		const backupDir = ctx.backupDir;
		fs.mkdirSync(backupDir, { recursive: true });
		const backed = [];

		const tryBackup = (src, name) => {
			if (fs.existsSync(src)) {
				const dest = path.join(backupDir, name);
				fs.mkdirSync(path.dirname(dest), { recursive: true });
				fs.copyFileSync(src, dest);
				backed.push(name);
			}
		};

		tryBackup(LOCAL_STATE, "Local State");
		tryBackup(DEFAULT_PREFS, "Preferences");

		return { files: backed, dir: backupDir };
	},

	/**
	 * 3. 互動配置（元件多選）
	 */
	async configure(ctx) {
		const components = ["flags", "memory", "search", "zsh", "mcp"];

		if (ctx.flags?.all) {
			return { components };
		}

		if (ctx.flags?.quick) {
			const prevComponents = ctx.prev?.install?.components;
			if (prevComponents?.length) return { components: prevComponents };
			return { components }; // fallback 全選
		}

		const items = components.map((c) => ({
			value: c,
			label: c,
			hint: COMPONENT_DESCRIPTIONS[c] || c,
		}));

		const selected = handleCancel(
			await p.multiselect({
				message: "選擇要配置的 Chrome 元件",
				options: items,
				initialValues: components,
				required: false,
			}),
		);

		if (selected === BACK || isEmpty(selected)) {
			return null;
		}

		return { components: selected };
	},

	/**
	 * 4. 生成計畫
	 */
	async plan(ctx, config) {
		if (!config) return null;

		return {
			features: ["chrome"],
			targets: ["chrome"],
			components: config.components,
			mode: ctx.flags?.manual ? "manual" : "auto",
		};
	},

	/**
	 * 5. 確認
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		const lines = [
			`Chrome 元件（${plan.components.length} 個）`,
			...plan.components.map(
				(c) => `  · ${c} — ${COMPONENT_DESCRIPTIONS[c] || ""}`,
			),
		];

		// flags 修改前警告 Chrome 必須關閉
		if (
			plan.components.includes("flags") ||
			plan.components.includes("memory")
		) {
			lines.push("");
			lines.push("  🛑 修改 Local State / Preferences 前請關閉 Chrome");
		}

		p.log.info(lines.join("\n"));

		const ok = handleCancel(
			await p.confirm({
				message: "確認安裝？",
				initialValue: true,
			}),
		);

		return ok === true;
	},

	/**
	 * 6. 安裝
	 */
	async install(ctx, plan) {
		if (!plan) return null;

		const results = { components: [], skipped: [] };

		// ── flags ─────────────────────────────────────────────────────
		if (plan.components.includes("flags")) {
			try {
				const flagsConfigPath = path.join(
					ctx.repoDir,
					"chrome/config/flags.json",
				);

				if (!fs.existsSync(flagsConfigPath)) {
					p.log.warn(`flags.json 未找到：${flagsConfigPath}，跳過。`);
					results.skipped.push("flags（config 缺失）");
				} else if (!fs.existsSync(LOCAL_STATE)) {
					p.log.warn("Local State 檔案不存在，跳過 flags。");
					results.skipped.push("flags（Local State 缺失）");
				} else {
					const flagsConfig = JSON.parse(
						fs.readFileSync(flagsConfigPath, "utf8"),
					);
					const raw = fs.readFileSync(LOCAL_STATE, "utf8");
					const state = JSON.parse(raw);
					const currentExps = new Set(
						state.browser?.enabled_labs_experiments ?? [],
					);
					const targetExps = flagsConfig.experiments ?? [];
					const allPresent = targetExps.every((exp) => currentExps.has(exp));

					if (allPresent) {
						results.components.push("flags（已是最新，跳過）");
					} else {
						// 內容有差異，才需要檢查 Chrome 是否執行中
						const { execFileSync } = await import("node:child_process");
						let chromeRunning = false;
						try {
							execFileSync("pgrep", ["-x", "Google Chrome"], { stdio: "pipe" });
							chromeRunning = true;
						} catch {
							chromeRunning = false;
						}

						if (chromeRunning) {
							p.log.warn(
								"Chrome 仍在執行中，flags 修改已跳過。\n  👉 請先關閉 Chrome 後重新執行 d:chrome setup。",
							);
							results.skipped.push("flags（Chrome 執行中）");
						} else {
							// 原子寫入
							state.browser ??= {};
							state.browser.enabled_labs_experiments ??= [];
							const existing = new Set(state.browser.enabled_labs_experiments);
							for (const exp of targetExps) existing.add(exp);
							state.browser.enabled_labs_experiments = [...existing];

							const tmp = `${LOCAL_STATE}.tmp`;
							fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
							fs.renameSync(tmp, LOCAL_STATE);

							results.components.push("flags");
						}
					}
				}
			} catch (err) {
				p.log.warn(`flags 安裝失敗：${err.message}`);
				results.skipped.push(`flags（錯誤：${err.message}）`);
			}
		}

		// ── memory ────────────────────────────────────────────────────
		if (plan.components.includes("memory")) {
			try {
				const memoryConfigPath = path.join(
					ctx.repoDir,
					"chrome/config/memory.json",
				);

				if (!fs.existsSync(memoryConfigPath)) {
					p.log.warn(`memory.json 未找到：${memoryConfigPath}，跳過。`);
					results.skipped.push("memory（config 缺失）");
				} else if (!fs.existsSync(DEFAULT_PREFS)) {
					p.log.warn("Default/Preferences 不存在，跳過 memory。");
					results.skipped.push("memory（Preferences 缺失）");
				} else {
					const memConfig = JSON.parse(
						fs.readFileSync(memoryConfigPath, "utf8"),
					);
					const raw = fs.readFileSync(DEFAULT_PREFS, "utf8");
					const prefs = JSON.parse(raw);

					if (_isDeepSubset(memConfig, prefs)) {
						results.components.push("memory（已是最新，跳過）");
					} else {
						// 內容有差異，才需要檢查 Chrome 是否執行中
						const { execFileSync } = await import("node:child_process");
						let chromeRunning = false;
						try {
							execFileSync("pgrep", ["-x", "Google Chrome"], { stdio: "pipe" });
							chromeRunning = true;
						} catch {
							chromeRunning = false;
						}

						if (chromeRunning) {
							p.log.warn("Chrome 仍在執行中，memory 修改已跳過。");
							results.skipped.push("memory（Chrome 執行中）");
						} else {
							// 深度合併到 Preferences
							deepMerge(prefs, memConfig);

							// 原子寫入
							const tmp = `${DEFAULT_PREFS}.tmp`;
							fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2));
							fs.renameSync(tmp, DEFAULT_PREFS);

							results.components.push("memory");
						}
					}
				}
			} catch (err) {
				p.log.warn(`memory 安裝失敗：${err.message}`);
				results.skipped.push(`memory（錯誤：${err.message}）`);
			}
		}

		// ── search ────────────────────────────────────────────────────
		if (plan.components.includes("search")) {
			try {
				// 確認 sqlite3 可用
				const { execFileSync } = await import("node:child_process");
				let sqlite3Available = false;
				try {
					execFileSync("which", ["sqlite3"], { stdio: "pipe" });
					sqlite3Available = true;
				} catch {
					sqlite3Available = false;
				}

				if (!sqlite3Available) {
					p.log.warn("sqlite3 不可用，搜尋引擎功能跳過。");
					results.skipped.push("search（sqlite3 不可用）");
				} else {
					const searchConfigPath = path.join(
						ctx.repoDir,
						"chrome/config/search-engines.json",
					);

					if (!fs.existsSync(searchConfigPath)) {
						p.log.warn(
							`search-engines.json 未找到：${searchConfigPath}，跳過。`,
						);
						results.skipped.push("search（config 缺失）");
					} else if (!fs.existsSync(WEB_DATA)) {
						p.log.warn("Web Data 不存在，跳過搜尋引擎。");
						results.skipped.push("search（Web Data 缺失）");
					} else {
						const searchConfig = JSON.parse(
							fs.readFileSync(searchConfigPath, "utf8"),
						);

						let insertedCount = 0;
						for (const engine of searchConfig.engines ?? []) {
							try {
								// 檢查是否已存在相同 keyword
								const existing = execFileSync(
									"sqlite3",
									[
										WEB_DATA,
										`SELECT COUNT(*) FROM keywords WHERE keyword='${engine.keyword.replace(/'/g, "''")}';`,
									],
									{ stdio: "pipe" },
								)
									.toString()
									.trim();

								if (existing === "0") {
									// 插入新搜尋引擎
									const now = Date.now() * 1000; // microseconds
									execFileSync(
										"sqlite3",
										[
											WEB_DATA,
											`INSERT INTO keywords (short_name, keyword, favicon_url, url, safe_for_autoreplace, originating_url, date_created, usage_count, input_encodings, suggest_url, prepopulate_id, created_by_policy, last_modified, sync_guid, alternate_urls, image_url, search_url_post_params, suggest_url_post_params, image_url_post_params, new_tab_url, last_visited) VALUES ('${engine.name.replace(/'/g, "''")}', '${engine.keyword.replace(/'/g, "''")}', '', '${engine.url.replace(/'/g, "''")}', 1, '', ${now}, 0, 'UTF-8', '', 0, 0, ${now}, '${generateGuid()}', '', '', '', '', '', '', ${now});`,
										],
										{ stdio: "pipe" },
									);
									insertedCount++;
								}
							} catch {
								// 單筆失敗不阻塞其他
							}
						}

						if (insertedCount > 0) {
							results.components.push(`search（+${insertedCount} 筆）`);
						} else {
							results.components.push("search（無新增，已是最新）");
						}
					}
				}
			} catch (err) {
				p.log.warn(`search 安裝失敗：${err.message}`);
				results.skipped.push(`search（錯誤：${err.message}）`);
			}
		}

		// ── zsh ───────────────────────────────────────────────────────
		if (plan.components.includes("zsh")) {
			try {
				const srcZsh = path.join(ctx.repoDir, "zsh/modules/35-chrome.zsh");
				const destDir = path.join(HOME, ".zshrc.d/conf");
				const destZsh = path.join(destDir, "35-chrome.zsh");

				if (!fs.existsSync(srcZsh)) {
					p.log.warn(`35-chrome.zsh 未找到：${srcZsh}，跳過。`);
					results.skipped.push("zsh（source 缺失）");
				} else {
					// 檢查 symlink 是否已正確指向 srcZsh
					let alreadyCorrect = false;
					try {
						alreadyCorrect =
							fs.existsSync(destZsh) &&
							fs.lstatSync(destZsh).isSymbolicLink() &&
							fs.readlinkSync(destZsh) === srcZsh;
					} catch {
						alreadyCorrect = false;
					}

					if (alreadyCorrect) {
						results.components.push("zsh（已配置，跳過）");
					} else {
						fs.mkdirSync(destDir, { recursive: true });
						// 若舊有相對 symlink（可能是壞掉的）先移除，再建絕對 symlink
						try {
							fs.unlinkSync(destZsh);
						} catch {
							/* 不存在則略過 */
						}
						fs.symlinkSync(srcZsh, destZsh);
						results.components.push("zsh");
					}
				}
			} catch (err) {
				p.log.warn(`zsh 安裝失敗：${err.message}`);
				results.skipped.push(`zsh（錯誤：${err.message}）`);
			}
		}

		// ── mcp ───────────────────────────────────────────────────────
		if (plan.components.includes("mcp")) {
			try {
				const { execFileSync } = await import("node:child_process");
				execFileSync(
					"claude",
					[
						"mcp",
						"add",
						"chrome-devtools",
						"--scope",
						"user",
						"--",
						"npx",
						"-y",
						"chrome-devtools-mcp@latest",
					],
					{ stdio: "pipe" },
				);
				results.components.push("mcp");
			} catch (err) {
				// claude CLI 不存在或已存在同名 server（idempotent）
				const msg = err.stderr?.toString().trim() || err.message;
				if (msg.includes("already exists") || msg.includes("已存在")) {
					results.components.push("mcp（已存在，略過）");
				} else {
					p.log.warn(`chrome-devtools MCP 安裝失敗：${msg}`);
					results.skipped.push(`mcp（錯誤：${msg}）`);
				}
			}
		}

		return results;
	},

	/**
	 * 7. 驗證
	 */
	async verify(_ctx, installResult) {
		let passed = 0;
		let total = 0;
		const missing = [];

		// 驗證 zsh 模組
		total++;
		const zshDest = path.join(HOME, ".zshrc.d/conf/35-chrome.zsh");
		if (fs.existsSync(zshDest)) {
			passed++;
		} else {
			missing.push("35-chrome.zsh");
		}

		// 驗證 mcp（若有安裝）
		if (installResult?.components?.some((c) => c.startsWith("mcp"))) {
			total++;
			try {
				const { execFileSync } = await import("node:child_process");
				const out = execFileSync("claude", ["mcp", "list"], {
					stdio: "pipe",
				}).toString();
				if (out.includes("chrome-devtools")) passed++;
				else missing.push("chrome-devtools MCP（未出現在 claude mcp list）");
			} catch {
				missing.push("chrome-devtools MCP（claude CLI 不可用）");
			}
		}

		// 驗證 flags（若有安裝）
		if (installResult?.components?.includes("flags")) {
			total++;
			if (fs.existsSync(LOCAL_STATE)) {
				try {
					const state = JSON.parse(fs.readFileSync(LOCAL_STATE, "utf8"));
					const hasExps =
						Array.isArray(state.browser?.enabled_labs_experiments) &&
						state.browser.enabled_labs_experiments.length > 0;
					if (hasExps) passed++;
					else missing.push("Local State experiments 為空");
				} catch {
					missing.push("Local State 解析失敗");
				}
			} else {
				missing.push("Local State");
			}
		}

		return { passed, total, missing };
	},

	/**
	 * 8. 完成輸出
	 */
	complete(results) {
		if (!results) return [];

		const lines = ["🌐 Chrome 優化配置"];

		if (results.components?.length > 0) {
			lines.push(`  ✅ 已配置：${results.components.join("、")}`);
		}
		if (results.skipped?.length > 0) {
			lines.push(`  ⚡ 跳過：${results.skipped.join("、")}`);
		}

		const zshDest = path.join(HOME, ".zshrc.d/conf/35-chrome.zsh");
		if (fs.existsSync(zshDest)) {
			lines.push("  💡 執行 exec zsh 立即套用 Chrome ZSH 工具");
		}

		return lines;
	},

	/**
	 * 9. 回滾
	 */
	async rollback(ctx) {
		const backupDir = ctx.backupDir;
		if (!fs.existsSync(backupDir)) return;

		const restore = (name, dest) => {
			const src = path.join(backupDir, name);
			if (fs.existsSync(src)) {
				fs.mkdirSync(path.dirname(dest), { recursive: true });
				fs.copyFileSync(src, dest);
			}
		};

		restore("Local State", LOCAL_STATE);
		restore("Preferences", DEFAULT_PREFS);
	},

	/**
	 * 10. Session 數據
	 */
	session(results) {
		return {
			components: results?.components || [],
			installedAt: new Date().toISOString(),
		};
	},

	/**
	 * 11. 清理
	 */
	async cleanup(ctx) {
		if (fs.existsSync(ctx.previewDir)) {
			fs.rmSync(ctx.previewDir, { recursive: true, force: true });
		}
	},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		return {
			feature: "chrome",
			components: results?.components || [],
			skipped: results?.skipped || [],
			target: "~/Library/Application Support/Google/Chrome/",
		};
	},
};

// ── 工具函式 ──────────────────────────────────────────────────────

/**
 * 深度合併（target 為可變，source 為唯讀）
 * 僅合併 plain object，其他類型直接覆寫。
 */
function deepMerge(target, source) {
	for (const [key, val] of Object.entries(source)) {
		if (
			val !== null &&
			typeof val === "object" &&
			!Array.isArray(val) &&
			typeof target[key] === "object" &&
			target[key] !== null &&
			!Array.isArray(target[key])
		) {
			deepMerge(target[key], val);
		} else {
			target[key] = val;
		}
	}
}

/**
 * 深度子集檢查：target 的每個 key/value 是否已存在於 source 中
 * 物件遞迴比對，primitives 用 === 比對。
 * 用於 memory 冪等檢查：若 memConfig 已完整包含在 Preferences 中，跳過寫入。
 */
function _isDeepSubset(target, source) {
	if (typeof target !== "object" || target === null) return target === source;
	if (typeof source !== "object" || source === null) return false;
	return Object.entries(target).every(([key, val]) => {
		if (!(key in source)) return false;
		if (val !== null && typeof val === "object" && !Array.isArray(val)) {
			return _isDeepSubset(val, source[key]);
		}
		return source[key] === val;
	});
}

/**
 * 生成 UUID v4（用於 sqlite3 sync_guid）
 */
function generateGuid() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
