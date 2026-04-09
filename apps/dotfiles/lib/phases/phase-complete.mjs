/**
 * Phase: 完成 — 報告 + 引導 + 耗時 + session
 *
 * 安裝完成後的收尾階段，依序執行：
 *   1. 計算耗時並顯示安裝摘要
 *   2. 輸出快速上手引導訊息
 *   3. 偵測並提供 RTK 選擇性安裝
 *   4. 生成 HTML 安裝報告並詢問是否開啟瀏覽器
 *   5. 清除 session 進度並儲存最終 session
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import { BACK, handleCancel } from "../cli/prompts.mjs";
import { BACKUP_DIR } from "../core/backup.mjs";
import { BACKUP_MAX_COUNT } from "../core/constants.mjs";
import { HOME } from "../core/paths.mjs";
import { clearSessionProgress, saveSession } from "../core/session.mjs";
import { generateReport, openInBrowser, saveReport } from "../report.mjs";

/** 偵測 RTK 是否已安裝 */
function detectRtk() {
	try {
		execFileSync("which", ["rtk"], { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

/** 可選增強工具配置（模組級常數） */
const ENHANCERS = [
	{
		name: "RTK",
		desc: "壓縮 Bash 輸出 -89% token，安裝後自動生效，無需改變操作習慣",
		// 優先 brew install（推薦）；brew 不可用時 fallback curl
		install: `if command -v brew &>/dev/null; then brew install rtk; else export PATH="$HOME/.local/bin:$PATH" && curl -fsSL https://rtk.sh | bash; fi && rtk init -g`,
		failHint: `brew install rtk  （再執行 rtk init -g）\n參考：https://github.com/rtk-ai/rtk`,
		doneHint: "已就緒，下次執行 git log 等指令輸出將自動壓縮",
		detect: detectRtk,
	},
];

/**
 * 執行安裝完成後的收尾工作
 *
 * @param {Object} plan - generateInstallPlan 產出的安裝計畫
 * @param {Object} opts
 * @param {string} opts.repoDir - @ab-tao/dotfiles 根目錄（用於報告相對路徑）
 * @param {Object} opts.installSelections - phaseExecute 回傳的安裝選項（commands/agents/rules/hooks/modules）
 * @param {Object|null} opts.syncResult - ECC 同步結果（buildSyncResult 產出）
 * @param {number} opts.startTime - 安裝開始時間戳（Date.now()）
 * @param {Object|null} opts.pipelineResult - runAnalysisPipeline 產出（用於報告中的技術棧與 reasoning）
 * @param {Array} opts.projectFolders - 專案文件夾映射（儲存到 session）
 * @param {Array} opts.selectedAiSources - 用戶選擇的 AI 來源名稱陣列（儲存到 session）
 * @returns {Promise<void>}
 */
export async function phaseComplete(
	plan,
	{
		repoDir,
		installSelections,
		syncResult,
		startTime,
		pipelineResult,
		projectFolders,
		selectedAiSources,
	},
) {
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	const isManual = plan.mode === "manual";
	const claudeDir = path.join(HOME, ".claude");
	const readDir = (dir) =>
		fs.existsSync(dir)
			? fs
					.readdirSync(dir)
					.filter((f) => f.endsWith(".md"))
					.map((f) => f.replace(".md", ""))
			: [];

	// 從實際安裝目錄讀取已安裝項目
	const installed = {
		commands: installSelections.commands?.length
			? installSelections.commands
			: readDir(path.join(claudeDir, "commands")),
		agents: installSelections.agents?.length
			? installSelections.agents
			: readDir(path.join(claudeDir, "agents")),
		rules: installSelections.rules?.length
			? installSelections.rules
			: readDir(path.join(claudeDir, "rules")),
		hooks:
			!isEmpty(installSelections.hooks) ||
			fs.existsSync(path.join(claudeDir, "hooks.json")),
		modules: installSelections.modules || [],
	};

	// 安裝摘要 — 詳細列出所有已安裝項目
	const instLines = [];
	if (installed.commands.length)
		instLines.push(
			`  Commands（${installed.commands.length}）：${installed.commands.join("、")}`,
		);
	if (installed.agents.length)
		instLines.push(
			`  Agents（${installed.agents.length}）：${installed.agents.join("、")}`,
		);
	if (installed.rules.length)
		instLines.push(
			`  Rules（${installed.rules.length}）：${installed.rules.join("、")}`,
		);
	if (installed.hooks) instLines.push("  Hooks：已啟用");
	if (installed.modules?.length)
		instLines.push(
			`  ZSH 模組（${installed.modules.length}）：${installed.modules.join("、")}`,
		);
	if (plan.techStacks?.length)
		instLines.push(
			`  Stacks（${plan.techStacks.length}）：${plan.techStacks.join("、")}`,
		);

	const summaryLines = [
		`耗時 ${elapsed}s · AI ~$${plan.aiCost?.total?.toFixed(2) ?? "?"}`,
		"",
		"已安裝：",
		...instLines,
		"",
		"產出目錄  dist/",
		"  preview/   預覽檔案",
		"  release/   .plugin 檔案",
		...(fs.existsSync(BACKUP_DIR)
			? [`  backup/    備份（保留 ${BACKUP_MAX_COUNT} 次）`]
			: []),
		...(isManual
			? [
					"",
					"手動部署：",
					"  cp -r dist/preview/claude/* ~/.claude/",
					"  cp -r dist/preview/zsh/* ~/.zshrc.d/",
				]
			: []),
		...(fs.existsSync(BACKUP_DIR) ? ["", "還原：pnpm run restore"] : []),
	];
	p.log.success(`✅ 安裝完成\n${summaryLines.join("\n")}`);

	// 安裝後引導（按 features 過濾）
	const feats = new Set(plan.features || []);
	const has = (f) => feats.has(f);
	const guideLines = ["🎓 快速上手", ""];

	if (has("claude")) {
		guideLines.push(
			"── Commands（/指令）──",
			"  /check · /slack · /test · /db-migration",
			"",
			"── Agents（@代理）──",
			"  @architect · @debugger",
			"",
			"── Skills（/技能庫）──",
			"  /runbook · /incident（按需）",
			"",
			"── Rules（自動套用）──",
			"  api-and-data（碰到 API/DB 檔案時自動載入）",
			"",
			"── CLAUDE.md（每個 repo 各自生成）──",
			"  cd {repo} && claude /init",
			"",
		);
	}

	if (has("zsh")) {
		guideLines.push(
			"── ZSH 模組（~/.zshrc.d/ + sheldon）──",
			"  history · keys · aliases · git · tools + sheldon 插件管理",
			"  執行 exec zsh 立即套用",
			"",
		);
	}

	if (has("slack")) {
		guideLines.push(
			"── Slack ──",
			"  💬 Slack 通知頻道 → .env SLACK_NOTIFY_CHANNEL",
			"",
		);
	}

	guideLines.push(
		"── Model 自動路由（opusplan 模式）──",
		"  預設 opusplan：/plan 用 Opus 思考，執行自動切回 Sonnet",
		"  @architect → Opus（架構決策）",
		"  @debugger · /test · /db-migration · /incident → Sonnet（日常開發）",
		"  /check · /slack · /runbook → Haiku（模板/腳本）",
		"",
		"── 維護 ──",
		"  pnpm run status   — 配置管理中心",
		"  pnpm run doctor   — 環境診斷",
		"  pnpm run restore  — 還原上次備份",
	);

	p.log.info(guideLines.join("\n"));

	// ── 以下區塊僅在選了 claude 時顯示 ──
	if (has("claude")) {
		// 三層推薦系統
		const buildLspRecommendations = (techStacks = []) => {
			const recommended = [];
			if (
				techStacks.some(
					(s) => s.includes("typescript") || s.includes("javascript"),
				)
			)
				recommended.push("TypeScript LSP");
			if (techStacks.some((s) => s.includes("python")))
				recommended.push("Python (Pyright) LSP");
			if (techStacks.some((s) => s.includes("go")))
				recommended.push("Go (gopls) LSP");
			if (techStacks.some((s) => s.includes("rust")))
				recommended.push("Rust (rust-analyzer) LSP");
			return !isEmpty(recommended)
				? `LSP 按語言：${recommended.join("、")}`
				: "LSP 按語言：/plugin 中搜索 language server";
		};

		const lspLine = buildLspRecommendations(plan.techStacks || []);

		p.log.info(
			[
				"💡 推薦安裝（提升 Claude Code 能力）",
				"",
				"  ── 官方 Plugin（強烈推薦）──",
				"  /plugin install code-review@claude-plugins-official",
				"  /plugin install commit-commands@claude-plugins-official",
				"  /plugin install security-guidance@claude-plugins-official",
				`  ${lspLine}`,
				"",
				"  ── 官方 Marketplace（按需）──",
				"  /plugin marketplace add anthropics/knowledge-work-plugins",
				"",
				"  ── CI/CD 自動化 ──",
				"  /install-github-app（PR 自動審查 + Issue 分類）",
				"",
				"  ── Token 優化 ──",
				"  RTK — brew install rtk && rtk init -g",
				"",
				"  ── 官方內建功能（無需安裝）──",
				"  Auto Memory · /init · /plan · /simplify · /debug · /batch",
			].join("\n"),
		);

		// 增強工具互動安裝
		const missingEnhancers = ENHANCERS.filter((e) => !e.detect());
		if (!isEmpty(missingEnhancers)) {
			let toInstall = [];

			// 如果只有一個增強工具，使用 confirm；否則使用 multiselect
			if (missingEnhancers.length === 1) {
				const confirmed = handleCancel(
					await p.confirm({
						message: `🚀 安裝 ${missingEnhancers[0].name}？（${missingEnhancers[0].desc}）`,
						initialValue: true,
					}),
				);
				if (confirmed !== BACK && confirmed) {
					toInstall = [missingEnhancers[0].name];
				}
			} else {
				toInstall = handleCancel(
					await p.multiselect({
						message:
							"🚀 選擇要安裝的增強工具  Space 選擇 · Enter 確認（直接 Enter 跳過）",
						options: missingEnhancers.map((e) => ({
							value: e.name,
							label: e.name,
							hint: e.desc,
						})),
						required: false,
						initialValues: [],
					}),
				);
			}

			if (toInstall !== BACK && !isEmpty(toInstall)) {
				for (const name of toInstall) {
					const tool = ENHANCERS.find((e) => e.name === name);
					p.log.info(`📦 安裝 ${tool.name}（輸出如下）：`);
					try {
						execSync(tool.install, {
							stdio: ["pipe", "inherit", "inherit"],
							timeout: 300000,
							shell: true,
						});
						p.log.success(`✔ ${tool.name} ${tool.doneHint}`);
					} catch {
						p.log.warn(`⚠️ ${tool.name} 安裝失敗\n請手動安裝：${tool.failHint}`);
					}
				}
			}
		}
	}

	// 報告（僅在有 repos 或 claude 配置時生成）
	const hasSubstantialContent =
		has("claude") || has("project") || plan.repos?.length > 0;
	const { ghSync } = await import("../external/github.mjs");
	const reportData = {
		username: ghSync("user", ".login") || "",
		org: [
			...new Set(
				(plan.repos || [])
					.map((r) => r.fullName?.split("/")[0])
					.filter(Boolean),
			),
		].join(" + "),
		repos: (plan.repos || []).map((r) => r.fullName),
		techStacks: Object.fromEntries(
			[...(pipelineResult?.categorizedTechs || new Map())].map(([k, v]) => [
				k,
				[...v.keys()],
			]),
		),
		perRepoReasoning:
			pipelineResult?.perRepo instanceof Map
				? Object.fromEntries(
						[...pipelineResult.perRepo].map(([k, v]) => [
							k,
							{ reasoning: v.reasoning, stacks: v.techStacks },
						]),
					)
				: {},
		auditSummary: pipelineResult?.audit?.toSummary() || [],
		ecc: syncResult
			? {
					sources: syncResult.results?.map((r) => ({
						name: r.source,
						repo: r.repo,
						version: r.version,
						cached: r.cached,
						added: r.added,
						skipped: r.skipped,
						hooks: r.hooks,
					})),
				}
			: null,
		installed,
		commonsResources: (pipelineResult?.commonsResources?.sources || []).map(
			(src) => ({
				name: src.name,
				commands: src.commands?.length || 0,
				agents: src.agents?.length || 0,
				rules: src.rules?.length || 0,
				skills: src.skills?.length || 0,
			}),
		),
		stacks: plan.techStacks,
		projects: plan.projects || [],
		repoRoles: Object.fromEntries(
			(plan.repos || []).map((r) => [
				r.fullName,
				{ role: r.role, localPath: r.localPath },
			]),
		),
		backupDir: fs.existsSync(BACKUP_DIR)
			? path.relative(repoDir, BACKUP_DIR)
			: null,
		mode: isManual ? "manual" : "auto",
		timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
	};

	if (hasSubstantialContent) {
		try {
			const html = generateReport(reportData);
			const reportPath = saveReport(html, path.join(repoDir, "dist"));
			p.log.info(`📊 報告 → ${path.relative(repoDir, reportPath)}`);
			try {
				await openInBrowser(reportPath);
			} catch {
				/* 瀏覽器開啟失敗不阻塞 */
			}
		} catch (err) {
			p.log.warn(`⚠️ 報告生成失敗（${err.message}）`);
		}
	}

	// Session
	clearSessionProgress();
	saveSession({
		targets: plan.targets || ["claude-dev", "slack", "zsh"],
		features: plan.features || ["claude", "slack", "zsh"],
		mode: plan.mode,
		installMode: plan.installMode,
		org: [
			...new Set(
				(plan.repos || [])
					.map((r) => r.fullName?.split("/")[0])
					.filter(Boolean),
			),
		],
		repos: (plan.repos || []).map((r) => r.fullName),
		roles: Object.fromEntries(
			(plan.repos || []).map((r) => [r.fullName, r.role]),
		),
		localPaths: Object.fromEntries(
			(plan.repos || [])
				.filter((r) => r.localPath)
				.map((r) => [r.fullName, r.localPath]),
		),
		techStacks: plan.techStacks,
		projectFolders: projectFolders || [],
		selectedAiSources: selectedAiSources || [],
		eccSelections:
			(plan.ecc?.length ?? 0) > 0 ? { recommended: plan.ecc } : null,
		install: {
			commands: installSelections.commands || [],
			agents: installSelections.agents || [],
			rules: installSelections.rules || [],
			hooks: installSelections.hooks || [],
			modules: installSelections.modules || [],
		},
	});
}
