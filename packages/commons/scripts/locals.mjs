#!/usr/bin/env node
/**
 * c:locals — 本地整合服務管理
 *
 * 管理 claude-context（LM Studio + Milvus）、browser-harness（Python venv）
 * 及 awesome-ai-pedia（git repo）的狀態查看、啟動、停止與診斷。
 *
 * 使用方式：pnpm run c:locals [--status|--start|--stop|--doctor|--install]
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const HARNESS_VENV = join(HOME, ".ab-tao", "browser-harness", ".venv");
const AIPEDIA_DIR = join(HOME, ".ab-tao", "external", "awesome-ai-pedia");

// ── 狀態偵測 ────────────────────────────────────────────────────────

function checkPort(port) {
	try {
		execFileSync(
			"curl",
			["-sf", "--max-time", "2", `http://127.0.0.1:${port}/healthz`],
			{
				stdio: "pipe",
			},
		);
		return true;
	} catch {
		return false;
	}
}

function checkLmStudio() {
	try {
		execFileSync(
			"curl",
			["-sf", "--max-time", "2", "http://127.0.0.1:1234/v1/models"],
			{
				stdio: "pipe",
			},
		);
		return true;
	} catch {
		return false;
	}
}

function checkDocker() {
	try {
		execFileSync("docker", ["info"], { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

function checkBrowserHarness() {
	const playwrightBin = join(HARNESS_VENV, "bin", "playwright");
	if (!existsSync(playwrightBin)) return false;
	try {
		execFileSync(playwrightBin, ["--version"], { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

function checkAiPedia() {
	return existsSync(join(AIPEDIA_DIR, ".git"));
}

function getStatus() {
	return {
		lmStudio: checkLmStudio(),
		milvus: checkPort(19530),
		docker: checkDocker(),
		browserHarness: checkBrowserHarness(),
		aiPedia: checkAiPedia(),
	};
}

// ── 命令處理 ────────────────────────────────────────────────────────

function cmdStatus() {
	const s = getStatus();
	const icon = (ok) => (ok ? "✅" : "❌");

	console.log("── 本地整合服務狀態 ──");
	console.log(`${icon(s.docker)}    Docker daemon`);
	console.log(`${icon(s.lmStudio)} LM Studio       (port 1234)`);
	console.log(`${icon(s.milvus)}   Milvus          (port 19530)`);
	console.log(`${icon(s.browserHarness)} browser-harness (${HARNESS_VENV})`);
	console.log(`${icon(s.aiPedia)}   AI-Pedia        (${AIPEDIA_DIR})`);

	const missing = [];
	if (!s.lmStudio) missing.push("LM Studio（手動啟動 GUI）");
	if (!s.milvus)
		missing.push(
			"Milvus（docker compose -f ~/.ab-tao/milvus/docker-compose.yml up -d）",
		);
	if (!s.browserHarness) missing.push("browser-harness（pnpm run d:setup）");
	if (!s.aiPedia)
		missing.push("AI-Pedia（pnpm run c:ai-sync --source awesome-ai-pedia）");

	if (missing.length) {
		console.log("\n未就緒服務：");
		for (const m of missing) console.log(`  • ${m}`);
	} else {
		console.log("\n所有服務已就緒 ✅");
	}
}

function cmdStart() {
	const s = getStatus();
	console.log("── 啟動本地服務 ──");

	if (!s.docker) {
		console.log("⚠️  Docker daemon 未啟動，請手動開啟 Docker Desktop");
	}

	if (s.docker && !s.milvus) {
		const composeFile = join(HOME, ".ab-tao", "milvus", "docker-compose.yml");
		if (existsSync(composeFile)) {
			console.log("▶ 啟動 Milvus...");
			const r = spawnSync(
				"docker",
				["compose", "-f", composeFile, "up", "-d"],
				{
					stdio: "inherit",
				},
			);
			if (r.status === 0) console.log("✅ Milvus 已啟動");
			else console.log("❌ Milvus 啟動失敗，請查看 Docker 日誌");
		} else {
			console.log(`⚠️  Milvus docker-compose.yml 不存在（${composeFile}）`);
			console.log("   請參考 docs/local-tools.md § A 安裝 Milvus");
		}
	}

	if (!s.lmStudio) {
		console.log("⚠️  LM Studio 需要手動啟動 GUI（無法自動啟動）");
		console.log("   啟動後確認 nomic-embed-text-v2-moe 模型已載入");
	}

	if (s.milvus && s.lmStudio) {
		console.log("✅ claude-context 服務已就緒");
	}
}

function cmdStop() {
	console.log("── 停止本地服務 ──");
	const composeFile = join(HOME, ".ab-tao", "milvus", "docker-compose.yml");
	if (existsSync(composeFile)) {
		console.log("▶ 停止 Milvus...");
		const r = spawnSync("docker", ["compose", "-f", composeFile, "down"], {
			stdio: "inherit",
		});
		if (r.status === 0) console.log("✅ Milvus 已停止");
	} else {
		console.log("ℹ️  Milvus compose file 不存在，略過");
	}
	console.log("ℹ️  LM Studio 請手動關閉 GUI");
}

function cmdDoctor() {
	console.log("── 診斷本地整合服務 ──");
	const s = getStatus();

	const issues = [];
	if (!s.docker) issues.push("Docker daemon 未執行 → 開啟 Docker Desktop");
	if (!s.lmStudio)
		issues.push(
			"LM Studio 未執行 → 開啟 LM Studio 並載入 nomic-embed-text-v2-moe",
		);
	if (!s.milvus && s.docker)
		issues.push("Milvus 未執行 → pnpm run c:locals --start");
	if (!s.browserHarness)
		issues.push(
			`browser-harness venv 不存在（${HARNESS_VENV}）→ pnpm run d:setup`,
		);
	if (!s.aiPedia)
		issues.push(
			`AI-Pedia 未同步（${AIPEDIA_DIR}）→ pnpm run c:ai-sync --source awesome-ai-pedia`,
		);

	if (issues.length === 0) {
		console.log("✅ 所有本地整合服務正常");
	} else {
		console.log(`發現 ${issues.length} 個問題：`);
		for (const issue of issues) console.log(`  ⚠️  ${issue}`);
	}
}

function cmdInstall() {
	console.log("── 安裝本地整合服務 ──");
	console.log("請執行 pnpm run d:setup 並在功能選單勾選：");
	console.log("  🔍 語義代碼搜尋（claude-context）");
	console.log("  🌐 browser-harness");
	console.log("  📖 Awesome-AI-Pedia");
	console.log("\nMilvus 安裝請參考：docs/local-tools.md § A");
}

// ── CLI 入口 ────────────────────────────────────────────────────────

const arg = process.argv[2];
switch (arg) {
	case "--status":
		cmdStatus();
		break;
	case "--start":
		cmdStart();
		break;
	case "--stop":
		cmdStop();
		break;
	case "--doctor":
		cmdDoctor();
		break;
	case "--install":
		cmdInstall();
		break;
	default:
		console.log(
			"使用方式：pnpm run c:locals [--status|--start|--stop|--doctor|--install]",
		);
		process.exit(1);
}
