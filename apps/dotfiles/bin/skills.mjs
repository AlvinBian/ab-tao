#!/usr/bin/env node
/**
 * d:skills — Skills 維護指令
 * 列出、搜尋、更新 ~/.claude/skills/ 中的 skills
 */

import { execFileSync } from "node:child_process";
import * as p from "@clack/prompts";

async function main() {
	p.intro(" d:skills ");

	const action = await p.select({
		message: "選擇操作",
		options: [
			{ value: "list", label: "列出已安裝的 skills" },
			{ value: "update", label: "更新所有 skills" },
			{ value: "find", label: "搜尋 skills.sh" },
		],
	});

	if (!action || action === Symbol.for("cancel")) {
		p.outro("已取消");
		return;
	}

	if (action === "list") {
		const s = p.spinner();
		s.start("列出 skills...");
		try {
			const out = execFileSync("npx", ["skills", "list", "-g", "--json"], {
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			const skills = JSON.parse(out);
			if (!Array.isArray(skills)) throw new TypeError("輸出格式非陣列");
			s.stop(`找到 ${skills.length} 個 skills`);
			for (const sk of skills) {
				p.log.info(`  ${sk.name} — ${sk.description || ""}`);
			}
		} catch (err) {
			if (err instanceof SyntaxError || err instanceof TypeError) {
				s.stop("列出失敗（輸出格式非 JSON，請確認 skills CLI 版本）");
			} else {
				s.stop("列出失敗（npx skills 可能未安裝）");
			}
		}
	} else if (action === "update") {
		const s = p.spinner();
		s.start("更新所有 skills...");
		try {
			execFileSync("npx", ["skills", "update", "-g", "-y"], {
				stdio: "inherit",
			});
			s.stop("更新完成");
		} catch {
			s.stop("更新失敗");
		}
	} else if (action === "find") {
		const query = await p.text({ message: "搜尋關鍵字" });
		if (!query || typeof query !== "string") {
			p.outro("已取消");
			return;
		}
		const s = p.spinner();
		s.start(`搜尋 "${query}"...`);
		try {
			const out = execFileSync("npx", ["skills", "find", query], {
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			s.stop("搜尋完成");
			p.log.info(out);
		} catch (err) {
			s.stop("搜尋失敗");
			p.log.error(err.message);
		}
	}

	p.outro("完成");
}

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
