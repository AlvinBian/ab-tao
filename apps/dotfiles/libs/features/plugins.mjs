/**
 * Plugins Feature — 官方 Claude Plugins 安裝
 *
 * 獨立管理官方推薦 Plugins 的偵測、選擇與安裝。
 * 不依賴任何其他 feature，直接呼叫 claude plugin CLI。
 */

import { execFileSync } from "node:child_process";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import { BACK, handleCancel } from "../cli/prompts.mjs";

/** 官方推薦 Plugins */
const RECOMMENDED_PLUGINS = [
	{ name: "code-review", desc: "多 agent 並行 PR 審查" },
	{ name: "commit-commands", desc: "智能 commit 訊息生成" },
	{ name: "feature-dev", desc: "7 階段結構化功能開發" },
	{ name: "code-simplifier", desc: "審查變更代碼的品質與效率" },
	{ name: "security-guidance", desc: "安全漏洞掃描與修復建議" },
	{ name: "hookify", desc: "分析對話模式自動生成 hooks" },
	{ name: "ralph-loop", desc: "持續迭代迴圈 — 自動重試直到完成" },
	{ name: "session-report", desc: "Session 分析報告 — 回顧工作成果" },
];

/** 偵測已安裝的 plugins */
function getInstalledPlugins() {
	try {
		const out = execFileSync("claude", ["plugin", "list", "--json"], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 10000,
		});
		return new Set(JSON.parse(out.toString()).map((pl) => pl.name));
	} catch {
		return null;
	}
}

/** 官方 Plugins marketplace 來源 */
const MARKETPLACE_REPO = "anthropics/claude-plugins-official";

export default {
	id: "plugins",
	label: "🔌 官方 Plugins",
	hint: "code-review · commit-commands · feature-dev…",
	dependsOn: [],
	conflicts: [],

	/**
	 * 1. 環境檢查（驗證 claude CLI 可用）
	 */
	async envCheck() {
		const installed = getInstalledPlugins();
		if (installed === null) {
			return {
				ok: false,
				message: "Claude CLI 不可用（需要 claude plugin 指令）",
			};
		}
		return {
			ok: true,
			message: `Claude CLI ✔（已安裝 ${installed.size} 個 plugin）`,
		};
	},

	/**
	 * 2. 備份（plugins 無需備份）
	 */
	async backup() {
		return { files: [], dir: "" };
	},

	/**
	 * 3. 互動配置（選擇要安裝的 plugins）
	 */
	async configure(ctx) {
		const installed = getInstalledPlugins();
		if (!installed) return null;

		const missing = RECOMMENDED_PLUGINS.filter((pl) => !installed.has(pl.name));
		if (isEmpty(missing)) {
			p.log.info("所有推薦 Plugins 已安裝 ✔");
			return null;
		}

		if (ctx.flags?.quick) {
			// Quick 模式：重裝上次安裝的 plugins
			const prevPlugins = ctx.prev?.install?.plugins;
			if (prevPlugins?.length) return { plugins: prevPlugins };
			return null; // 上次沒裝 plugins
		}

		if (ctx.flags?.all) {
			return { plugins: missing.map((pl) => pl.name) };
		}

		const selected = handleCancel(
			await p.multiselect({
				message: `推薦 Plugins（${missing.length} 個未安裝）`,
				options: missing.map((pl) => ({
					value: pl.name,
					label: pl.name,
					hint: pl.desc,
				})),
				initialValues: missing.map((pl) => pl.name),
				required: false,
			}),
		);

		if (selected === BACK || isEmpty(selected)) return null;
		return { plugins: selected };
	},

	/**
	 * 4. 生成計畫
	 */
	async plan(_ctx, config) {
		if (!config) return null;
		return {
			plugins: config.plugins,
			features: ["plugins"],
			targets: ["plugins"],
		};
	},

	/**
	 * 5. 確認
	 */
	async confirm(ctx, plan) {
		if (!plan) return false;
		if (ctx.flags?.all || ctx.flags?.quick) return true;

		p.log.info(
			`將安裝 ${plan.plugins.length} 個 Plugins：${plan.plugins.join("、")}`,
		);

		return (
			handleCancel(
				await p.confirm({ message: "確認安裝？", initialValue: true }),
			) === true
		);
	},

	/**
	 * 6. 安裝（加入 marketplace → 逐一安裝 plugins）
	 */
	async install(_ctx, plan) {
		if (!plan?.plugins?.length) return null;

		// 確保 marketplace 已加入
		try {
			const out = execFileSync(
				"claude",
				["plugin", "marketplace", "list", "--json"],
				{ stdio: ["pipe", "pipe", "pipe"], timeout: 10000 },
			).toString();
			const list = JSON.parse(out);
			if (!list.some((m) => m.repo === MARKETPLACE_REPO)) {
				execFileSync(
					"claude",
					["plugin", "marketplace", "add", MARKETPLACE_REPO],
					{ stdio: ["pipe", "pipe", "pipe"], timeout: 120000 },
				);
			}
		} catch {
			p.log.warn("marketplace 加入失敗，嘗試直接安裝");
		}

		const installed = [];
		const failed = [];
		for (const name of plan.plugins) {
			try {
				p.log.info(`安裝 ${name}...`);
				execFileSync(
					"claude",
					["plugin", "install", `${name}@claude-plugins-official`],
					{ stdio: ["pipe", "pipe", "pipe"], timeout: 60000 },
				);
				installed.push(name);
			} catch {
				failed.push(name);
			}
		}

		return { plugins: installed, pluginsFailed: failed };
	},

	/**
	 * 7. 驗證（檢查推薦 plugins 安裝狀態）
	 */
	async verify() {
		const installed = getInstalledPlugins();
		if (!installed) return { passed: 0, total: 0, missing: [] };

		const missing = RECOMMENDED_PLUGINS.filter(
			(pl) => !installed.has(pl.name),
		).map((pl) => pl.name);

		return {
			passed: RECOMMENDED_PLUGINS.length - missing.length,
			total: RECOMMENDED_PLUGINS.length,
			missing,
		};
	},

	/**
	 * 8. 完成輸出
	 */
	complete(results) {
		if (!results) return [];
		const lines = ["── 官方 Plugins ──"];
		if (results.plugins?.length)
			lines.push(`  ✔ 已安裝：${results.plugins.join("、")}`);
		if (results.pluginsFailed?.length)
			lines.push(`  ✘ 失敗：${results.pluginsFailed.join("、")}`);
		return lines;
	},

	/**
	 * 9. 回滾（plugins 透過 CLI 管理，無需回滾檔案）
	 */
	async rollback() {},

	/**
	 * 10. Session 數據
	 */
	session(results) {
		return {
			plugins: results?.plugins || [],
			pluginsFailed: results?.pluginsFailed || [],
		};
	},

	/**
	 * 11. 清理
	 */
	async cleanup() {},

	/**
	 * 12. 報告數據
	 */
	report(results) {
		return { feature: "plugins", ...results };
	},
};
