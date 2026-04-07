#!/usr/bin/env node

/**
 * 使用 GitHub Models API 翻譯 README.md
 * 使用內建 GITHUB_TOKEN，無需額外 API Key
 */

import fs from "node:fs";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
	console.error("❌ 缺少 GITHUB_TOKEN");
	process.exit(1);
}

const ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";
const MODEL = "gpt-4o-mini";

// 語言切換列（各語言版本 active 項不同）
const SWITCHERS = {
	source:
		"**繁體中文** | [简体中文](README-zh-CN.md) | [English](README-en.md)",
	"zh-CN": "[繁體中文](README.md) | **简体中文** | [English](README-en.md)",
	en: "[繁體中文](README.md) | [简体中文](README-zh-CN.md) | **English**",
};

async function translate(content, targetLangName) {
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${GITHUB_TOKEN}`,
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [
				{
					role: "system",
					content: `You are a professional technical translator. Translate the following Markdown README to ${targetLangName}. Rules:
- Keep ALL Markdown syntax, code blocks, inline code, links, and HTML tags unchanged
- Keep technical terms, command names, package names, and proper nouns unchanged
- Translate only natural language text
- Preserve the exact same structure and formatting`,
				},
				{ role: "user", content },
			],
			temperature: 0.2,
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`API 錯誤 ${res.status}: ${err}`);
	}

	const data = await res.json();
	return data.choices[0].message.content;
}

const readme = fs.readFileSync("README.md", "utf8");

// 移除已有的語言切換列（避免重複翻譯切換列本身）
const stripped = readme.replace(/^\*\*繁體中文\*\*[^\n]*\n\n/, "");

console.log("🌐 翻譯 → 简体中文...");
const zhCN = await translate(stripped, "Simplified Chinese (简体中文)");
fs.writeFileSync("README-zh-CN.md", `${SWITCHERS["zh-CN"]}\n\n${zhCN}\n`);
console.log("✅ README-zh-CN.md");

console.log("🌐 翻譯 → English...");
const en = await translate(stripped, "English");
fs.writeFileSync("README-en.md", `${SWITCHERS.en}\n\n${en}\n`);
console.log("✅ README-en.md");
