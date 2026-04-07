#!/usr/bin/env node

/**
 * AI 資源同步引擎
 *
 * 用法：
 *   node sync-sources.mjs                  列出可用來源（不同步）
 *   node sync-sources.mjs --all            同步全部來源
 *   node sync-sources.mjs --pick a,b,c     同步指定來源（逗號分隔）
 *   node sync-sources.mjs --source <name>  同步單一來源
 *   node sync-sources.mjs --force          強制同步（忽略 SHA 快取）
 *   node sync-sources.mjs --dry-run        模擬執行
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { validateContent } from "./security-validator.mjs";
import { needsSync, readVersions, recordSync } from "./version-tracker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = path.resolve(__dirname, "../resources/ai/sources");

// ── 來源設定 ─────────────────────────────────────────────────────
// 所有可用的 AI 資源來源，預設不同步（需使用者明確選擇）
const SOURCES_CONFIG = {
	ecc: {
		url: "https://github.com/affaan-m/everything-claude-code.git",
		icon: "🌐",
		description: "Claude Code 社群資源（commands/agents/rules/skills）",
		validatePaths: ["commands", "agents", "rules", "skills"],
	},
	anthropic: {
		url: "https://github.com/anthropics/skills.git",
		icon: "🤖",
		description: "Anthropic 官方 Skills（claude-api/doc-coauthoring/...）",
		validatePaths: ["skills"],
	},
	superpowers: {
		url: "https://github.com/obra/superpowers.git",
		icon: "🦸",
		description: "Claude Superpowers — 進階 agent 能力",
	},
	"ui-ux-pro": {
		url: "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git",
		icon: "🎨",
		description: "UI/UX Pro Max Skill — 設計與前端最佳實踐",
	},
	"claude-plugins": {
		url: "https://github.com/anthropics/claude-plugins-official.git",
		icon: "🔌",
		description: "Anthropic 官方 Plugins",
	},
	letta: {
		url: "https://github.com/letta-ai/skills.git",
		icon: "🧠",
		description: "Letta AI Skills（Slack/Google/Obsidian 整合）",
	},
	"context-engineering": {
		url: "https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering.git",
		icon: "📐",
		description: "Context Engineering Skills（context 優化/壓縮/評估）",
	},
};

// ── 工具函式 ─────────────────────────────────────────────────────

function getRemoteHead(url) {
	try {
		const output = execFileSync("git", ["ls-remote", url, "HEAD"], {
			encoding: "utf8",
			timeout: 15000,
		});
		return output.split("\t")[0].trim();
	} catch {
		return null;
	}
}

/** 簡易互動：在終端讓使用者輸入 */
function prompt(question) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

// ── 核心同步 ─────────────────────────────────────────────────────

