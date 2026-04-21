#!/usr/bin/env node

/**
 * ab-tao v2.1 統一安裝 CLI
 *
 * 3 步流程：選 repos → 確認計畫 → 安裝
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";

// 並發 clack 操作會加多個 stdin/SIGINT listener，提高上限避免 MaxListenersExceeded
process.stdin.setMaxListeners(50);
process.setMaxListeners(50);

// 關閉 spinner 完成後的 │ 分隔線（多個並發 spinner 時輸出更緊湊）
p.updateSettings({ withGuide: false });

import { isEmpty } from "lodash-es";
import pc from "picocolors";
import { BACK, handleCancel } from "../libs/cli/prompts.mjs";
import { phaseHeader } from "../libs/cli/task-runner.mjs";
import {
	detectLegacyInstallation,
	runUpgrade,
} from "../libs/config/upgrade.mjs";
import { cleanOldBackups } from "../libs/core/backup.mjs";
import { APP_VERSION } from "../libs/core/constants.mjs";
import { env } from "../libs/core/env.mjs";
import { getDirname, HOME } from "../libs/core/paths.mjs";
import { checkIncompleteSession, loadSession } from "../libs/core/session.mjs";
import { ensureEnvironment } from "../libs/detect/doctor.mjs";
import { warmupCli } from "../libs/external/claude-cli.mjs";
import { withSpinner } from "../libs/ui/with-spinner.mjs";

const __dirname = getDirname(import.meta);
const REPO = path.resolve(__dirname, "..");
const PREVIEW_DIR = path.join(REPO, "dist", "preview");

/**
 * 檢查指定 pid 的程序是否仍在執行
 * signal 0 = 純存在性檢查，不發送實際信號
 */
