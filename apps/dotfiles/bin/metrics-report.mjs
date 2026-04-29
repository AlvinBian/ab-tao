#!/usr/bin/env node

/**
 * c:metrics --report — Metrics 統計報告
 *
 * 用法：
 *   pnpm run c:metrics                     輸出最近 30 天統計摘要
 *   pnpm run c:metrics --report            同上
 *   pnpm run c:metrics --upgrade-readiness 輸出 v1.7+ 升級觸發條件狀態
 */

import fs from "node:fs";
import { P } from "../libs/core/paths.mjs";

const UPGRADE_READINESS = process.argv.includes("--upgrade-readiness");

/** 讀取並解析 metrics.jsonl，回傳最近 N 天的事件陣列 */
function loadMetrics(days = 30) {
	const metricsFile = P.metrics;
	if (!fs.existsSync(metricsFile)) {
		return null;
	}

	const raw = fs.readFileSync(metricsFile, "utf8").trim();
	if (!raw) return [];

	const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
	const events = [];

	for (const line of raw.split("\n")) {
		if (!line.trim()) continue;
		try {
			const entry = JSON.parse(line);
			const ts = entry.ts ? new Date(entry.ts).getTime() : Date.now();
			if (ts >= cutoff) {
				events.push(entry);
			}
		} catch {
			// 跳過格式錯誤的行
		}
	}

	return events;
}

/** 輸出最近 30 天統計摘要 */
function printSummary(events) {
	console.log(
		"── Metrics 統計摘要（最近 30 天）──────────────────────────────",
	);

	if (events.length === 0) {
		console.log("  （本期間無 metrics 記錄）");
		console.log("──────────────────────────────────────────────────────────");
		return;
	}

	// 按 type 統計
	const byType = {};
	for (const e of events) {
		const t = e.type ?? e.event ?? "unknown";
		byType[t] = (byType[t] ?? 0) + 1;
	}

	console.log(`\n總事件數：${events.length}`);
	console.log("\n事件類型分布：");
	for (const [type, count] of Object.entries(byType).sort(
		(a, b) => b[1] - a[1],
	)) {
		const bar = "█".repeat(Math.min(Math.ceil(count / 2), 20));
		console.log(`  ${type.padEnd(30)} ${String(count).padStart(5)}  ${bar}`);
	}

	// skill 調用統計
	const skillEvents = events.filter((e) =>
		(e.type ?? e.event ?? "").includes("skill"),
	);
	if (skillEvents.length > 0) {
		console.log(`\nSkill 調用次數：${skillEvents.length}`);
	}

	// 錯誤率
	const errorEvents = events.filter((e) =>
		(e.type ?? e.event ?? "").includes("error"),
	);
	if (errorEvents.length > 0) {
		const rate = ((errorEvents.length / events.length) * 100).toFixed(1);
		console.log(`錯誤事件：${errorEvents.length}（${rate}%）`);
	}

	console.log("──────────────────────────────────────────────────────────");
}

/** 輸出 v1.7+ 升級觸發條件狀態 */
function printUpgradeReadiness(events) {
	console.log("── v1.7+ 升級觸發條件評估 ──────────────────────────────────");

	// 條件 1：chain_invocations（multi-agent 調用次數 ≥ 50）
	const chainCount = events.filter((e) =>
		["chain", "agent_chain", "multi_agent"].some((k) =>
			(e.type ?? "").includes(k),
		),
	).length;
	const chainReady = chainCount >= 50;
	console.log(
		`\n[${chainReady ? "✓" : "○"}] chain_invocations    ${chainCount} / 50${chainReady ? " (達標)" : ""}`,
	);

	// 條件 2：adversarial_invocations（對抗性操作次數 ≥ 10）
	const adversarialCount = events.filter((e) =>
		["adversarial", "injection", "bypass"].some((k) =>
			(e.type ?? "").includes(k),
		),
	).length;
	const adversarialReady = adversarialCount >= 10;
	console.log(
		`[${adversarialReady ? "✓" : "○"}] adversarial_invocations ${adversarialCount} / 10${adversarialReady ? " (達標)" : ""}`,
	);

	// 條件 3：skill_invocation_rate（skill 調用率 ≥ 20%）
	const skillCount = events.filter((e) =>
		(e.type ?? e.event ?? "").includes("skill"),
	).length;
	const skillRate = events.length > 0 ? (skillCount / events.length) * 100 : 0;
	const skillRateReady = skillRate >= 20;
	console.log(
		`[${skillRateReady ? "✓" : "○"}] skill_invocation_rate ${skillRate.toFixed(1)}% / 20%${skillRateReady ? " (達標)" : ""}`,
	);

	// 條件 4：unmatched-intents（未命中意圖數 ≥ 5）
	const unmatchedCount = events.filter((e) =>
		["unmatched", "intent_miss", "no_match"].some((k) =>
			(e.type ?? "").includes(k),
		),
	).length;
	const unmatchedReady = unmatchedCount >= 5;
	console.log(
		`[${unmatchedReady ? "✓" : "○"}] unmatched-intents    ${unmatchedCount} / 5${unmatchedReady ? " (達標)" : ""}`,
	);

	const readyCount = [
		chainReady,
		adversarialReady,
		skillRateReady,
		unmatchedReady,
	].filter(Boolean).length;
	console.log(`\n升級整備度：${readyCount} / 4 條件達標`);
	if (readyCount >= 3) {
		console.log("✅ 建議考慮升級至 v1.7+");
	} else {
		console.log(`○ 尚未達到升級門檻（需 3/4 條件）`);
	}

	console.log("──────────────────────────────────────────────────────────");
}

function main() {
	const events = loadMetrics(30);

	if (events === null) {
		console.log("尚無 metrics 資料，請先使用 ab-tao 功能累積資料。");
		console.log(`  metrics 檔案路徑：${P.metrics}`);
		process.exit(0);
	}

	if (UPGRADE_READINESS) {
		printUpgradeReadiness(events);
	} else {
		printSummary(events);
	}
}

try {
	main();
} catch (e) {
	console.error(`執行失敗：${e.message}`);
	process.exit(1);
}
