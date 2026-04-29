#!/usr/bin/env node

/**
 * c:plugin --audit — Plugin 審查報告
 *
 * 輸出：
 *   - enabled plugins 清單 + 版本
 *   - ghost plugins（enabled 但未安裝或路徑損壞）
 *   - on-demand 建議
 */

import {
	listPlugins,
	verifyPluginCachePaths,
	verifyPluginIntegrity,
} from "../libs/install/plugin-manager.mjs";

function main() {
	// 列出所有宣告的 plugins
	let allPlugins;
	try {
		allPlugins = listPlugins();
	} catch {
		console.log("找不到 plugins 設定（plugins.yml 不存在或無法讀取）");
		process.exit(0);
	}

	console.log("── Plugin 審查報告 ──────────────────────────────────────────");

	// enabled plugins 清單
	const activePlugins = allPlugins.filter((p) => p.active);
	console.log(`\n已啟用 plugins（${activePlugins.length} 個）：`);
	if (activePlugins.length === 0) {
		console.log("  （無）");
	} else {
		for (const p of activePlugins) {
			console.log(`  ✓ ${p.name}  （${p.description || "無說明"}）`);
		}
	}

	// 宣告但未啟用
	const declaredNotActive = allPlugins.filter((p) => !p.active);
	if (declaredNotActive.length > 0) {
		console.log(`\n已宣告未啟用 plugins（${declaredNotActive.length} 個）：`);
		for (const p of declaredNotActive) {
			console.log(`  ○ ${p.name}  （${p.description || "無說明"}）`);
		}
	}

	// Ghost plugins（enabled 但路徑損壞）
	let brokenPaths = [];
	try {
		const result = verifyPluginCachePaths();
		brokenPaths = result.broken;
	} catch {
		// verifyPluginCachePaths 失敗時忽略
	}

	if (brokenPaths.length > 0) {
		console.log(
			`\n⚠️  Ghost plugins（enabled 但 cache 路徑損壞，${brokenPaths.length} 個）：`,
		);
		for (const key of brokenPaths) {
			console.log(`  ✗ ${key}`);
		}
		console.log(
			"\n  修復方式：pnpm run d:setup  或  claude plugin install <name>",
		);
	}

	// Phantom plugins（enabled 但 plugins.yml 未宣告）
	let phantoms = [];
	try {
		const result = verifyPluginIntegrity();
		phantoms = result.phantoms;
	} catch {
		// verifyPluginIntegrity 失敗時忽略
	}

	if (phantoms.length > 0) {
		console.log(
			`\n⚠️  Phantom plugins（enabled 但 plugins.yml 未宣告，${phantoms.length} 個）：`,
		);
		for (const key of phantoms) {
			console.log(`  ⁉ ${key}`);
		}
	}

	if (brokenPaths.length === 0 && phantoms.length === 0) {
		console.log("\n✅ 無 ghost / phantom plugins");
	}

	// On-demand 建議
	if (declaredNotActive.length > 0) {
		console.log("\n建議：以下 plugins 可設為 on-demand 以降低資源佔用：");
		for (const p of declaredNotActive.slice(0, 5)) {
			console.log(`  → ${p.name}`);
		}
	}

	console.log("\n──────────────────────────────────────────────────────────");
}

try {
	main();
} catch (e) {
	console.error(`執行失敗：${e.message}`);
	process.exit(1);
}
