#!/usr/bin/env node

/**
 * d:doctor — State 健康診斷
 *
 * 三段輸出：State / Memory / Plugins
 * --fix：自動修復 ghost entries 與 dead sync.included
 */

import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { P } from "../libs/core/paths.mjs";
import { stateWrite, verifyManaged } from "../libs/state/state.mjs";

const FIX = process.argv.includes("--fix");
const CLAUDE_BASE = path.resolve(P.state, "../..");

async function runStateSection() {
	const { ghost, driftSha, deadIncluded, orphans } = verifyManaged();

	if (ghost.length > 0) {
		p.log.warn(
			`Ghost entries（managed 但檔案不存在）：\n  ${ghost.join("\n  ")}`,
		);
	}
	if (driftSha.length > 0) {
		p.log.warn(`SHA drift（需手動確認）：\n  ${driftSha.join("\n  ")}`);
	}
	if (deadIncluded.length > 0) {
		p.log.warn(
			`Dead sync.included（路徑不存在）：\n  ${deadIncluded.join("\n  ")}`,
		);
	}
	if (orphans.length > 0) {
		p.log.info(
			`Orphans（sync.included 下未追蹤）：\n  ${orphans.join("\n  ")}`,
		);
	}
	if (
		ghost.length === 0 &&
		driftSha.length === 0 &&
		deadIncluded.length === 0
	) {
		p.log.success("State：無問題");
	}

	if (!FIX || (ghost.length === 0 && deadIncluded.length === 0)) return;

	// 備份
	const ts = Date.now();
	const backupPath = `${P.state}.backup-${ts}`;
	fs.copyFileSync(P.state, backupPath);
	p.log.info(`備份 state.json → ${backupPath}`);

	// 分離 kept-by-user ghost（需確認才刪）
	const keptByUser = ghost
		.filter((g) => g.includes("[kept-by-user]"))
		.map((g) => g.replace(" [kept-by-user]", "").trim());
	const autoGhosts = ghost
		.filter((g) => !g.includes("[kept-by-user]"))
		.map((g) => g.trim());

	for (const relPath of keptByUser) {
		const confirm = await p.confirm({
			message: `Ghost [kept-by-user]: ${relPath}，是否移除？`,
			initialValue: false,
		});
		if (!p.isCancel(confirm) && confirm) autoGhosts.push(relPath);
	}

	stateWrite((s) => {
		for (const relPath of autoGhosts) delete s.managed[relPath];
		if (s.sync?.included) {
			s.sync.included = s.sync.included.filter(
				(i) => !deadIncluded.includes(i),
			);
		}
	});

	p.log.success(
		`已修復：${autoGhosts.length} ghost · ${deadIncluded.length} deadIncluded`,
	);
}

function runPluginSection() {
	let hasIssue = false;

	// pua loop state files 殘留偵測（>1h 提示清理）
	const puaLoopDir = path.join(CLAUDE_BASE, "pua");
	if (fs.existsSync(puaLoopDir)) {
		const now = Date.now();
		const loopIssues = [];
		for (const f of fs.readdirSync(puaLoopDir)) {
			if (!f.startsWith("loop-") || !f.endsWith(".md")) continue;
			const fp = path.join(puaLoopDir, f);
			const stat = fs.statSync(fp);
			const ageH = (now - stat.mtimeMs) / 3_600_000;
			if (ageH > 1) loopIssues.push(`${f}（${Math.floor(ageH)}h 前）`);
		}
		if (loopIssues.length > 0) {
			p.log.warn(
				`pua 殘留 loop state（建議清理）：\n  ${loopIssues.join("\n  ")}\n  清理：find ~/.claude/pua -name "loop-*.md" -mmin +60 -delete`,
			);
			hasIssue = true;
		}
	}

	// pua config.json kill switch 檢查
	const puaConfigPath = path.join(
		process.env.HOME ?? path.resolve(CLAUDE_BASE, ".."),
		".pua",
		"config.json",
	);
	const puaPluginDir = path.join(CLAUDE_BASE, "plugins", "pua");
	const puaInstalled = fs.existsSync(puaPluginDir);

	if (puaInstalled) {
		if (!fs.existsSync(puaConfigPath)) {
			p.log.warn(
				"pua 已安裝但缺少 ~/.pua/config.json\n  修復：mkdir -p ~/.pua && echo '{\"always_on\": false}' > ~/.pua/config.json",
			);
			hasIssue = true;
		} else {
			let cfg;
			try {
				cfg = JSON.parse(fs.readFileSync(puaConfigPath, "utf8"));
			} catch {
				p.log.warn("~/.pua/config.json 格式錯誤");
				hasIssue = true;
				cfg = null;
			}
			if (cfg !== null && cfg.always_on !== false) {
				p.log.warn(
					"~/.pua/config.json always_on 不為 false → frustration-trigger 會自動觸發",
				);
				hasIssue = true;
			} else if (cfg !== null) {
				p.log.success("pua：config.json 正常（always_on: false）");
			}
		}
	}

	if (!hasIssue && !puaInstalled) {
		p.log.success("Plugins：無問題");
	}
}

async function main() {
	p.intro(" d:doctor — State 健康診斷 ");

	p.log.info("── State ──────────────────────────────────────────");
	await runStateSection();

	p.log.info("── Plugins ────────────────────────────────────────");
	runPluginSection();

	if (!FIX) {
		p.log.info("提示：加 --fix 自動修復 ghost 與 dead sync.included");
	}

	p.outro("完成");
}

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