async function syncSource(sourceName, config, options = {}) {
	const targetPath = path.join(RESOURCES_PATH, sourceName);

	// 檢查版本鎖定
	const versions = readVersions();
	if (versions[sourceName]?.locked) {
		console.log(`  已鎖定，跳過`);
		return { skipped: true, reason: "locked" };
	}

	// 檢查是否需要同步
	if (!options.force) {
		const remoteSha = getRemoteHead(config.url);
		if (remoteSha && !needsSync(sourceName, remoteSha)) {
			console.log(`  已是最新，跳過`);
			return { skipped: true, reason: "up-to-date" };
		}
	}

	if (options.dryRun) {
		console.log(`  [模擬] 將從 ${config.url} 同步`);
		return { dryRun: true };
	}

	// 使用安全暫存目錄
	const tempDir = await mkdtemp(
		path.join(tmpdir(), `ab-tao-sync-${sourceName}-`),
	);

	try {
		// 克隆
		execFileSync("git", ["clone", "--depth", "1", config.url, tempDir], {
			stdio: "pipe",
			timeout: 60000,
		});

		// 取得 commit SHA
		const sha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: tempDir,
			encoding: "utf8",
			stdio: "pipe",
		}).trim();

		// 移除克隆的 .git
		fs.rmSync(path.join(tempDir, ".git"), { recursive: true, force: true });

		// 安全驗證 — 僅驗證指定的資源子目錄
		const pathsToValidate = config.validatePaths || [];
		if (pathsToValidate.length > 0) {
			for (const subDir of pathsToValidate) {
				const subPath = path.join(tempDir, subDir);
				if (!fs.existsSync(subPath)) continue;
				const { ok, summary } = await validateContent(subPath);
				if (!ok) {
					throw new Error(
						`${sourceName}/${subDir} 安全驗證失敗: ${summary.errors.map((e) => e.message).join(", ")}`,
					);
				}
			}
		} else {
			const { ok, summary } = await validateContent(tempDir);
			if (!ok) {
				throw new Error(
					`${sourceName} 安全驗證失敗: ${summary.errors.map((e) => e.message).join(", ")}`,
				);
			}
		}

		// 原子替換：備份 → 替換 → 清理
		const backupPath = `${targetPath}.bak`;

		if (fs.existsSync(targetPath)) {
			fs.renameSync(targetPath, backupPath);
		}

		try {
			fs.mkdirSync(path.dirname(targetPath), { recursive: true });
			fs.cpSync(tempDir, targetPath, { recursive: true });
			recordSync(sourceName, sha);

			if (fs.existsSync(backupPath)) {
				fs.rmSync(backupPath, { recursive: true, force: true });
			}
		} catch (err) {
			// 失敗時回滾
			if (fs.existsSync(backupPath)) {
				if (fs.existsSync(targetPath)) {
					fs.rmSync(targetPath, { recursive: true, force: true });
				}
				fs.renameSync(backupPath, targetPath);
			}
			throw err;
		}

		return { success: true, sha };
	} finally {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	}
}

async function syncSelected(sourceNames, options = {}) {
	console.log(`正在同步 ${sourceNames.length} 個來源...\n`);

	const results = [];
	for (const name of sourceNames) {
		const config = SOURCES_CONFIG[name];
		if (!config) {
			console.error(`未知的來源: ${name}`);
			continue;
		}
		console.log(`${config.icon} [${name}] ${config.description}`);
		try {
			const result = await syncSource(name, config, options);
			results.push({ source: name, ...result });
			if (result.success) {
				console.log(`  已同步 (${result.sha.slice(0, 8)})`);
			}
		} catch (err) {
			results.push({ source: name, success: false, error: err.message });
			console.error(`  失敗: ${err.message}`);
		}
		console.log();
	}

	const succeeded = results.filter((r) => r.success).length;
	const skipped = results.filter((r) => r.skipped).length;
	const failed = results.filter((r) => r.success === false).length;
	console.log(`完成: ${succeeded} 已同步, ${skipped} 已跳過, ${failed} 失敗`);

	return results;
}

/** 統計單一來源的資源數量 */
function countResources(sourceName) {
	const sourceDir = path.join(RESOURCES_PATH, sourceName);
	if (!fs.existsSync(sourceDir)) return null;
	const count = (sub) => {
		const dir = path.join(sourceDir, sub);
		if (!fs.existsSync(dir)) return 0;
		return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length;
	};
	const commands = count("commands");
	const agents = count("agents");
	const rules = count("rules");
	// skills: 子目錄含 SKILL.md
	let skills = 0;
	const skillsDir = path.join(sourceDir, "skills");
	if (fs.existsSync(skillsDir)) {
		for (const d of fs.readdirSync(skillsDir, { withFileTypes: true })) {
			if (
				d.isDirectory() &&
				fs.existsSync(path.join(skillsDir, d.name, "SKILL.md"))
			)
				skills++;
		}
	}
	return { commands, agents, rules, skills };
}

