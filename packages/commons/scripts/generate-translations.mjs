#!/usr/bin/env node

/**
 * 翻譯自動生成器
 *
 * 掃描 resources/ai/sources/ 下所有 AI 來源，
 * 提取 commands/agents/rules/skills 的名稱與描述，
 * 比對 translations.json，將未翻譯項批次呼叫 GitHub Models API 翻譯。
 *
 * 用法：
 *   node scripts/generate-translations.mjs          # 只翻譯新增/變更
 *   node scripts/generate-translations.mjs --force   # 全部重新翻譯
 *   node scripts/generate-translations.mjs --dry-run # 只顯示差異，不呼叫 API
 *
 * 環境變數：
 *   GITHUB_TOKEN — GitHub token（需有 models 權限，使用 GH_PAT）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.resolve(
	__dirname,
	"..",
	"resources",
	"ai",
	"sources",
);
const TRANSLATIONS_PATH = path.resolve(
	__dirname,
	"..",
	"resources",
	"translations.json",
);

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 80; // 每批翻譯數量（避免 prompt 過長）

// ── 掃描所有來源 ──────────────────────────────────────────────

/** 從 .md 檔案的 frontmatter 提取 description */
function extractFrontmatterDesc(content) {
	if (!content) return "";
	const match = content.match(
		/^---\n[\s\S]*?description:\s*["']?(.+?)["']?\s*$/m,
	);
	if (match) return match[1].trim().slice(0, 120);
	// fallback：首行非空非標題
	for (const line of content.split("\n")) {
		const t = line.trim();
		if (!t || t.startsWith("#") || t.startsWith("---")) continue;
		return t.slice(0, 120);
	}
	return "";
}

/** 掃描 .md 檔案目錄 */
function scanMdDir(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.map((f) => {
			const content = fs.readFileSync(path.join(dir, f), "utf8");
			return {
				name: f.replace(".md", ""),
				desc: extractFrontmatterDesc(content),
			};
		});
}

/** 掃描 skills 目錄（{skill}/SKILL.md） */
function scanSkillsDir(dir) {
	if (!fs.existsSync(dir)) return [];
	const skills = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const skillMd = path.join(dir, entry.name, "SKILL.md");
		if (fs.existsSync(skillMd)) {
			const content = fs.readFileSync(skillMd, "utf8");
			skills.push({
				name: entry.name,
				desc: extractFrontmatterDesc(content),
			});
		}
	}
	return skills;
}

/** 掃描所有來源，回傳 { commands, agents, rules, skills } */
function scanAllSources() {
	const result = { commands: [], agents: [], rules: [], skills: [] };
	if (!fs.existsSync(RESOURCES_DIR)) return result;

	const seen = {
		commands: new Set(),
		agents: new Set(),
		rules: new Set(),
		skills: new Set(),
	};

	for (const entry of fs.readdirSync(RESOURCES_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const sourceDir = path.join(RESOURCES_DIR, entry.name);

		for (const type of ["commands", "agents", "rules"]) {
			for (const item of scanMdDir(path.join(sourceDir, type))) {
				if (!seen[type].has(item.name)) {
					seen[type].add(item.name);
					result[type].push(item);
				}
			}
		}

		for (const item of scanSkillsDir(path.join(sourceDir, "skills"))) {
			if (!seen.skills.has(item.name)) {
				seen.skills.add(item.name);
				result.skills.push(item);
			}
		}
	}

	return result;
}

// ── 差異偵測 ──────────────────────────────────────────────────
/** 比對現有翻譯，找出未翻譯或描述變更的項目 */
function findUntranslated(scanned, existing) {
	const untranslated = { commands: [], agents: [], rules: [], skills: [] };
	let skipCount = 0;

	for (const type of ["commands", "agents", "rules", "skills"]) {
		for (const item of scanned[type]) {
			const existingTrans = existing[type]?.[item.name];
			if (existingTrans && !FORCE) {
				skipCount++;
				continue;
			}
			if (!item.desc) {
				skipCount++;
				continue; // 無描述無法翻譯
			}
			untranslated[type].push(item);
		}
	}

	return { untranslated, skipCount };
}

// ── GitHub Models API 呼叫 ───────────────────────────────────

async function callHaiku(prompt) {
	const token = process.env.GITHUB_TOKEN;
	if (!token) throw new Error("GITHUB_TOKEN 未設定");

	const res = await fetch(
		"https://models.inference.ai.azure.com/chat/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				max_tokens: 4096,
				temperature: 0.3,
				messages: [{ role: "user", content: prompt }],
			}),
		},
	);

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`GitHub Models API ${res.status}: ${body.slice(0, 200)}`);
	}

	const data = await res.json();
	const text = data.choices?.[0]?.message?.content || "";

	// 提取 JSON
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) throw new Error(`API 回覆無 JSON：${text.slice(0, 200)}`);
	return JSON.parse(jsonMatch[0]);
}

