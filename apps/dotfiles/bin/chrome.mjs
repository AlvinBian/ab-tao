#!/usr/bin/env node
/**
 * Chrome 優化配置 CLI
 * Usage: pnpm run d:chrome [setup|status] [--profile=kkday-frontend] [--dry-run]
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(__dirname, "..");

const [, , cmd = "setup", ...args] = process.argv;

const chromeMod = await import("../libs/features/chrome.mjs");
const feature = chromeMod.default;

const ctx = {
	repoDir,
	flags: {
		dryRun: args.includes("--dry-run"),
		all: args.includes("--all"),
		quick: args.includes("--quick"),
	},
	_path: { join: path.join },
	backupDir: path.join(
		repoDir,
		"dist",
		"backup",
		new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
		"chrome",
	),
	previewDir: path.join(repoDir, "dist", "preview", "chrome"),
};

if (cmd === "setup") {
	const envResult = await feature.envCheck();
	if (!envResult.ok) {
		console.error("環境檢查失敗：", envResult.message);
		process.exit(1);
	}
	console.log("環境：", envResult.message);

	const config = await feature.configure(ctx);
	if (!config) {
		console.log("已取消");
		process.exit(0);
	}

	const plan = await feature.plan(ctx, config);
	if (!plan) {
		console.log("無計畫");
		process.exit(0);
	}

	const confirmed = await feature.confirm(ctx, plan);
	if (!confirmed) {
		console.log("已取消");
		process.exit(0);
	}

	await feature.backup(ctx);
	const result = await feature.install(ctx, plan);
	const verify = await feature.verify(ctx, result);
	const summary = feature.complete(result);
	console.log(summary.join("\n"));
	console.log(`驗證: ${verify.passed}/${verify.total}`);
} else if (cmd === "status") {
	const envResult = await feature.envCheck();
	console.log("Chrome 狀態：", envResult.message);
} else {
	console.error(`未知指令：${cmd}。可用：setup, status`);
	process.exit(1);
}
