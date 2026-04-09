/**
 * install-modules 步驟：安裝 ZSH 模組 + brew 工具
 *
 * 職責：
 *   1. 讓用戶選擇要安裝的 ZSH 模組（smartSelect）
 *   2. 生成 dist/preview/zsh/ 預覽檔案
 *   3. 非 manual 模式時執行 zsh/install.sh，將模組部署到 ~/.zshrc.d/
 *
 * 進度解析：
 *   解析 install.sh 的 stdout，識別 brew 工具安裝、模組複製、sheldon 等階段。
 */

import { isEmpty } from "lodash-es";
import pc from "picocolors";
import { discoverItems } from "../cli/files.mjs";
import { CLACK_LOGGER } from "../cli/logger.mjs";
import { stageModulesPreview } from "../cli/preview.mjs";
import { runWithProgress } from "../cli/progress.mjs";
import { BACK, smartSelect } from "../cli/prompts.mjs";

/**
 * 執行 install-modules 步驟
 *
 * @param {string} repoDir - @ab-tao/dotfiles 根目錄
 * @param {string} previewDir - dist/preview 路徑
 * @param {Object} step - config.json 中的 step 定義
 * @param {string} stepLabel - 步驟前綴標籤（如 '[3/3] '）
 * @param {boolean} flagAll - 是否全自動安裝（跳過互動）
 * @param {boolean} [manual=false] - 是否為手動模式（只生成 preview，不部署）
 * @param {Object|null} [session=null] - 上次 session（用於預選模組）
 * @param {Object} [logger] - Logger 介面（CLACK_LOGGER 或 listrLogger）
 * @returns {Promise<{ modules: string[] } | undefined>} 已安裝的模組名稱列表
 */
export async function handleInstallModules(
	repoDir,
	previewDir,
	step,
	stepLabel,
	flagAll,
	manual = false,
	session = null,
	logger = CLACK_LOGGER,
) {
	const def = Object.values(step.selectable)[0];
	const key = Object.keys(step.selectable)[0];
	let items = discoverItems(repoDir, def.dir, def.ext);

	// 排除恆常部署的模組（00-env、90-plugins）
	const exclude = new Set(def.exclude || []);
	if (exclude.size > 0) {
		items = items.filter((i) => !exclude.has(i.value));
	}

	if (isEmpty(items)) return { modules: [] };

	const selectedModules = flagAll
		? items.map((i) => i.value)
		: await smartSelect({
				title: `${stepLabel}${def.selectLabel || key}`,
				items,
				preselected: items.map((i) => i.value),
				session: session?.install?.modules,
			});
	if (selectedModules === BACK) return undefined;
	if (isEmpty(selectedModules)) return;

	// total 由 install.sh 動態輸出 TOTAL:XX（fallback 30）
	const total = 30;

	// 生成 preview
	stageModulesPreview(repoDir, previewDir, step, selectedModules);

	const moduleItems = [
		"00-env.zsh",
		...selectedModules.map((m) => `${m}.zsh`),
		"90-plugins.zsh",
		"sheldon/plugins.toml",
	];
	const fileLines = moduleItems
		.map(
			(item, i) =>
				`  ${pc.green("✔")} ${pc.dim(`[${i + 1}/${moduleItems.length}]`)} ${item}`,
		)
		.join("\n");
	logger?.info(
		`${stepLabel}生成 ${selectedModules.length + 2}/${items.length + 2} 個 ${key} → dist/preview/zsh/\n${fileLines}`,
	);

	if (manual) {
		logger?.success(`${stepLabel}✔ 已生成 → dist/preview/zsh/`);
		return;
	}

	// 提取不帶前綴的模組名（install.sh 用原始名稱）
	const moduleNames = selectedModules.map((m) => m.replace(/^\d+-/, ""));

	// 執行安裝
	logger?.info(
		`${stepLabel}安裝 ${selectedModules.length} 個 ${key} → ~/.zshrc.d/`,
	);
	await runWithProgress(`${step.script} --modules ${moduleNames.join(",")}`, {
		cwd: repoDir,
		total,
		logger,
		parseProgress(line) {
			// 匹配所有 ✔/▶/⚠ 開頭的進度行
			if (/^\s+[✔▶⚠]/.test(line)) {
				const match = line.match(/[✔▶⚠]\s+(.+)/);
				const label = match?.[1]?.trim() || "...";
				return label.length > 40 ? `${label.slice(0, 37)}...` : label;
			}
			return null;
		},
	});
	logger?.success(
		`${stepLabel}✔ ${selectedModules.length} 個 ${key} 已安裝：${moduleNames.join("、")}`,
	);
	return { modules: moduleNames };
}
