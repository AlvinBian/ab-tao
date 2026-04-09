/**
 * AI 來源互動選擇
 *
 * 在 setup 精靈中讓使用者選擇要同步哪些 AI 來源，
 * 已同步的直接使用，未同步的即時同步。
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { RESOURCES_DIR } from "@ab-tao/commons/paths";
import { SOURCES_CONFIG } from "@ab-tao/commons/sync";
import { readVersions } from "@ab-tao/commons/versions";
import * as p from "@clack/prompts";
import { isEmpty } from "lodash-es";
import pc from "picocolors";
import { BACK, handleCancel } from "../cli/prompts.mjs";

/**
 * 互動式選擇 AI 來源
 *
 * 顯示所有可用來源，標記已同步/未同步狀態，
 * 使用者選擇後自動同步未同步的來源。
 *
 * @returns {string[]} 選中的來源名稱陣列（空陣列 = 跳過）
 */
export async function selectAiSources() {
	const versions = readVersions();
	const sourceNames = Object.keys(SOURCES_CONFIG);

	const options = sourceNames.map((name) => {
		const config = SOURCES_CONFIG[name];
		const ver = versions[name];
		const synced = ver?.sha;
		const tag = synced ? pc.green("✔") : pc.dim("✗");
		return {
			value: name,
			label: `${config.icon} ${name} ${tag}`,
			hint: config.description,
		};
	});

	const selected = handleCancel(
		await p.multiselect({
			message: "AI 來源（Space 切換，Enter 確認，直接 Enter 跳過）",
			options,
			initialValues: [],
			required: false,
		}),
	);

	if (selected === BACK) return BACK;
	if (!selected || isEmpty(selected)) {
		p.log.info("⏭️ 已跳過 AI 來源");
		return [];
	}

	// 找出需要同步的（未同步的）
	const needSync = selected.filter((name) => {
		const sourceDir = fs.existsSync(RESOURCES_DIR)
			? fs.existsSync(`${RESOURCES_DIR}/${name}`)
			: false;
		return !sourceDir;
	});

	if (!isEmpty(needSync)) {
		const spinner = p.spinner();
		spinner.start(`正在同步 ${needSync.length} 個 AI 來源...`);
		try {
			const pickArg = needSync.join(",");
			execFileSync(
				"pnpm",
				["--filter", "@ab-tao/commons", "run", "sync", "--", "--pick", pickArg],
				{
					stdio: "pipe",
					timeout: 120000,
				},
			);
			spinner.stop(`已同步 ${needSync.length} 個 AI 來源`);
		} catch (err) {
			spinner.stop(
				pc.yellow(
					`同步部分失敗（${err.message?.slice(0, 50)}），繼續使用已有資源`,
				),
			);
		}
	}

	const lines = selected.map((name, i) => {
		const config = SOURCES_CONFIG[name];
		return `  ${i + 1}. ${config.icon} ${pc.cyan(name)} — ${config.description}`;
	});
	p.log.success(`已選擇 ${selected.length} 個 AI 來源：\n${lines.join("\n")}`);

	return selected;
}
