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
import { getDirname, P } from "../libs/core/paths.mjs";
import { verifyPluginCachePaths } from "../libs/install/plugin-manager.mjs";
import { stateWrite, verifyManaged } from "../libs/state/state.mjs";

const __dirname = getDirname(import.meta);
const REPO_ROOT = path.resolve(__dirname, "../../..");

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

async function runPluginsSection() {
	let result;
	try {
		result = verifyPluginCachePaths();
	} catch (e) {
		p.log.warn(`Plugin 檢查失敗：${e.message}`);
		return;
	}

	const { broken, ok } = result;

	if (broken.length > 0) {
		p.log.error(
			`Plugin cache 路徑損壞（version=unknown 或目錄不存在）：\n  ${broken.join("\n  ")}`,
		);
		p.log.info(
			`修復指令：\n${broken.map((k) => `  claude plugin install ${k.replace(/@[^@]+$/, "")} --marketplace ${k.replace(/^[^@]+@/, "")}`).join("\n")}\n  或執行：pnpm run d:setup`,
		);
	}

	if (broken.length === 0) {
		p.log.success(`Plugins：${ok.length} 個健康`);
	}
}

async function runAiSourcesSection() {
	const VERSIONS_PATH = path.join(REPO_ROOT, "packages/commons/.versions.json");
	const SOURCES_DIR = path.join(
		REPO_ROOT,
		"packages/commons/resources/ai/sources",
	);

	if (!fs.existsSync(SOURCES_DIR)) {
		p.log.info("AI Sources：目錄不存在（尚未執行 pnpm run c:ai-sync）");
		return;
	}

	let versions = {};
	if (fs.existsSync(VERSIONS_PATH)) {
		try {
			versions = JSON.parse(fs.readFileSync(VERSIONS_PATH, "utf8"));
		} catch {
			p.log.warn(
				"AI Sources：.versions.json 解析失敗（可能損壞），建議執行 c:ai-sync --all 重建",
			);
			return;
		}
	}

	const sourceDirs = fs
		.readdirSync(SOURCES_DIR, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	const warnings = [];
	for (const name of sourceDirs) {
		const vEntry = versions[name];
		const srcPath = path.join(SOURCES_DIR, name);
		const fileCount = fs.readdirSync(srcPath).length;

		if (!vEntry?.sha) {
			warnings.push(`${name}：未同步（pnpm run c:ai-sync --source ${name}）`);
			continue;
		}
		if (fileCount === 0) {
			warnings.push(`${name}：目錄空白（pnpm run c:ai-sync --source ${name}）`);
			continue;
		}
		if (vEntry.date) {
			const daysSince =
				(Date.now() - new Date(vEntry.date).getTime()) / (1000 * 86400);
			if (daysSince > 90) {
				warnings.push(
					`${name}：${Math.floor(daysSince)} 天未更新（建議 pnpm run c:ai-sync --source ${name}）`,
				);
			}
		}
	}

	if (warnings.length > 0) {
		p.log.warn(`AI Sources 問題：\n  ${warnings.join("\n  ")}`);
	} else {
		p.log.success(`AI Sources：${sourceDirs.length} 個來源健康`);
	}
}

async function main() {
	p.intro(" d:doctor — State 健康診斷 ");

	p.log.info("── State ──────────────────────────────────────────");
	await runStateSection();

	p.log.info("── Plugins ────────────────────────────────────────");
	await runPluginsSection();

	p.log.info("── AI Sources ─────────────────────────────────────");
	await runAiSourcesSection();

	if (!FIX) {
		p.log.info("提示：加 --fix 自動修復 ghost 與 dead sync.included");
	}

	p.outro("完成");
}

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
