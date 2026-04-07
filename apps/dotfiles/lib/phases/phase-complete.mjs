/**
 * Phase: 完成 — 報告 + 引導 + 耗時 + session
 *
 * 安裝完成後的收尾階段，依序執行：
 *   1. 計算耗時並顯示安裝摘要
 *   2. 輸出快速上手引導訊息
 *   3. 偵測並提供 RTK / Claude-Mem 選擇性安裝
 *   4. 建立第三方 ECC 描述快取
 *   5. 生成 HTML 安裝報告並詢問是否開啟瀏覽器
 *   6. 清除 session 進度並儲存最終 session
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import { BACK, handleCancel } from "../cli/prompts.mjs";
import { buildDescriptionCache } from "../config/descriptions.mjs";
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

/** 偵測 Claude-Mem 是否已全局安裝 */
function detectClaudeMem() {
	try {
		execFileSync("which", ["claude-mem"], { stdio: "pipe" });
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
	{
		name: "Claude-Mem",
		desc: "跨會話記憶，開新視窗也記得你的背景與偏好",
		install: "pnpm add -g claude-mem && claude-mem install",
		failHint: "pnpm add -g claude-mem && claude-mem install",
		doneHint: "已就緒，執行 claude-mem save 可儲存對話記憶",
		detect: detectClaudeMem,
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
	const claudeMdCount =
		plan.projects?.filter((proj) => proj.localPath).length || 0;
	if (claudeMdCount)
		instLines.push(`  CLAUDE.md（${claudeMdCount}）→ ~/.claude/projects/`);

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

	// 安裝後引導
	p.log.info(
		[
			"🎓 快速上手",
			"",
			"── Commands（/指令）──",
			"  開發流程：/code-review · /tdd · /build-fix · /pr-workflow · /changeset",
			"  AI 協作：  /plan · /multi-plan · /multi-execute · /multi-workflow",
			"  程式碼：  /simplify · /refactor-clean · /verify · /quality-gate",
			"  測試：    /test-gen · /test-coverage · /e2e",
			"  Slack：   /draft-slack · /review-slack · /slack-formatting",
			"  Session： /save-session · /resume-session · /sessions",
			"  工具：    /docs · /prompt-optimize · /context-budget · /aside",
			"",
			"── Agents（@代理）──",
			"  開發：  @coder · @planner · @architect · @debugger · @reviewer · @deployer",
			"  審查：  @code-reviewer · @typescript-reviewer · @security-reviewer",
			"  測試：  @tester · @tdd-guide · @e2e-runner",
			"  維運：  @chief-of-staff · @monitor · @migrator · @perf-analyzer",
			"",
			"── Rules（自動套用）──",
			"  code-style · git-workflow · testing · performance · slack-triage · project-conventions",
			"",
			"── ZSH 模組（~/.zshrc.d/ + sheldon）──",
			"  history · keys · aliases · git · tools + sheldon 插件管理",
			"",
			"── 整合設定 ──",
			"  📧 Gmail 分級過濾 → docs/gmail-filters.md",
			"  💬 Slack 通知頻道 → .env SLACK_NOTIFY_CHANNEL",
			"",
			"── 維護 ──",
			"  pnpm run status   — 配置管理中心（查看 + 互動管理）",
			"  pnpm run report   — 瀏覽器 HTML Dashboard",
			"  pnpm run doctor   — 環境診斷",
			"  pnpm run restore  — 還原上次備份",
			"",
			"  💡 進入 repo 目錄，Claude 自動載入專案配置",
		].join("\n"),
	);

	// 三層推薦系統 — 根據 techStacks 動態生成 LSP 推薦
	const buildLspRecommendations = (techStacks = []) => {
		const recommended = [];
		if (
			techStacks.some(
				(s) => s.includes("typescript") || s.includes("javascript"),
			)
		) {
			recommended.push("TypeScript LSP");
		}
		if (techStacks.some((s) => s.includes("python"))) {
			recommended.push("Python (Pyright) LSP");
		}
		if (techStacks.some((s) => s.includes("go"))) {
			recommended.push("Go (gopls) LSP");
		}
		if (techStacks.some((s) => s.includes("rust"))) {
			recommended.push("Rust (rust-analyzer) LSP");
		}

		return !isEmpty(recommended)
			? `LSP 按語言：${recommended.join("、")}`
			: "LSP 按語言：/plugin 中搜索 language server";
	};

	const lspRecommendations = buildLspRecommendations(plan.techStacks || []);

	// 第一層：Token 優化（強烈推薦）
	const [, claudeMem] = ENHANCERS;
	const tier1 = [
		"  ── Token 優化（強烈推薦）──",
		"  Claude 每次對話都有 token 上限，以下兩個工具可大幅降低消耗、加快回應、節省費用",
		"",
		"  ● RTK（Reduce Token Kontrol）— Bash 輸出壓縮器",
		"    問題：git log、npm install、grep 等指令輸出動輒數千行，讓 Claude 讀完浪費大量 token",
		"    效果：自動截短並摘要 100+ 常用命令輸出，平均壓縮 -89% token 消耗",
		"    使用：安裝後自動生效，無需改變任何操作習慣",
		"    安裝：brew install rtk  （再執行 rtk init -g）",
		"",
		"  ● Claude-Mem（跨會話記憶管理器）",
		"    問題：每次開新視窗 Claude 都完全「失憶」，重複解釋背景、偏好設定耗費時間與 token",
		"    效果：自動儲存對話關鍵點，下次啟動時語義搜索載入相關記憶，維持持續工作背景",
		"    使用：claude-mem save 儲存記憶，Claude 啟動時自動讀取",
		`    安裝：${claudeMem.install}`,
	];

	// 第二層：官方 Plugins
	const tier2 = [
		"  ── 官方 Plugins ──",
		"    code-review        多 agent 並行 PR 審查",
		"    commit-commands    /commit-push-pr 一鍵提交",
		"    feature-dev        7 階段結構化開發",
		"    hookify            分析對話自動生成 hooks",
		"    ralph-wiggum       自動恢復被中斷的會話",
		"    security-guidance  編輯時安全提醒",
		"",
		"    安裝：在 Claude Code 中執行 /plugin",
	];

	// 第三層：增強工具（可選）
	const tier3 = [
		"  ── 增強工具（可選）──",
		"    pilot-shell        質量 hooks（lint+format+typecheck）",
		"    prompt-improver    提示詞自動優化 -31% token",
		`    ${lspRecommendations}`,
	];

	const recommendationLines = [
		"💡 推薦安裝（提升 Claude Code 能力）",
		"",
		...tier1,
		"",
		...tier2,
		"",
		...tier3,
	];

	p.log.info(recommendationLines.join("\n"));

	// 增強工具：RTK / Claude-Mem — 偵測未安裝的項目，提供多選安裝
	const missingEnhancers = ENHANCERS.filter((e) => !e.detect());

	if (!isEmpty(missingEnhancers)) {
		const toInstall = handleCancel(
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
		} else if (toInstall !== BACK) {
			p.log.info("已跳過增強工具");
		}
	}

	// 建立 ECC/第三方描述快取（下次 setup 顯示中文描述）
	const { count: descCount, newItems: descNewItems } = buildDescriptionCache(
		claudeDir,
		plan.techStacks || [],
	);
	if (!isEmpty(descNewItems)) {
		const names = descNewItems.map((k) =>
			k.includes("/") ? k.split("/")[1] : k,
		);
		p.log.info(
			`📋 已快取 ${descCount} 個配置描述（新增 ${descNewItems.length}）：\n${names.map((n) => `  · ${n}`).join("\n")}`,
		);
	} else if (descCount > 0) {
		p.log.info(`📋 已快取 ${descCount} 個配置描述（無新增）`);
	}

	// 報告
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

	// Session
	clearSessionProgress();
	saveSession({
		targets: plan.targets || ["claude-dev", "slack", "zsh"],
		features: plan.features || ["claude", "claudemd", "ecc", "slack", "zsh"],
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
