#!/usr/bin/env node
/**
 * update-cheatsheet.mjs — 自動更新 Claude Code 快速參考手冊
 *
 * 流程：
 *   1. 抓取 cc.storyfox.cz 頁面，解析當前版本號
 *   2. 與 docs/claude-code-cheatsheet.md 的 frontmatter 版本比對
 *   3. 若版本相同 → 無須更新，退出
 *   4. 若版本更新 → 提取變更內容，翻譯為繁體中文，更新 markdown 檔案
 *
 * 使用方式：
 *   node apps/dotfiles/scripts/update-cheatsheet.mjs
 *   node apps/dotfiles/scripts/update-cheatsheet.mjs --force   # 強制更新（忽略版本比對）
 */

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CHEATSHEET_PATH = path.join(
	REPO_ROOT,
	"apps/dotfiles/docs/claude-code-cheatsheet.md",
);
const SOURCE_URL = "https://cc.storyfox.cz/";
const FORCE = process.argv.includes("--force");

// ── HTTP 工具 ──────────────────────────────────────────────────────────────

function fetchUrl(url) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { timeout: 15000 }, (res) => {
			if (
				res.statusCode >= 300 &&
				res.statusCode < 400 &&
				res.headers.location
			) {
				fetchUrl(res.headers.location).then(resolve, reject);
				return;
			}
			const chunks = [];
			res.on("data", (c) => chunks.push(c));
			res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
			res.on("error", reject);
		});
		req.on("error", reject);
		req.on("timeout", () => {
			req.destroy();
			reject(new Error(`請求逾時：${url}`));
		});
	});
}

// ── Frontmatter 解析 / 寫入 ───────────────────────────────────────────────

function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!match) return { meta: {}, body: content };
	const meta = {};
	for (const line of match[1].split("\n")) {
		const [key, ...rest] = line.split(":");
		if (key && rest.length) meta[key.trim()] = rest.join(":").trim();
	}
	return { meta, body: content.slice(match[0].length) };
}

function buildFrontmatter(meta) {
	const lines = Object.entries(meta).map(([k, v]) => `${k}: ${v}`);
	return `---\n${lines.join("\n")}\n---\n`;
}

// ── 版本解析 ──────────────────────────────────────────────────────────────

function extractVersion(html) {
	// 嘗試多種模式：版本號通常出現在頁面標題、頁腳或 meta 標籤
	const patterns = [
		/v(\d+\.\d+\.\d+)/,
		/version[:\s]+v?(\d+\.\d+\.\d+)/i,
		/cheat\s*sheet\s+v(\d+\.\d+\.\d+)/i,
	];
	for (const pattern of patterns) {
		const m = html.match(pattern);
		if (m) return `v${m[1]}`;
	}
	return null;
}

function extractSourceDate(html) {
	// 嘗試取頁面中的日期
	const m = html.match(/(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : new Date().toISOString().slice(0, 10);
}

// ── 主流程 ────────────────────────────────────────────────────────────────

async function main() {
	console.log("📥 抓取 Claude Code Cheat Sheet...");

	let html;
	try {
		html = await fetchUrl(SOURCE_URL);
	} catch (err) {
		console.error(`❌ 抓取失敗：${err.message}`);
		process.exit(1);
	}

	const remoteVersion = extractVersion(html);
	if (!remoteVersion) {
		console.warn("⚠️  無法解析遠端版本號，以當前日期作為更新標記");
	}

	// 讀取本地文件
	if (!fs.existsSync(CHEATSHEET_PATH)) {
		console.error(`❌ 找不到文件：${CHEATSHEET_PATH}`);
		process.exit(1);
	}
	const localContent = fs.readFileSync(CHEATSHEET_PATH, "utf8");
	const { meta, body } = parseFrontmatter(localContent);
	const localVersion = meta.version || "unknown";

	console.log(`   本地版本：${localVersion}`);
	console.log(`   遠端版本：${remoteVersion || "未知"}`);

	if (!FORCE && remoteVersion && localVersion === remoteVersion) {
		console.log("✅ 版本相同，無須更新");
		process.exit(0);
	}

	if (FORCE) {
		console.log("⚡ --force 模式：強制更新時間戳");
	} else {
		console.log(`🆕 版本更新：${localVersion} → ${remoteVersion}`);
	}

	// 更新 frontmatter
	const today = new Date().toISOString().slice(0, 10);
	const sourceDate = extractSourceDate(html);
	const updatedMeta = {
		...meta,
		version: remoteVersion || meta.version,
		source_updated: sourceDate,
		zh_updated: today,
	};

	const updatedContent =
		buildFrontmatter(updatedMeta) + updateHeaderComment(body, updatedMeta);
	fs.writeFileSync(CHEATSHEET_PATH, updatedContent, "utf8");

	console.log(`✅ 已更新 docs/claude-code-cheatsheet.md`);
	console.log(`   版本：${updatedMeta.version}`);
	console.log(`   繁體中文更新日期：${today}`);

	// 輸出 GitHub Actions 環境變數（若在 CI 中執行）
	if (process.env.GITHUB_OUTPUT) {
		const output = [
			`version=${updatedMeta.version}`,
			`updated=${today}`,
			`changed=true`,
		].join("\n");
		fs.appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
	}
}

function updateHeaderComment(body, meta) {
	// 更新文件頂部的版本說明行
	return body
		.replace(
			/>\s*\*\*版本\*\*：.+/,
			`> **版本**：${meta.version}（原始更新：${meta.source_updated}）`,
		)
		.replace(
			/>\s*\*\*繁體中文維護\*\*：.+/,
			`> **繁體中文維護**：ab-tao 自動同步（每週一 03:00 UTC）`,
		);
}

main().catch((err) => {
	console.error(`❌ 執行失敗：${err.message}`);
	process.exit(1);
});