/** 列出所有可用來源及狀態 */
function listSources() {
	const versions = readVersions();
	const names = Object.keys(SOURCES_CONFIG);

	console.log(`\n📦 可用的 AI 資源來源（共 ${names.length} 個）`);
	for (let i = 0; i < names.length; i++) {
		const name = names[i];
		const config = SOURCES_CONFIG[name];
		const ver = versions[name];
		const locked = ver?.locked ? " 🔒" : "";
		const synced = ver?.sha
			? `✔ ${ver.sha.slice(0, 8)} (${ver.date})`
			: "✗ 尚未同步";
		console.log(
			`  ${i + 1}. ${config.icon} ${name}${locked} — ${config.description}`,
		);
		const stats = countResources(name);
		if (stats) {
			const parts = [];
			if (stats.commands) parts.push(`${stats.commands} commands`);
			if (stats.agents) parts.push(`${stats.agents} agents`);
			if (stats.rules) parts.push(`${stats.rules} rules`);
			if (stats.skills) parts.push(`${stats.skills} skills`);
			console.log(`     ${synced} · ${parts.join(" · ") || "空"}`);
		} else {
			console.log(`     ${synced}`);
		}
	}

	console.log(`\n📋 用法:`);
	console.log(`  pnpm run c:sync:all                  同步全部`);
	console.log(`  pnpm run c:sync:select               互動式選擇`);
	console.log(`  pnpm run c:sync -- --pick ecc,anthropic  同步指定來源`);
	console.log(`  pnpm run c:sync -- --source <name>   同步單一來源`);
	console.log(`  加上 --force 強制同步 --dry-run 模擬`);
}

/** 互動式選擇來源 */
async function interactiveSelect() {
	const names = Object.keys(SOURCES_CONFIG);
	const versions = readVersions();

	console.log(
		"\n📦 選擇要同步的 AI 來源（輸入編號，逗號分隔，直接 Enter 跳過）",
	);
	for (let i = 0; i < names.length; i++) {
		const name = names[i];
		const config = SOURCES_CONFIG[name];
		const ver = versions[name];
		const tag = ver?.sha ? `✔ ${ver.date}` : "✗";
		console.log(
			`  ${i + 1}. ${config.icon} ${name} — ${config.description} [${tag}]`,
		);
	}

	const answer = await prompt("\n  選擇 (例: 1,2,3 或 all 或 Enter 跳過): ");

	if (!answer) {
		console.log("\n  已跳過同步。\n");
		return [];
	}

	if (answer === "all") {
		return names;
	}

	const indices = answer
		.split(",")
		.map((s) => Number.parseInt(s.trim(), 10) - 1)
		.filter((i) => i >= 0 && i < names.length);

	return indices.map((i) => names[i]);
}

// ── CLI 入口 ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const options = { force, dryRun };

if (args.includes("--source")) {
	// 單一來源
	const idx = args.indexOf("--source");
	const sourceName = args[idx + 1];
	if (!SOURCES_CONFIG[sourceName]) {
		console.error(`未知的來源: ${sourceName}`);
		console.error(`可用來源: ${Object.keys(SOURCES_CONFIG).join(", ")}`);
		process.exit(1);
	}
	syncSource(sourceName, SOURCES_CONFIG[sourceName], options)
		.then((r) => r.success && console.log(`  已同步 (${r.sha.slice(0, 8)})`))
		.catch((err) => {
			console.error(err.message);
			process.exit(1);
		});
} else if (args.includes("--all")) {
	// 全部同步
	syncSelected(Object.keys(SOURCES_CONFIG), options).catch((err) => {
		console.error(err.message);
		process.exit(1);
	});
} else if (args.includes("--pick")) {
	// 逗號分隔選擇
	const idx = args.indexOf("--pick");
	const picked = (args[idx + 1] || "").split(",").filter(Boolean);
	if (picked.length === 0) {
		console.error("請指定來源名稱，例: --pick ecc,anthropic");
		process.exit(1);
	}
	syncSelected(picked, options).catch((err) => {
		console.error(err.message);
		process.exit(1);
	});
} else if (args.includes("--select")) {
	// 互動式選擇
	interactiveSelect()
		.then((selected) =>
			selected.length > 0 ? syncSelected(selected, options) : null,
		)
		.catch((err) => {
			console.error(err.message);
			process.exit(1);
		});
} else {
	// 預設：列出來源，不同步
	listSources();
}

export { SOURCES_CONFIG, syncSelected, syncSource };
