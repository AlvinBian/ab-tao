#!/usr/bin/env node

/**
 * 將 ~/.claude/plans/*.md 遷移至 per-project 目錄
 *
 * 目標：~/.claude/projects/{encoded}/plans/{slug}.md
 * 執行後 ~/.claude/plans/ 只剩 README.md 說明新慣例
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const HOME = os.homedir();
const PLANS_DIR = path.join(HOME, ".claude", "plans");
const PROJECTS_DIR = path.join(HOME, ".claude", "projects");
const RELOCATED_MARKER = path.join(HOME, ".claude", ".plans-relocated");

/** 從 encoded 目錄名解碼為可讀路徑（最後兩段） */
export function decodedLabel(encoded) {
	const parts = encoded.replace(/^-/, "").split("-");
	if (parts.length <= 2) return encoded.replace(/^-/, "").replace(/-/g, "/");
	return `.../${parts.slice(-3).join("/")}`;
}

/** 讀取已遷移記錄 */
export function readRelocated() {
	if (!fs.existsSync(RELOCATED_MARKER)) return new Set();
	try {
		return new Set(
			fs.readFileSync(RELOCATED_MARKER, "utf8").split("\n").filter(Boolean),
		);
	} catch {
		return new Set();
	}
}

/** 追加已遷移記錄 */
export function markRelocated(slug) {
	fs.appendFileSync(RELOCATED_MARKER, `${slug}\n`, "utf8");
}

/** 掃描 ~/.claude/projects/ 取得已知專案列表 */
function getKnownProjects() {
	if (!fs.existsSync(PROJECTS_DIR)) return [];
	return fs
		.readdirSync(PROJECTS_DIR, { withFileTypes: true })
		.filter((e) => e.isDirectory() && e.name.startsWith("-"))
		.map((e) => ({
			encoded: e.name,
			label: decodedLabel(e.name),
			plansDir: path.join(PROJECTS_DIR, e.name, "plans"),
		}));
}

/** 讀取 plan 檔的前 5 行作預覽 */
function planPreview(filePath) {
	try {
		return fs.readFileSync(filePath, "utf8").split("\n").slice(0, 5).join("\n");
	} catch {
		return "(無法讀取)";
	}
}

/** 更新目標 plans/index.md — 在最後加入一行連結
 *  @param {string} relSlug  相對於 plansDir 的路徑，slug 已含 .md（如 "foo.md" 或 "archive/foo.md"）
 */
export function updateIndex(plansDir, relSlug, title) {
	const indexPath = path.join(plansDir, "index.md");
	const entry = `- [${title || relSlug}](./${relSlug})`;
	if (!fs.existsSync(indexPath)) {
		fs.writeFileSync(indexPath, `# Plans\n\n${entry}\n`, "utf8");
		return;
	}
	const content = fs.readFileSync(indexPath, "utf8");
	if (content.includes(`./${relSlug}`)) return;
	fs.writeFileSync(indexPath, `${content.trimEnd()}\n${entry}\n`, "utf8");
}

async function main() {
	p.intro(" migrate-plans：將全域 plan 遷移至 per-project ");

	if (!fs.existsSync(PLANS_DIR)) {
		p.log.info("~/.claude/plans/ 不存在，無需遷移");
		p.outro();
		return;
	}

	const isDryRun = process.argv.includes("--dry-run");
	if (isDryRun) p.log.warn("Dry-run 模式：只顯示，不移動檔案");

	// 取得待遷移的 plan 檔（排除 README.md 與已遷移）
	const relocated = readRelocated();
	const files = fs
		.readdirSync(PLANS_DIR)
		.filter((f) => f.endsWith(".md") && f !== "README.md" && !relocated.has(f))
		.map((f) => ({ name: f, fullPath: path.join(PLANS_DIR, f) }));

	if (files.length === 0) {
		p.log.success("所有 plan 已遷移（或 ~/.claude/plans/ 已清空）");
		p.outro();
		return;
	}

	const projects = getKnownProjects();
	if (projects.length === 0) {
		p.log.error(
			"未找到任何 ~/.claude/projects/ 子目錄，請先執行一次 Claude Code",
		);
		p.outro();
		process.exit(1);
	}

	p.log.info(
		`找到 ${files.length} 個待遷移 plan，${projects.length} 個已知專案`,
	);

	const projectOptions = [
		...projects.map((proj) => ({
			value: proj.encoded,
			label: proj.label,
			hint: proj.encoded,
		})),
		{ value: "__archive__", label: "archive（封存，不歸屬任何專案）" },
		{ value: "__skip__", label: "skip（跳過此檔）" },
	];

	let migratedCount = 0;
	let skippedCount = 0;

	for (const file of files) {
		const preview = planPreview(file.fullPath);
		p.log.message(`\n📄 ${file.name}\n${preview}\n`);

		const dest = await p.select({
			message: `${file.name} → 歸屬哪個專案？`,
			options: projectOptions,
		});

		if (p.isCancel(dest)) {
			p.outro("已取消，已完成部分不回滾");
			return;
		}

		if (dest === "__skip__") {
			skippedCount++;
			continue;
		}

		const slug = file.name;
		let targetDir;

		if (dest === "__archive__") {
			const proj = projects[0];
			targetDir = path.join(PROJECTS_DIR, proj.encoded, "plans", "archive");
		} else {
			targetDir = path.join(PROJECTS_DIR, dest, "plans");
		}

		const targetPath = path.join(targetDir, slug);

		if (!isDryRun) {
			fs.mkdirSync(targetDir, { recursive: true });
			fs.copyFileSync(file.fullPath, targetPath);
			// 取 plan 第一行 h1 標題作索引標籤
			const title =
				planPreview(file.fullPath)
					.split("\n")[0]
					.replace(/^#+\s*/, "")
					.trim() || slug.replace(".md", "");
			const projectPlansDir = path.join(
				PROJECTS_DIR,
				dest === "__archive__" ? projects[0].encoded : dest,
				"plans",
			);
			const indexSlug = dest === "__archive__" ? `archive/${slug}` : slug;
			updateIndex(projectPlansDir, indexSlug, title);
			fs.unlinkSync(file.fullPath);
			markRelocated(slug);
		}

		p.log.success(`${slug} → ${targetDir.replace(HOME, "~")}`);
		migratedCount++;
	}

	if (!isDryRun && migratedCount > 0) {
		// 留下 README.md 說明新慣例
		const readme = `# ~/.claude/plans/

> **此目錄已遷移至 per-project 架構。**
>
> Plans 現在存放於：
> \`~/.claude/projects/{encoded-project-path}/plans/\`
>
> Claude Code plan-mode 新產生的 \`.md\` 會由 \`relocate-plan.sh\`（SessionEnd hook）自動歸位。
>
> 手動遷移：\`pnpm run d:migrate-plans\`
`;
		fs.writeFileSync(path.join(PLANS_DIR, "README.md"), readme, "utf8");
	}

	p.log.info(`遷移 ${migratedCount} 個，跳過 ${skippedCount} 個`);
	p.outro("完成");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((e) => {
		console.error(e.message);
		process.exit(1);
	});
}
