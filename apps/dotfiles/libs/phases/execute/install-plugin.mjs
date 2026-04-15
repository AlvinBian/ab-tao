/**
 * Branch B: Plugin 打包
 *
 * 包含：
 *   - ab-claude-dev.plugin 打包（僅選了 claude 時）
 */

import { spawn } from "node:child_process";

/**
 * 構建 Plugin 打包任務陣列
 *
 * @param {Object} plan - generateInstallPlan 產出
 * @param {Object} opts
 * @param {string} opts.repoDir - @ab-tao/dotfiles 根目錄
 * @returns {Array} Listr2 task 陣列
 */
export function buildPluginTasks(plan, { repoDir }) {
	const feats = new Set(plan.features || []);
	const has = (f) => feats.has(f);

	return [
		{
			title: "🔌 Plugin 打包 → dist/release/",
			enabled: () => has("claude"),
			task: (_, subtask) =>
				subtask.newListr(
					[
						{
							title: "ab-claude-dev.plugin",
							enabled: () =>
								has("claude") && plan.targets.includes("claude-dev"),
							task: async () => {
								await new Promise((resolve, reject) => {
									const child = spawn(
										"bash",
										["scripts/build-claude-dev-plugin.sh"],
										{ cwd: repoDir },
									);
									child.on("close", (code) =>
										code === 0
											? resolve()
											: reject(new Error(`執行失敗（代碼 ${code}）`)),
									);
									child.on("error", reject);
								});
							},
						},
					],
					{ exitOnError: false },
				),
		},
	];
}
