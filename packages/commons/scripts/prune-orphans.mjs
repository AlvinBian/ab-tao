#!/usr/bin/env node
/**
 * prune-orphans.mjs — 清理 resources/ai/sources/ 中未在 SOURCES_CONFIG 登記的孤兒目錄
 *
 * 用法：
 *   node prune-orphans.mjs            dry-run（只顯示，不刪除）
 *   node prune-orphans.mjs --apply    實際刪除孤兒目錄
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = path.resolve(__dirname, "../resources/ai/sources");
const APPLY = process.argv.includes("--apply");

// 已登記來源（與 sync-sources.mjs 保持一致）
const KNOWN_SOURCES = new Set([
	"ecc",
	"anthropic",
	"superpowers",
	"context-engineering",
	"skills-mp",
	"openskills",
]);

if (!fs.existsSync(RESOURCES_PATH)) {
	console.log("resources/ai/sources/ 不存在，無需清理。");
	process.exit(0);
}

const dirs = fs
	.readdirSync(RESOURCES_PATH, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name);

const orphans = dirs.filter((d) => !KNOWN_SOURCES.has(d));

if (orphans.length === 0) {
	console.log("✅ 無孤兒來源目錄。");
	process.exit(0);
}

console.log(`找到 ${orphans.length} 個孤兒來源目錄：`);
for (const o of orphans) {
	const fullPath = path.join(RESOURCES_PATH, o);
	const size = getDirSize(fullPath);
	console.log(`  - ${o}  (${formatBytes(size)})`);
}

if (!APPLY) {
	console.log("\n提示：加 --apply 旗標實際刪除。");
	process.exit(0);
}

console.log("\n開始刪除孤兒目錄...");
for (const o of orphans) {
	const fullPath = path.join(RESOURCES_PATH, o);
	fs.rmSync(fullPath, { recursive: true, force: true });
	console.log(`  ✅ 已刪除：${o}`);
}
console.log(`\n清理完成，共移除 ${orphans.length} 個孤兒目錄。`);

function getDirSize(dir) {
	let total = 0;
	try {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, entry.name);
			if (entry.isDirectory()) total += getDirSize(p);
			else total += fs.statSync(p).size;
		}
	} catch {}
	return total;
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
