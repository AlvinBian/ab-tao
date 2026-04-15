/**
 * Slack Feature — Slack 通知配置 pipeline
 *
 * 生命週期：envCheck → backup → configure → plan → confirm → install → verify → complete
 * 透過 setupSlackNotify 互動式收集設定，寫入 .env 並部署 Slack hooks。
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { env } from "../core/env.mjs";
import { HOME } from "../core/paths.mjs";

export default {
	id: "slack",
	label: "💬 Slack 通知",
	hint: "Channel / DM",
	dependsOn: [],
	conflicts: [],

	/**
	 * 1. 環境檢查 — Slack 無前置依賴，永遠通過
	 */
	async envCheck() {
		return { ok: true, message: "💬 Slack 無前置依賴" };
	},

	/**
	 * 2. 備份 — 備份 {repoDir}/.env（若存在）
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

		tryBackup(path.join(ctx.repoDir, ".env"), "repo-env");

		return { files: backed, dir: backupDir };
	},

	/**
	 * 3. 互動配置 — 委託給 setupSlackNotify
	 */
	async configure(ctx) {
		if (ctx.flags?.quick) {
			// 從 session 重建 Slack 設定
			if (ctx.prev?.slackChannel || ctx.prev?.slackMode) {
				return {
					slack: {
						channelId: ctx.prev.slackChannel,
						mode: ctx.prev.slackMode || "channel",
						userId: ctx.prev.slackUserId || "",
					},
				};
			}
			return null; // 上次沒設 Slack
		}

		const { setupSlackNotify } = await import("../external/slack-setup.mjs");
		const result = await setupSlackNotify(ctx.prev);
		if (!result) return null;
		return { slack: result };
	},

	/**
	 * 4. 生成計畫
	 */
	async plan(_ctx, config) {
		if (!config) return null;
		return {
			slack: config.slack,
			features: ["slack"],
			targets: ["slack"],
		};
	},

	/**
	 * 5. 確認 — setupSlackNotify 已有確認流程，此處自動通過
	 */
	async confirm(_ctx, plan) {
		if (!plan) return false;

		const slack = plan.slack;
		const modeLabel =
			slack.mode === "channel"
				? `Channel #${slack.channelId}`
				: slack.mode === "dm"
					? "DM 私發"
					: "已關閉";
		p.log.info(`Slack 通知 → ${modeLabel}`);

		return true;
	},

	/**
	 * 6. 安裝 — 寫入 .env + 部署 Slack hooks
	 */
	async install(ctx, plan) {
		if (!plan) return null;

		const slack = plan.slack;

		// ── 第一部分：寫入 .env 檔案 ──

		// 寫入 {repoDir}/.env
		const repoEnvPath = path.join(ctx.repoDir, ".env");
		let repoEnvContent = fs.existsSync(repoEnvPath)
			? fs.readFileSync(repoEnvPath, "utf8")
			: "";
		repoEnvContent = repoEnvContent
			.replace(/^SLACK_[A-Z_]+=.*/gm, "")
			.replace(/^CLAUDE_SLACK_MIN_SESSION_SECS=.*/gm, "")
			.replace(/\n{3,}/g, "\n\n")
			.trim();
		repoEnvContent += `\nSLACK_NOTIFY_CHANNEL=${slack.channelId}\nSLACK_NOTIFY_MODE=${slack.mode}`;
		if (slack.userId)
			repoEnvContent += `\nSLACK_NOTIFY_USER_ID=${slack.userId}`;
		repoEnvContent += `\nCLAUDE_SLACK_MIN_SESSION_SECS=${env("CLAUDE_SLACK_MIN_SESSION_SECS", "300")}`;
		repoEnvContent += "\n";
		fs.writeFileSync(repoEnvPath, repoEnvContent);

		// ── 第二部分：部署 Slack hooks（Slack 環境變數統一寫入 settings.json env）──
		const { deploySlackHooks } = await import(
			"../phases/execute/claude-tasks.mjs"
		);
		const slackAsPrev = {
			slackChannel: slack.channelId,
			slackMode: slack.mode,
			slackUserId: slack.userId || "",
			minSessionSecs: env("CLAUDE_SLACK_MIN_SESSION_SECS", "300"),
		};
		await deploySlackHooks({ repoDir: ctx.repoDir, prev: slackAsPrev });

		return {
			mode: slack.mode,
			channelId: slack.channelId,
		};
	},

	/**
	 * 7. 驗證 — 確認 .env 包含 SLACK_NOTIFY 且 settings.json env 含 SLACK_NOTIFY
	 */
	async verify(ctx) {
		let passed = 0;
		let total = 0;
		const missing = [];

		// 檢查 {repoDir}/.env 是否含 SLACK_NOTIFY
		total++;
		const repoEnvPath = path.join(ctx.repoDir, ".env");
		try {
			const content = fs.readFileSync(repoEnvPath, "utf8");
			if (content.includes("SLACK_NOTIFY")) passed++;
			else missing.push("SLACK_NOTIFY in .env");
		} catch {
			missing.push(".env");
		}

		// 檢查 settings.json env 是否含 SLACK_NOTIFY
		total++;
		const settingsPath = path.join(HOME, ".claude", "settings.json");
		try {
			const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
			if (settings.env?.SLACK_NOTIFY_CHANNEL) passed++;
			else missing.push("SLACK_NOTIFY in settings.json env");
		} catch {
			missing.push("settings.json");
		}

		return { passed, total, missing };
	},

	/**
	 * 8. 完成輸出 — 顯示模式與頻道
	 */
	complete(results) {
		if (!results) return [];
		const modeLabel =
			results.mode === "channel"
				? `Channel #${results.channelId}`
				: results.mode === "dm"
					? "DM 私發"
					: "已關閉";
		return ["💬 Slack 通知", `  模式：${modeLabel}`];
	},

	/**
	 * 9. 回滾 — 還原備份的 .env 檔案
	 */
	async rollback(ctx) {
		const backupDir = ctx.backupDir;
		if (!fs.existsSync(backupDir)) return;

		const restore = (name, dest) => {
			const src = path.join(backupDir, name);
			if (fs.existsSync(src)) {
				fs.copyFileSync(src, dest);
			}
		};

		restore("repo-env", path.join(ctx.repoDir, ".env"));
	},

	/**
	 * 10. Session 數據
	 */
	session(results) {
		return {
			slackChannel: results?.channelId || "",
			slackMode: results?.mode || "",
			installedAt: new Date().toISOString(),
		};
	},

	/**
	 * 11. 清理
	 */
	async cleanup() {
		// Slack 功能無需額外清理
	},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		return {
			feature: "slack",
			mode: results?.mode || "",
			channelId: results?.channelId || "",
		};
	},
};
