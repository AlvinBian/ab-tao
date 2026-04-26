#!/usr/bin/env node

/**
 * c:skills --install-curated — 展示各 source 的 curated 資源清單
 *
 * 用法：
 *   pnpm run c:skills:curated                  列出所有 source curated 資源
 *   pnpm run c:skills:curated --from gstack    列出指定 source 的 curated 資源
 *
 * 注意：此 CLI 只做展示，實際安裝請執行 pnpm run c:ai-sync --select
 */

// --from <source> 解析
const fromIdx = process.argv.indexOf("--from");
const fromSource = fromIdx !== -1 ? process.argv[fromIdx + 1] : null;

/**
 * 已知 sources 的 curated 資源清單（同步自 packages/commons/scripts/sync-sources.mjs）
 * 實際安裝由 c:ai-sync 處理，此處僅展示
 */
function getSources() {
	return {
		ecc: {
			icon: "🌐",
			description: "Commands / Agents / Rules / Skills（社群最大集合）",
			curatedResources: {
				skills: ["silent-failure-hunter", "performance-optimizer"],
				commands: ["/prp", "/implement", "/validate"],
			},
		},
		anthropic: {
			icon: "📚",
			description: "Anthropic 官方 Skills（claude-api、pdf、xlsx 等）",
			curatedResources: {
				skills: ["webapp-testing", "pdf", "xlsx", "docx"],
			},
		},
		superpowers: {
			icon: "🚀",
			description: "Agents / Commands / Hooks（brainstorm、execute-plan）",
			curatedResources: {
				skills: [
					"using-git-worktrees",
					"finishing-a-development-branch",
					"receiving-code-review",
				],
				commands: ["brainstorm", "execute-plan"],
			},
		},
		"context-engineering": {
			icon: "🧠",
			description: "Context 最佳化 / Multi-Agent 模式 / 記憶系統",
			curatedResources: {
				skills: [
					"context-compression",
					"context-degradation",
					"context-escalation",
				],
			},
		},
		gstack: {
			icon: "🎯",
			description: "Garry Tan 23 角色化 slash commands（YC，83.6K stars）",
			curatedResources: {
				skills: ["builder", "reviewer", "researcher", "writer", "debugger"],
				commands: ["specify", "plan", "build", "test", "review", "ship"],
			},
		},
		"skills-mp": {
			icon: "🏪",
			description: "Claude 官方 Skills Marketplace",
			curatedResources: {
				skills: ["advanced-debugging", "code-review", "performance-analysis"],
			},
		},
		openskills: {
			icon: "🌍",
			description: "openskills 社群 skills 集合",
			curatedResources: {
				skills: [
					"problem-solving",
					"research-synthesis",
					"systematic-debugging",
				],
			},
		},
	};
}

/** 輸出單一 source 的 curated 資源 */
function printSource(name, cfg) {
	const icon = cfg.icon ?? "•";
	console.log(`\n${icon} ${name}`);
	console.log(`   ${cfg.description ?? "(無說明)"}`);

	const curated = cfg.curatedResources;
	if (!curated || Object.keys(curated).length === 0) {
		console.log("   （無 curated 資源清單）");
		return;
	}

	for (const [category, items] of Object.entries(curated)) {
		if (!items || items.length === 0) continue;
		console.log(`   ${category}：`);
		for (const item of items) {
			console.log(`     - ${item}`);
		}
	}
}

function main() {
	console.log("── Curated 資源清單 ─────────────────────────────────────────");

	const sources = getSources();
	const sourceNames = Object.keys(sources);

	if (fromSource) {
		if (!sources[fromSource]) {
			console.error(`❌ 找不到 source: ${fromSource}`);
			console.error(`可用 sources：${sourceNames.join(", ")}`);
			process.exit(1);
		}
		printSource(fromSource, sources[fromSource]);
	} else {
		for (const [name, cfg] of Object.entries(sources)) {
			printSource(name, cfg);
		}
	}

	console.log("\n──────────────────────────────────────────────────────────");
	console.log("安裝方式：");
	if (fromSource) {
		console.log(`  pnpm run c:ai-sync --source ${fromSource}`);
	} else {
		console.log("  pnpm run c:ai-sync --select   # 互動式選擇");
		console.log("  pnpm run c:ai-sync --all      # 同步全部");
	}
}

try {
	main();
} catch (e) {
	console.error(`執行失敗：${e.message}`);
	process.exit(1);
}
