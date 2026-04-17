#!/usr/bin/env node

/**
 * pnpm run d:sync — iCloud 偏好同步
 *
 * 子命令：
 *   （無參數）   互動式選擇 push / pull
 *   push         本地偏好 → iCloud
 *   pull         iCloud → 本地偏好
 *   status       顯示同步狀態
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import {
	getSyncStatus,
	ICLOUD_SYNC_DIR,
	pullPrefs,
	pushPrefs,
} from "../libs/external/ab-async.mjs";

const subCmd = process.argv[2]; // push | pull | status | undefined

async function main() {
	p.intro(pc.bold("ab-tao ☁️  iCloud 偏好同步"));

	// 讀取 session 中的 sync99Local 偏好
	let sync99Local = false;
	try {
		const { loadSession } = await import("../libs/core/session.mjs");
		const session = loadSession();
		sync99Local = session?.preferences?.sync99Local ?? false;
	} catch {
		// session 不存在則使用預設值
	}

	if (subCmd === "status") {
		showStatus({ sync99Local });
		p.outro("");
		return;
	}

	if (subCmd === "push") {
		await doPush({ sync99Local });
		return;
	}

	if (subCmd === "pull") {
		await doPull({ force: process.argv.includes("--force"), sync99Local });
		return;
	}

	// 互動式選擇
	showStatus({ sync99Local });

	const action = await p.select({
		message: "選擇操作",
		options: [
			{
				value: "push",
				label: "⬆️  Push — 本地 → iCloud",
				hint: "覆蓋 iCloud 上的偏好",
			},
			{
				value: "pull",
				label: "⬇️  Pull — iCloud → 本地",
				hint: "拉取 iCloud 偏好並套用（本地變更備份為 .bak）",
			},
			{ value: "exit", label: "👋 退出" },
		],
	});

	if (p.isCancel(action) || action === "exit") {
		p.outro(pc.dim("已取消"));
		return;
	}

	if (action === "push") await doPush({ sync99Local });
	if (action === "pull") await doPull({ sync99Local });
}

// ── 操作 ──────────────────────────────────────────────────────────

async function doPush({ sync99Local = false } = {}) {
	const status = getSyncStatus({ sync99Local });
	if (!status.available) {
		p.log.error(
			"iCloud Drive 不可用（請確認已登入 Apple ID 並啟用 iCloud Drive）",
		);
		process.exit(1);
	}

	const spinner = p.spinner();
	spinner.start("推送偏好至 iCloud…");
	let result;
	try {
		result = pushPrefs({ sync99Local });
	} catch (err) {
		spinner.stop(pc.red("推送失敗"));
		p.log.error(err.message);
		process.exit(1);
	}
	spinner.stop("推送完成");

	for (const f of result.pushed) p.log.success(f);
	for (const f of result.skipped) p.log.warn(`${f} — 本地不存在，略過`);
	for (const e of result.errors) p.log.error(e);

	p.log.info(`同步目錄：${ICLOUD_SYNC_DIR}`);
	p.outro(
		result.errors.length === 0
			? pc.green("✔ Push 完成")
			: pc.yellow(`⚠ 完成但有 ${result.errors.length} 個錯誤`),
	);
}

async function doPull({ force = false, sync99Local = false } = {}) {
	const status = getSyncStatus({ sync99Local });
	if (!status.available) {
		p.log.error(
			"iCloud Drive 不可用（請確認已登入 Apple ID 並啟用 iCloud Drive）",
		);
		process.exit(1);
	}

	const hasRemote = status.diffs.some(
		(d) => d.status !== "local-only" && d.status !== "both-missing",
	);
	if (!hasRemote) {
		p.log.warn("iCloud 上尚無偏好檔案，請先執行 push");
		p.outro("");
		return;
	}

	const hasDivergence = status.diffs.some((d) => d.status === "diverged");
	if (hasDivergence && !force) {
		p.log.info("本地與 iCloud 有差異，本地現有檔案會備份為 .bak");
	}

	const spinner = p.spinner();
	spinner.start("從 iCloud 拉取偏好…");
	let result;
	try {
		result = pullPrefs({ force, sync99Local });
	} catch (err) {
		spinner.stop(pc.red("拉取失敗"));
		p.log.error(err.message);
		process.exit(1);
	}
	spinner.stop("拉取完成");

	for (const f of result.pulled) p.log.success(f);
	for (const f of result.skipped) p.log.warn(`${f} — iCloud 上不存在，略過`);
	for (const e of result.errors) p.log.error(e);

	p.outro(
		result.errors.length === 0
			? pc.green("✔ Pull 完成，請重新載入 ZSH：exec zsh")
			: pc.yellow(`⚠ 完成但有 ${result.errors.length} 個錯誤`),
	);
}

// ── 狀態顯示 ──────────────────────────────────────────────────────

function showStatus({ sync99Local = false } = {}) {
	const status = getSyncStatus({ sync99Local });

	const syncIcon = !status.available
		? pc.dim("☁️  不可用")
		: status.lastPush === null
			? pc.yellow("☁️  未同步")
			: pc.cyan("☁️  已連線");

	console.log();
	console.log(`  ${syncIcon}`);

	if (status.lastPush) {
		const d = new Date(status.lastPush);
		console.log(
			`  上次 Push：${pc.cyan(d.toLocaleDateString("zh-TW"))} ${pc.dim(d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }))}  ${status.device ? pc.dim(`（${status.device}）`) : ""}`,
		);
	}
	if (status.lastPull) {
		const d = new Date(status.lastPull);
		console.log(
			`  上次 Pull：${pc.cyan(d.toLocaleDateString("zh-TW"))} ${pc.dim(d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }))}`,
		);
	}

	if (status.available) {
		console.log();
		for (const diff of status.diffs) {
			const icon =
				diff.status === "in-sync"
					? pc.green("✔")
					: diff.status === "diverged"
						? pc.yellow("⚠")
						: diff.status === "local-only"
							? pc.dim("→")
							: diff.status === "remote-only"
								? pc.dim("←")
								: pc.dim("?");
			const hint =
				diff.status === "in-sync"
					? "已同步"
					: diff.status === "diverged"
						? "有差異"
						: diff.status === "local-only"
							? "僅本地"
							: diff.status === "remote-only"
								? "僅 iCloud"
								: diff.status === "both-missing"
									? "不存在"
									: "";
			console.log(`  ${icon}  ${diff.label.padEnd(40)} ${pc.dim(hint)}`);
		}
	}
	console.log();
}

main().catch((e) => {
	p.log.error(e.message);
	process.exit(1);
});
