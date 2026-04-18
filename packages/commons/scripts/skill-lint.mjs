#!/usr/bin/env node
/**
 * skill-lint.mjs — Phase 14 Skills 品質審查
 *
 * 規則：
 *   E1  name 必填
 *   E2  description 必填，50-200 字元
 *   E3  version 必填（semver）
 *   E4  category 必填（workflow | tech | meta | ops）
 *   W1  建議有 ## Example 區塊
 *   W2  內容超過 500 行（考慮精簡）
 *   W3  description 超過 200 字元（考慮縮短）
 *
 * 用法：
 *   node skill-lint.mjs [--fix] [--skill <name>]
 *   node skill-lint.mjs --score        # 輸出品質矩陣
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(
	__dirname,
	"../../../apps/dotfiles/claude/skills",
);

const VALID_CATEGORIES = ["workflow", "tech", "meta", "ops"];

/** 解析 SKILL.md frontmatter（支援前置 HTML 注解 + YAML folded `>` / `|`） */
function parseFrontmatter(content) {
	// 移除前置 HTML 注解
	const stripped = content.replace(/^(<!--[\s\S]*?-->\s*\n)+/, "");
	const match = stripped.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return { fields: {}, body: stripped };

	const raw = match[1];
	const fields = {};
	const lines = raw.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(/^(\w[\w-]*):\s*(.*)$/);
		if (!m) continue;
		const key = m[1];
		let val = m[2].replace(/^["']|["']$/g, "").trim();
		// 處理 YAML folded `>` 或 literal `|`
		if (val === ">" || val === "|") {
			const parts = [];
			while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
				parts.push(lines[++i].trim());
			}
			val = parts.join(" ");
		}
		fields[key] = val;
	}
	const body = content.slice(match[0].length);
	return { fields, body };
}

/** 對單一 skill 執行 lint */
function lintSkill(name, skillPath) {
	const content = fs.readFileSync(skillPath, "utf8");
	const { fields, body } = parseFrontmatter(content);
	const errors = [];
	const warnings = [];

	// E1 name
	if (!fields.name) errors.push("E1: 缺少 name");

	// E2 description
	if (!fields.description) {
		errors.push("E2: 缺少 description");
	} else {
		const len = fields.description.length;
		if (len < 50) errors.push(`E2: description 太短（${len} 字元，需 ≥50）`);
		else if (len > 200)
			warnings.push(`W3: description 偏長（${len} 字元，建議 ≤200）`);
	}

	// E3 version
	if (!fields.version) errors.push("E3: 缺少 version（請加 version: 1.0.0）");

	// E4 category
	if (!fields.category) {
		errors.push(`E4: 缺少 category（可選：${VALID_CATEGORIES.join(" | ")}）`);
	} else if (!VALID_CATEGORIES.includes(fields.category)) {
		errors.push(
			`E4: category 無效（"${fields.category}"，可選：${VALID_CATEGORIES.join(" | ")}）`,
		);
	}

	// W1 Example
	if (!body.includes("## Example") && !body.includes("## 範例")) {
		warnings.push("W1: 建議加入 ## Example 區塊");
	}

	// W2 length
	const lines = content.split("\n").length;
	if (lines > 500) warnings.push(`W2: 內容偏長（${lines} 行，建議 ≤500）`);

	return { name, errors, warnings, lines, fields };
}

/** 計算品質分數（1-5） */
function score(result) {
	let s = 5;
	s -= result.errors.length; // 每個 error -1
	s -= Math.floor(result.warnings.length / 2); // 每 2 個 warning -1
	return Math.max(1, s);
}

function main() {
	const args = process.argv.slice(2);
	const doScore = args.includes("--score");
	const targetSkill = args.includes("--skill")
		? args[args.indexOf("--skill") + 1]
		: null;

	const skillDirs = fs
		.readdirSync(SKILLS_DIR)
		.filter((d) => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
		.filter((d) => !targetSkill || d === targetSkill)
		.sort();

	const results = [];
	for (const name of skillDirs) {
		const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
		if (!fs.existsSync(skillPath)) {
			results.push({
				name,
				errors: ["SKILL.md 不存在"],
				warnings: [],
				lines: 0,
				fields: {},
			});
			continue;
		}
		results.push(lintSkill(name, skillPath));
	}

	if (doScore) {
		// 品質矩陣輸出
		console.log("\n📊 Skills 品質矩陣\n");
		console.log(
			`${"Skill".padEnd(32)} ${"Score".padEnd(6)} ${"Lines".padEnd(6)} ${"Errors".padEnd(8)} Warnings`,
		);
		console.log("─".repeat(80));
		let totalScore = 0;
		for (const r of results) {
			const s = score(r);
			totalScore += s;
			const icon = s >= 4 ? "✅" : s === 3 ? "⚠️ " : "❌";
			console.log(
				`${icon} ${r.name.padEnd(30)} ${String(s).padEnd(6)} ${String(r.lines).padEnd(6)} ${String(r.errors.length).padEnd(8)} ${r.warnings.length}`,
			);
		}
		const avg = (totalScore / results.length).toFixed(1);
		console.log("─".repeat(80));
		console.log(`平均分：${avg} / 5.0  （共 ${results.length} 個 skills）\n`);
		return;
	}

	// 詳細 lint 輸出
	let hasIssues = false;
	for (const r of results) {
		if (r.errors.length === 0 && r.warnings.length === 0) continue;
		hasIssues = true;
		console.log(`\n📦 ${r.name}`);
		for (const e of r.errors) console.log(`  ❌ ${e}`);
		for (const w of r.warnings) console.log(`  ⚠️  ${w}`);
	}

	const errorCount = results.reduce((n, r) => n + r.errors.length, 0);
	const warnCount = results.reduce((n, r) => n + r.warnings.length, 0);
	const passed = results.filter((r) => r.errors.length === 0).length;

	console.log(
		`\n${hasIssues ? "" : "✅ "}結果：${passed}/${results.length} skills 通過（errors: ${errorCount}，warnings: ${warnCount}）`,
	);
	if (errorCount > 0) process.exit(1);
}

main();