/** 批次翻譯 */
async function translateBatch(items) {
	const batchList = items
		.map((item) => `[${item.type}] ${item.name} — ${item.desc}`)
		.join("\n");

	const prompt = `將以下 Claude Code AI 資源名稱翻譯為繁體中文。
格式：「簡短名稱 — 一句話說明功能」（不超過 40 個中文字）。

規則：
- 技術名詞保留英文（如 API、CI/CD、TDD、MCP、Docker）
- 語言名保留英文（如 Python、TypeScript、Rust）
- 框架名保留英文（如 Laravel、Django、Spring Boot）
- 重點是讓中文使用者快速理解用途

${batchList}

回傳純 JSON：{"translations":{"type:name":"繁體中文翻譯"}}
例如：{"translations":{"commands:build-fix":"建構修復 — 自動修復建構錯誤","skills:api-design":"API 設計 — RESTful/GraphQL 設計原則與規範"}}`;

	return callHaiku(prompt);
}

// ── 主流程 ────────────────────────────────────────────────────

async function main() {
	console.log("🔍 掃描 AI 來源...");
	const scanned = scanAllSources();
	const totalScanned =
		scanned.commands.length +
		scanned.agents.length +
		scanned.rules.length +
		scanned.skills.length;
	console.log(
		`   找到 ${totalScanned} 個資源（${scanned.commands.length} commands · ${scanned.agents.length} agents · ${scanned.rules.length} rules · ${scanned.skills.length} skills）`,
	);

	// 讀取現有翻譯
	let existing = {};
	try {
		existing = JSON.parse(fs.readFileSync(TRANSLATIONS_PATH, "utf8"));
	} catch {
		console.log("   translations.json 不存在，將建立新檔");
	}

	const existingCount =
		Object.keys(existing.commands || {}).length +
		Object.keys(existing.agents || {}).length +
		Object.keys(existing.rules || {}).length +
		Object.keys(existing.skills || {}).length;
	console.log(`   現有翻譯 ${existingCount} 筆`);

	// 找出未翻譯項
	const { untranslated, skipCount } = findUntranslated(scanned, existing);
	const toTranslate = [];
	for (const type of ["commands", "agents", "rules", "skills"]) {
		for (const item of untranslated[type]) {
			toTranslate.push({ ...item, type });
		}
	}

	console.log(`   需翻譯 ${toTranslate.length} 筆，跳過 ${skipCount} 筆`);

	if (toTranslate.length === 0) {
		console.log("✅ 翻譯已是最新，無需更新");
		return;
	}

	if (DRY_RUN) {
		console.log("\n📋 Dry run — 以下項目需要翻譯：");
		for (const item of toTranslate) {
			console.log(`   [${item.type}] ${item.name} — ${item.desc.slice(0, 60)}`);
		}
		return;
	}

	// 批次翻譯
	const merged = { ...existing };
	for (const type of ["commands", "agents", "rules", "skills"]) {
		if (!merged[type]) merged[type] = {};
	}

	let translated = 0;
	const batches = [];
	for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
		batches.push(toTranslate.slice(i, i + BATCH_SIZE));
	}

	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];
		console.log(
			`\n🤖 翻譯批次 ${i + 1}/${batches.length}（${batch.length} 筆）...`,
		);

		try {
			const result = await translateBatch(batch);
			if (result?.translations) {
				for (const [key, value] of Object.entries(result.translations)) {
					const colonIdx = key.indexOf(":");
					if (colonIdx === -1) continue;
					const type = key.slice(0, colonIdx);
					const name = key.slice(colonIdx + 1);
					if (merged[type]) {
						merged[type][name] = value;
						translated++;
					}
				}
			}
		} catch (e) {
			console.error(`   ❌ 批次 ${i + 1} 翻譯失敗：${e.message}`);
			// 失敗時保留已翻譯的部分，繼續下一批
		}

		// 批次間間隔（避免 rate limit）
		if (i < batches.length - 1) {
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	if (translated === 0) {
		console.log("\n⚠️ 無成功翻譯，不更新檔案");
		return;
	}

	// 按 key 排序（穩定 diff）
	const sorted = {};
	for (const type of ["commands", "agents", "rules", "skills"]) {
		if (merged[type]) {
			sorted[type] = Object.fromEntries(
				Object.entries(merged[type]).sort(([a], [b]) => a.localeCompare(b)),
			);
		}
	}

	// 原子寫入
	const tmpPath = `${TRANSLATIONS_PATH}.tmp`;
	fs.writeFileSync(tmpPath, `${JSON.stringify(sorted, null, 2)}\n`);
	fs.renameSync(tmpPath, TRANSLATIONS_PATH);

	const finalCount =
		Object.keys(sorted.commands || {}).length +
		Object.keys(sorted.agents || {}).length +
		Object.keys(sorted.rules || {}).length +
		Object.keys(sorted.skills || {}).length;
	console.log(`\n✅ 完成：新增 ${translated} 筆翻譯，總計 ${finalCount} 筆`);
}

main().catch((e) => {
	console.error(`\n💥 ${e.message}`);
	process.exit(1);
});