function _isPidAlive(pid) {
	if (!pid || typeof pid !== "number") return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * 確保環境就緒：備份原始配置 + 環境檢查
 */
async function ensureSetupEnvironment() {
	// 備份原始配置（首次使用）
	const { ensureOriginalBackup } = await import("./backup-original.mjs");
	const origBackup = ensureOriginalBackup();
	if (origBackup && !isEmpty(origBackup)) {
		p.log.success(
			`首次使用：已備份原始配置 → ~/.ab-tao-original/\n${origBackup.map((r) => `  ${r}`).join("\n")}\n還原指令：pnpm run d:restore → 選擇「完全還原」`,
		);
	}

	// 環境檢查 + 預熱 CLI
	phaseHeader("🔍 環境檢查");
	const envReady = await ensureEnvironment();
	if (!envReady) return;
	warmupCli();
}

function loadConfig() {
	const cfgPath = path.join(REPO, "config.json");
	return fs.existsSync(cfgPath)
		? JSON.parse(fs.readFileSync(cfgPath, "utf8"))
		: { targets: {} };
}

function loadProjectFolders(config, session) {
	// 優先用 config.json 的 projectFolders，再用 session 保存的
	return config.projectFolders || session?.projectFolders || [];
}

function loadSources(configSources) {
	const srcEnv = env("ECC_SOURCES", "");
	if (!srcEnv) return configSources || [];
	return srcEnv
		.split(",")
		.map((entry) => {
			const [name, repo, priority] = entry.trim().split("|");
			if (!name || !repo) return null;
			return {
				name,
				repo,
				priority: parseInt(priority, 10) || 0,
				paths: {
					commands: "commands",
					agents: "agents",
					rules: "rules/{lang}",
					rulesCommon: "rules/common",
					hooks: "hooks/hooks.json",
				},
			};
		})
		.filter(Boolean);
}

async function main() {
	try {
		cleanOldBackups();
	} catch {
		/* best-effort */
	}
	const config = loadConfig();
	const targets = config.targets || {};
	const sources = loadSources(config.sources);
	const args = process.argv.slice(2);
	const flagAll = args.includes("--all");
	const flagManual = args.includes("--manual");
	let flagQuick = args.includes("--quick");
	const flagFromIcloud = args.includes("--from-icloud");
	const flagDryRun = args.includes("--dry-run");
	let prev = loadSession();
	let projectFolders = loadProjectFolders(config, prev);
	const selectedAiSources = prev?.selectedAiSources || [];

	// ── 互斥鎖：防止 Console 在 d:setup 執行期間寫入配置 ──
	const setupLockPath = path.join(HOME, ".claude", ".ab-tao", "state.lock");
	try {
		// 檢查是否有 stale lock（pid 不存在）
		if (fs.existsSync(setupLockPath)) {
			try {
				const existing = JSON.parse(fs.readFileSync(setupLockPath, "utf8"));
				const isAlive = _isPidAlive(existing.pid);
				if (isAlive) {
					console.error(
						`✗ d:setup 已在執行中（pid: ${existing.pid}，since: ${existing.since}）`,
					);
					process.exit(1);
				}
				// stale lock — 清理並繼續
				console.warn(
					`⚠ 偵測到 stale lock（pid: ${existing.pid} 已不存在），已清理`,
				);
			} catch {
				// 無法解析 — 視為 stale，繼續覆寫
			}
		}
		fs.writeFileSync(
			setupLockPath,
			JSON.stringify({
				owner: "ab-tao_setup",
				pid: process.pid,
				since: new Date().toISOString(),
			}),
			"utf8",
		);
	} catch (err) {
		// lock 寫入失敗不阻斷流程，僅警告
		console.warn(`⚠ 無法寫入 state.lock: ${err.message}`);
	}

	// 確保退出時清理 lock
	process.on("exit", () => {
		try {
			fs.unlinkSync(setupLockPath);
		} catch {
			/* 已被清除，忽略 */
		}
	});
	// SIGINT / SIGTERM 觸發 process.exit()，進而觸發 exit 事件完成清理
	process.on("SIGINT", () => process.exit(130));
	process.on("SIGTERM", () => process.exit(143));

	// ── ~/.zshrc 重複 loader 注入偵測 ──
	const zshrcPath = path.join(HOME, ".zshrc");
	if (fs.existsSync(zshrcPath)) {
		const zshrcContent = fs.readFileSync(zshrcPath, "utf8");
		// 計算起始標記出現次數（每個完整區塊只有一個起始標記）
		const startMarkerCount = (
			zshrcContent.match(/=== ab-tao:loader ===/g) ?? []
		).length;
		if (startMarkerCount >= 2) {
			p.log.warn(
				`⚠ ~/.zshrc 偵測到 ${startMarkerCount} 份 ab-tao:loader 注入，可能導致 ZSH 啟動緩慢`,
			);
			const { dedupeZshrc } = await import("../libs/install/zshrc-dedupe.mjs");
			// 非互動模式（CI / pipe）自動修復
			if (process.stdin.isTTY === false) {
				p.log.info("非互動模式：自動修復重複注入...");
				const result = dedupeZshrc(zshrcPath);
				if (result.removed > 0) {
					p.log.success(
						`已自動修復：移除 ${result.removed} 份重複注入（備份：${result.backupPath}）`,
					);
				}
			} else {
				// 互動模式：詢問用戶
				const fix = await p.confirm({
					message: "執行 d:setup 前自動修復重複注入？",
					initialValue: true,
				});
				if (p.isCancel(fix)) {
					p.log.warn("已跳過修復，繼續安裝");
				} else if (fix) {
					const result = dedupeZshrc(zshrcPath);
					if (result.removed > 0) {
						p.log.success(
							`已修復：移除 ${result.removed} 份重複注入（備份：${result.backupPath}）`,
						);
					}
				} else {
					p.log.warn(
						"已跳過修復，可稍後執行：node apps/dotfiles/libs/install/zshrc-dedupe.mjs",
					);
				}
			}
		}
	}

	// 斷點續裝偵測
	const incomplete = checkIncompleteSession();
	if (incomplete.hasIncomplete && prev) {
		const pending = incomplete.pendingTargets?.join(", ") || "";
		p.log.warn(`⚠️ 上次安裝未完成（剩餘：${pending}）`);
	}

	// Splash
	console.log();
	if (prev) {
		p.intro(
			` ab-tao v${APP_VERSION} — 上次：${prev.repos?.length ?? 0} repos · ${prev.techStacks?.length ?? 0} stacks · ${prev.timestamp?.slice(0, 10) || ""} `,
		);
	} else {
		p.intro(` ab-tao v${APP_VERSION} 安裝精靈 `);
	}

	// 舊版安裝偵測（延後到用戶選擇安裝/調整後再執行）
	async function runLegacyCheckIfNeeded() {
		const legacyInfo = detectLegacyInstallation();
		if (legacyInfo.hasLegacy) {
			const upgradeResult = await runUpgrade(legacyInfo);
			if (upgradeResult === "cleaned") {
				prev = null;
				projectFolders = [];
			}
		}
	}

	// --quick + --dry-run 衝突檢查
	if (flagQuick && flagDryRun) {
		p.log.warn("⚠️ --quick 和 --dry-run 不能同時使用，已忽略 --dry-run");
	}

	// 用於 --quick / reinstall 的 selectedIds，後續共用 Feature Registry lifecycle
	let selectedIds;

	// --from-icloud：從 iCloud 拉取偏好並快速重建 ZSH 環境
	if (flagFromIcloud) {
		const { hasRemotePrefs, pullPrefs } = await import(
			"../libs/external/ab-async.mjs"
		);
		const { readPrefsFromDisk } = await import("../libs/core/preferences.mjs");

		if (!hasRemotePrefs()) {
			p.log.error(
				"iCloud 上沒有可用的偏好檔案，請先在主機執行：pnpm run d:prefs-sync",
			);
			process.exit(1);
		}

		const spinner = p.spinner();
		spinner.start("從 iCloud 拉取偏好...");
		try {
			await pullPrefs({ force: true });
			spinner.stop("偏好已拉取");
		} catch (e) {
			spinner.stop(pc.red("拉取失敗"));
			p.log.error(e.message);
			process.exit(1);
		}

		const icloudPrefs = readPrefsFromDisk();
		const modulesFile = path.join(HOME, ".zshrc.d", ".selected-modules");
		const icloudModules = fs.existsSync(modulesFile)
			? fs.readFileSync(modulesFile, "utf8").split("\n").filter(Boolean)
			: null;

		// 合併至 prev，讓 --quick 路徑的 configure() 能讀到模組選擇
		prev = {
			...prev,
			preferences: icloudPrefs,
			install: {
				...(prev?.install ?? {}),
				modules: icloudModules,
			},
			features: ["zsh"],
		};
		selectedIds = ["zsh"];
		flagQuick = true;

		p.log.success(
			`🍏 iCloud 偏好已載入${icloudModules ? `（模組：${icloudModules.join(", ")}）` : ""}`,
		);
	}

	// --quick：從 session 重建 features，走 Feature Registry lifecycle
	if (flagQuick && !flagFromIcloud) {
		if (!prev) {
			p.log.error("❌ 無歷史記錄，無法 --quick。請先執行 pnpm run d:setup");
			process.exit(1);
		}
		p.log.info(
			`⚡ Quick 模式：重放上次安裝（${prev.features?.length || 0} 功能）`,
		);
		await runLegacyCheckIfNeeded();

		// 從 session 的 features 清單重建，fallback 基礎功能
		selectedIds = prev.features?.length
			? prev.features
			: ["claude-base", "zsh", "project-install"];
	}

	// 重入
	if (prev && !flagAll && !flagQuick) {
		const action = handleCancel(
			await p.select({
				message: `上次安裝：${prev.repos?.length ?? 0} repos · ${prev.installMode || "full"}`,
				options: [
					{
						value: "reinstall",
						label: "🔄 重新安裝（用上次設定）",
						hint: "Enter 直接裝",
					},
					{ value: "adjust", label: "⚙️ 調整設定" },
					{
						value: "status",
						label: "📊 查看/調整配置",
						hint: "Claude / ZSH 健康狀態",
					},
				],
			}),
		);
		if (action === BACK) {
			p.outro("已取消");
			process.exit(0);
		}
		if (action === "status") {
			// 展示完整配置狀態，並提供快速調整選項
			const { getConfigStatus } = await import(
				"../libs/core/config-status.mjs"
			);
			const { adjustClaude, adjustGlobalSettings, adjustClaudeMd, adjustZsh } =
				await import("../libs/phases/phase-adjust.mjs");

			const status = getConfigStatus();
			const { summary, claude, claudeMd, zsh, env: envStatus } = status;
			const claudeDir = path.join(HOME, ".claude");

			// ── 健康度 bar ──
			const bar =
				"█".repeat(Math.round(summary.pct / 5)) +
				"░".repeat(20 - Math.round(summary.pct / 5));
			const healthIcon =
				summary.pct >= 90
					? pc.green("✔")
					: summary.pct >= 70
						? pc.yellow("⚠")
						: pc.red("✘");

			// ── Claude 配置 ──
			const cmdOk = pc.green(claude.installedCommands.length);
			const agentOk = pc.green(claude.installedAgents.length);
			const ruleOk = pc.green(claude.installedRules.length);
			const hasHooks = fs.existsSync(path.join(claudeDir, "hooks.json"));
			const hasSettings = fs.existsSync(path.join(claudeDir, "settings.json"));

			const lines = [
				`${healthIcon}  [${bar}]  ${pc.bold(`${summary.pct}%`)}  (${summary.ok}/${summary.total})`,
				"",
				pc.bold("Claude 配置"),
				`  Commands   ${cmdOk} 個${!isEmpty(claude.installedCommands) ? pc.dim(`  ${claude.installedCommands.join(", ")}`) : ""}`,
				`  Agents     ${agentOk} 個${!isEmpty(claude.installedAgents) ? pc.dim(`  ${claude.installedAgents.join(", ")}`) : ""}`,
				`  Rules      ${ruleOk} 個${!isEmpty(claude.installedRules) ? pc.dim(`  ${claude.installedRules.join(", ")}`) : ""}`,
				`  Hooks      ${hasHooks ? pc.green("已啟用") : pc.dim("未安裝")}`,
				`  Settings   ${hasSettings ? pc.green("已配置") : pc.dim("未安裝")}`,
				`  CLAUDE.md  ${pc.cyan(claudeMd.count)} 個 repo`,
			];

			if (!isEmpty(claude.missing)) {
				lines.push(
					pc.red(
						`  缺少 ${claude.missing.length} 個：${claude.missing.join(", ")}`,
					),
				);
			}
			if (!isEmpty(claude.extra)) {
				lines.push(
					pc.dim(`  額外 ${claude.extra.length} 個（非 ab-tao 管理）`),
				);
			}

			// ── ZSH 環境模組 ──
			lines.push("", pc.bold("ZSH 環境模組"));
			lines.push(
				`  已安裝  ${pc.green(zsh.installed.length)}/${zsh.expected.length}  ${pc.dim(zsh.installed.join(", ") || "無")}`,
			);
			if (!isEmpty(zsh.missing)) {
				lines.push(pc.red(`  缺少：${zsh.missing.join(", ")}`));
			}

			// ── AI ──
			if (envStatus.aiModel) {
				lines.push("", pc.bold("AI 設定"));
				lines.push(`  模型  ${pc.cyan(envStatus.aiModel)}`);
			}

			p.log.info(lines.join("\n"));

			const adjustAction = handleCancel(
				await p.select({
					message: "選擇要調整的項目",
					options: [
						{
							value: "claude",
							label: "🤖 重新安裝 Claude 配置",
							hint: `commands ${claude.installedCommands.length} · agents ${claude.installedAgents.length} · rules ${claude.installedRules.length}`,
						},
						{
							value: "settings",
							label: "⚙️ 重新套用全局設定",
							hint: `settings ${hasSettings ? "✔" : "✘"}`,
						},
						{
							value: "claudemd",
							label: "📝 重新生成 CLAUDE.md",
							hint: `${claudeMd.count} 個 repo · 需 AI`,
						},
						{
							value: "zsh",
							label: "🐚 重新安裝 ZSH 環境模組",
							hint: `${zsh.installed.length}/${zsh.expected.length} 已安裝`,
						},
						{
							value: "prefs",
							label: "🎛️ 調整個人偏好",
							hint: "editor / 通知 / 安全攔截 / 快取",
						},
						{ value: "back", label: "← 返回" },
					],
				}),
			);
			if (adjustAction === BACK || adjustAction === "back") {
				p.outro("已取消");
				process.exit(0);
			}
			const adjustMap = {
				claude: () => adjustClaude({ flagAll }),
				settings: () => adjustGlobalSettings(),
				claudemd: () => adjustClaudeMd(),
				prefs: async () => {
					const { collectPreferences, deployZshPrefs, deployHookPrefs } =
						await import("../libs/core/preferences.mjs");
					const { patchSession } = await import("../libs/core/session.mjs");
					const newPrefs = await collectPreferences(prev?.preferences);
					if (newPrefs) {
						deployZshPrefs(newPrefs);
						deployHookPrefs(newPrefs);
						patchSession({ preferences: newPrefs });
						p.log.success("偏好已更新並部署");
					}
				},
				zsh: () => adjustZsh({ flagAll }),
			};
			if (adjustMap[adjustAction]) await adjustMap[adjustAction]();
			p.outro("調整完成");
			process.exit(0);
		}
		// 「調整設定」：不自動跳過組織選擇，讓用戶重選一切
		if (action === "adjust") {
			prev = { ...prev, org: null }; // 清除 org 讓 interactiveRepoSelect 重新問
		}
		if (action === "reinstall") {
			await runLegacyCheckIfNeeded();
			// 從 session 重建 features，等同 --quick fall-through
			selectedIds = prev.features?.length
				? prev.features
				: ["claude-base", "zsh", "project-install"];
			flagQuick = true;
		}
	}

	// ── 功能選擇（Feature Registry）──
	const { selectFeatures, loadFeatures, topoSort } = await import(
		"../libs/features/registry.mjs"
	);

	// --quick / reinstall 已設定 selectedIds，否則走互動選擇
	if (!selectedIds) {
		selectedIds = await selectFeatures();
		if (isEmpty(selectedIds)) {
			p.log.warn("未選擇任何功能");
			p.outro("已取消");
			return;
		}
	}

	// 風險提示（ZSH 修改系統配置）— quick 模式跳過
	const riskySelected = selectedIds.filter((f) => ["zsh"].includes(f));
	if (!flagQuick && !isEmpty(riskySelected)) {
		const hints = {
			zsh: "在 ~/.zshrc 追加 loader + 部署 ~/.zshrc.d/",
		};
		p.log.info(
			`✔️ 選擇了：${riskySelected.map((f) => `${f}（${hints[f]}）`).join("、")}`,
		);
		const ok = handleCancel(
			await p.confirm({
				message:
					"⚠️ 以上操作會修改系統配置，確認繼續？  Y 確認 · n 取消 · ESC 上一步",
				initialValue: true,
			}),
		);
		if (ok === BACK || !ok) {
			p.outro("已取消");
			return;
		}
	}

	// ── 環境準備（只在需要時）──
	const needsEnvSetup = selectedIds.some((f) =>
		[
			"claude-base",
			"plugins",
			"repos",
			"tech-analysis",
			"project-install",
		].includes(f),
	);
	if (needsEnvSetup) {
		await runLegacyCheckIfNeeded();
		await ensureSetupEnvironment();
	}

	// ── 個人偏好 ──
	const { collectPreferences, PREF_DEFAULTS } = await import(
		"../libs/core/preferences.mjs"
	);
	const preferences = flagQuick
		? { ...PREF_DEFAULTS, ...(prev?.preferences ?? {}) }
		: await collectPreferences(prev?.preferences);

	// ── 統一 Feature Lifecycle 迴圈 ──
	if (fs.existsSync(PREVIEW_DIR)) fs.rmSync(PREVIEW_DIR, { recursive: true });

	const loaded = topoSort(await loadFeatures(selectedIds));
	const startTime = Date.now();
	const featureResults = {};
	const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

	const rootCtx = {
		repoDir: REPO,
		previewDir: PREVIEW_DIR,
		targets,
		prev,
		sources,
		preferences,
		projectFolders,
		flags: {
			all: flagAll,
			quick: flagQuick,
			manual: flagManual,
			dryRun: flagDryRun,
		},
		_path: path,
	};

	for (let i = 0; i < loaded.length; i++) {
		const feature = loaded[i];
		const step = `[${i + 1}/${loaded.length}]`;

		// 視覺分隔（第一個 feature 前不需要）
		if (i > 0) console.log();

		p.log.step(`${step} ${pc.bold(feature.label)}`);
		const featureStart = Date.now();

		// 依賴注入：提供上游 feature 的結果
		const deps = {};
		for (const depId of feature.dependsOn || []) {
			deps[depId] = featureResults[depId];
		}
		const ctx = {
			...rootCtx,
			deps,
			backupDir: path.join(REPO, "dist", "backup", ts, feature.id),
		};

		// envCheck
		const envResult = await feature.envCheck();
		if (envResult.message) p.log.info(`🔍 ${envResult.message}`);
		if (!envResult.ok) {
			p.log.warn(`${feature.label} 環境檢查未通過，略過`);
			continue;
		}

		// backup
		const backupResult = await feature.backup(ctx);
		if (backupResult.files?.length)
			p.log.info(`🗂️ 已備份：${backupResult.files.join("、")}`);

		// configure
		const config = await feature.configure(ctx);
		if (!config) {
			const skipLines = feature.complete(null);
			if (skipLines.length) p.log.info(skipLines.join("\n"));
			else p.log.info(`  ${pc.dim("略過")}`);
			continue;
		}

		// plan
		const plan = await feature.plan(ctx, config);
		if (!plan) {
			const skipLines = feature.complete(null);
			if (skipLines.length) p.log.info(skipLines.join("\n"));
			else p.log.info(`  ${pc.dim("略過")}`);
			continue;
		}

		// confirm
		const confirmed = await feature.confirm(ctx, plan);
		if (!confirmed) continue;

		// install
		if (!flagDryRun) {
			const result = await withSpinner(
				`${step} 安裝 ${feature.label}`,
				async () => feature.install(ctx, plan),
				{ hint: feature.id },
			);
			featureResults[feature.id] = result;

			// verify
			const verification = await feature.verify(
				ctx,
				featureResults[feature.id],
			);
			if (verification.missing?.length) {
				p.log.warn(
					`驗證：${verification.passed}/${verification.total}，缺少：${verification.missing.join("、")}`,
				);
			} else if (verification.total > 0) {
				p.log.success(
					`驗證：${verification.passed}/${verification.total} 全部就位 ✓`,
				);
			}
		} else {
			p.log.info(`[DRY RUN] ${feature.label} — 跳過安裝`);
		}

		// complete
		const guideLines = feature.complete(featureResults[feature.id]);
		if (guideLines.length) p.log.info(guideLines.join("\n"));

		// 單一 feature 耗時
		const featureElapsed = ((Date.now() - featureStart) / 1000).toFixed(1);
		p.log.success(`  ${step} 完成（${featureElapsed}s）`);
	}

	// ── 彙總結果 ──
	console.log();
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

	// 彙總所有 feature 的 installSelections
	const aggregatedSelections = {
		commands: [],
		agents: [],
		rules: [],
		hooks: [],
		modules: [],
		plugins: [],
		pluginsFailed: [],
		skills: [],
	};
	for (const [_id, result] of Object.entries(featureResults)) {
		if (!result) continue;
		// 直接的 installSelections（from claude-base, project-install）
		const sel = result.installSelections || result;
		for (const key of Object.keys(aggregatedSelections)) {
			if (Array.isArray(sel[key])) {
				aggregatedSelections[key].push(...sel[key]);
			}
		}
	}

	// 從 project-install 結果取 syncResult 和 pipelineResult
	const projectResult = featureResults["project-install"];
	const _syncResult = projectResult?.syncResult || null;
	const pipelineResult = projectResult?.pipelineResult || null;

	// 構建彙總 plan（供 session 保存與報告使用）
	const reposResult = featureResults.repos;
	const techResult = featureResults["tech-analysis"];
	const aggregatedPlan = {
		targets: selectedIds,
		features: selectedIds,
		mode: flagManual ? "manual" : "auto",
		installMode: selectedIds.includes("project-install")
			? "full"
			: "standalone",
		repos:
			reposResult?.repos || prev?.repos?.map((r) => ({ fullName: r })) || [],
		techStacks: techResult?.techStacks || prev?.techStacks || [],
		aiRes: projectResult?.aiRes || [],
		projects: reposResult?.projects || [],
		profile: techResult?.profile || null,
		aiCost: { total: 0 },
		_pipelineResult: pipelineResult,
	};

	// 儲存 session + 顯示完成
	const { saveSession, clearSessionProgress } = await import(
		"../libs/core/session.mjs"
	);
	clearSessionProgress();

	const roles = {};
	const localPaths = {};
	for (const r of aggregatedPlan.repos) {
		if (r.fullName) {
			roles[r.fullName] = r.role || "temp";
			if (r.localPath) localPaths[r.fullName] = r.localPath;
		}
	}

	saveSession({
		targets: selectedIds,
		features: selectedIds,
		mode: aggregatedPlan.mode,
		installMode: aggregatedPlan.installMode,
		org: [
			...new Set(
				aggregatedPlan.repos
					.map((r) => r.fullName?.split("/")[0])
					.filter(Boolean),
			),
		],
		repos: aggregatedPlan.repos.map((r) => r.fullName).filter(Boolean),
		roles,
		localPaths,
		techStacks: aggregatedPlan.techStacks,
		projectFolders: projectFolders || [],
		selectedAiSources: techResult?.selectedAiSources || selectedAiSources,
		aiResSelections:
			aggregatedPlan.aiRes?.length > 0
				? { recommended: aggregatedPlan.aiRes }
				: null,
		install: aggregatedSelections,
		installCommonsSelections:
			featureResults["project-install"]?.commonsSelections || {},
		preferences,
	});

	p.log.success(`✅ 全部完成（${loaded.length} 功能 · 耗時 ${elapsed}s）`);

	// 儲存快取供 Console API server 讀取（上次 d:setup 的 repos / techStacks）
	// 快取路徑：~/.claude/.cache/last-report-data.json
	try {
		const cacheDir = path.join(HOME, ".claude", ".cache");
		fs.mkdirSync(cacheDir, { recursive: true });
		const cacheData = {
			// 記錄寫入時間戳，供 Dashboard 顯示「上次 d:setup 時間」
			timestamp: new Date().toISOString(),
			// repos：強制物件格式 { name, role, localPath }，避免前端 Object.entries(string) 字符化亂碼
			repos: (aggregatedPlan.repos || [])
				.filter((r) => r && (r.fullName || typeof r === "string"))
				.map((r) =>
					typeof r === "string"
						? {
								name: r,
								role: roles[r] || "temp",
								localPath: localPaths[r] || null,
							}
						: {
								name: r.fullName,
								role: r.role || roles[r.fullName] || "temp",
								localPath: r.localPath || localPaths[r.fullName] || null,
							},
				),
			// techStacks：優先從 pipelineResult.categorizedTechs Map 取分類物件
			// 退路順序：aggregatedPlan.techStacks（已分類）→ 扁平陣列包 uncategorized → 空物件
			techStacks: (() => {
				const cat = pipelineResult?.categorizedTechs;
				if (cat instanceof Map && cat.size > 0)
					return Object.fromEntries(
						[...cat].map(([k, v]) => [k, [...v.keys()]]),
					);
				const ts = aggregatedPlan.techStacks;
				if (Array.isArray(ts))
					return ts.length > 0 ? { uncategorized: ts } : {};
				return ts || {};
			})(),
		};
		fs.writeFileSync(
			path.join(cacheDir, "last-report-data.json"),
			JSON.stringify(cacheData, null, 2),
		);
	} catch {
		/* 快取寫入失敗不影響安裝主流程 */
	}

	// 偵測 catppuccin preset → 提示安裝 Nerd Font
	const { getNerdFontHint } = await import("../libs/core/preferences.mjs");
	const fontHint = getNerdFontHint(preferences);
	if (fontHint) p.log.warn(fontHint);

	p.outro("設定完成");
}

main().catch((e) => {
	p.log.error(`❌ ${e?.message ?? String(e)}`);
	process.exit(1);
});
