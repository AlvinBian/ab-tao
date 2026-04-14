#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContent } from "./security-validator.mjs";
import { readVersions } from "./version-tracker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = path.resolve(__dirname, "../resources/ai/sources");

const EXPECTED_STRUCTURES = {
	ecc: { required: ["commands", "agents", "rules"], format: "ecc" },
	anthropic: { required: [], format: "agent-skills" },
	superpowers: { required: [], format: "agent-skills" },
	"context-engineering": { required: [], format: "agent-skills" },
};

function validateSourceStructure(sourceName, sourcePath) {
	const errors = [];
	const config = EXPECTED_STRUCTURES[sourceName];

	if (!config) {
		errors.push(`未知的來源: ${sourceName}`);
		return errors;
	}

	if (!fs.existsSync(sourcePath)) {
		errors.push(`來源目錄不存在: ${sourcePath}`);
		return errors;
	}

	// 檢查必要子目錄
	for (const dir of config.required) {
		const dirPath = path.join(sourcePath, dir);
		if (!fs.existsSync(dirPath)) {
			errors.push(`缺少必要目錄: ${sourceName}/${dir}`);
		}
	}

	// 格式專屬檢查
	if (config.format === "agent-skills") {
		const items = fs.readdirSync(sourcePath, { withFileTypes: true });
		const hasSkills = items.some((entry) => {
			return (
				entry.isDirectory() &&
				fs.existsSync(path.join(sourcePath, entry.name, "SKILL.md"))
			);
		});

		// agent-skills 格式不一定都有 SKILL.md — 僅警告
		if (!hasSkills && items.length > 0) {
			console.warn(`  警告: ${sourceName} 中未找到 SKILL.md（可能正常）`);
		}
	}

	return errors;
}

async function validateAll() {
	console.log("正在驗證資源結構...\n");

	const versions = readVersions();
	let totalErrors = 0;

	for (const sourceName of Object.keys(EXPECTED_STRUCTURES)) {
		const sourcePath = path.join(RESOURCES_PATH, sourceName);

		if (!fs.existsSync(sourcePath)) {
			console.log(`[${sourceName}] 尚未同步，跳過`);
			continue;
		}

		console.log(`[${sourceName}]`);

		// 結構檢查
		const structErrors = validateSourceStructure(sourceName, sourcePath);
		for (const err of structErrors) {
			console.error(`  結構: ${err}`);
		}

		// 安全檢查
		const { ok, summary } = await validateContent(sourcePath);
		if (!ok) {
			for (const err of summary.errors) {
				console.error(`  安全 [${err.code}]: ${err.file} — ${err.message}`);
			}
		}

		const sourceErrors = structErrors.length + (ok ? 0 : summary.errors.length);
		if (sourceErrors === 0) {
			const version = versions[sourceName];
			const sha = version?.sha ? version.sha.slice(0, 8) : "未知";
			console.log(`  通過 (${summary.total} 個檔案, SHA: ${sha})`);
		}

		totalErrors += sourceErrors;
		console.log();
	}

	if (totalErrors > 0) {
		console.error(`驗證失敗，共 ${totalErrors} 個錯誤`);
		process.exit(1);
	}

	console.log("所有驗證通過");
}

validateAll().catch((err) => {
	console.error(err.message);
	process.exit(1);
});
