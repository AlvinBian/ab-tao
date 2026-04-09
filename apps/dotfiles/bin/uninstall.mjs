#!/usr/bin/env node

/**
 * 移除 ab-tao 安裝的所有配置
 *
 * 只刪除 ab-tao 管理的項目，保留用戶自訂的。
 * 使用 pnpm run restore 可選擇恢復到首次 setup 前的狀態。
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import {
	ALL_AGENTS,
	ALL_COMMANDS,
	ALL_RULES,
} from "../lib/config/config-classifier.mjs";
import { HOME } from "../lib/core/paths.mjs";

const CLAUDE_DIR = path.join(HOME, ".claude");

function removeManaged(dir, names) {
	let removed = 0;
	for (const name of names) {
		const filePath = path.join(dir, `${name}.md`);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			removed++;
		}
	}
	return removed;
}

async function main() {
	p.intro(" ab-tao 卸載 ");

	// 統計將刪除的項目
	const stats = {
		commands: ALL_COMMANDS.filter((c) =>
			fs.existsSync(path.join(CLAUDE_DIR, "commands", `${c}.md`)),
		).length,
		agents: ALL_AGENTS.filter((a) =>
			fs.existsSync(path.join(CLAUDE_DIR, "agents", `${a}.md`)),
		).length,
		rules: ALL_RULES.filter((r) =>
			fs.existsSync(path.join(CLAUDE_DIR, "rules", `${r}.md`)),
		).length,
		hooks: fs.existsSync(path.join(CLAUDE_DIR, "hooks.json")) ? 1 : 0,
		settings: fs.existsSync(path.join(CLAUDE_DIR, "settings.json")) ? 1 : 0,
		keybindings: fs.existsSync(path.join(CLAUDE_DIR, "keybindings.json"))
			? 1
			: 0,
		dispatch: fs.existsSync(path.join(CLAUDE_DIR, "hooks", "slack-dispatch.sh"))
			? 1
			: 0,
	};
	const total =
		stats.commands +
		stats.agents +
		stats.rules +
		stats.hooks +
		stats.settings +
		stats.keybindings +
		stats.dispatch;

	if (total === 0) {
		p.log.info("沒有找到 ab-tao 管理的配置");
		p.outro();
		return;
	}

	p.log.info(`將移除：
	  ${stats.commands} commands · ${stats.agents} agents · ${stats.rules} rules
	  ${stats.hooks ? "hooks.json · " : ""}${stats.settings ? "settings.json · " : ""}${stats.keybindings ? "keybindings.json · " : ""}${stats.dispatch ? "slack-dispatch.sh" : ""}

用戶自訂的 commands/agents/rules 不會被刪除。
完全恢復到 setup 前：pnpm run restore → 選擇「完全還原」`);

	const confirm = await p.confirm({
		message: "確定卸載？",
		initialValue: false,
	});
	if (!confirm || p.isCancel(confirm)) {
		p.outro("已取消");
		return;
	}

	let removed = 0;
	removed += removeManaged(path.join(CLAUDE_DIR, "commands"), ALL_COMMANDS);
	removed += removeManaged(path.join(CLAUDE_DIR, "agents"), ALL_AGENTS);
	removed += removeManaged(path.join(CLAUDE_DIR, "rules"), ALL_RULES);

	for (const file of ["hooks.json", "settings.json", "keybindings.json"]) {
		const fp = path.join(CLAUDE_DIR, file);
		if (fs.existsSync(fp)) {
			fs.unlinkSync(fp);
			removed++;
		}
	}

	const dispatchPath = path.join(CLAUDE_DIR, "hooks", "slack-dispatch.sh");
	if (fs.existsSync(dispatchPath)) {
		fs.unlinkSync(dispatchPath);
		removed++;
	}

	p.log.success(`已移除 ${removed} 個檔案`);
	p.outro("卸載完成");
}

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
