import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "../../..");

const FORBIDDEN_PATTERNS = [
	[/pnpm run c:sync(?!\s*-|:select)/, "c:sync → c:ai-sync"],
	[/pnpm run d:sync(?!\s*-)/, "d:sync → d:prefs-sync"],
	[/pnpm run d:doctor(?!\s)/, "d:doctor → d:setup --doctor"],
	[/pnpm run d:migrate-plans/, "d:migrate-plans 已刪除"],
	[/pnpm run d:flow(?!\w)/, "d:flow 已刪除"],
];

const SCAN_FILES = [
	"README.md",
	"README-en.md",
	"README-zh-CN.md",
	"CLAUDE.md",
	"apps/dotfiles/README.md",
	"packages/commons/README.md",
	"docs/plans-and-memory.md",
];

const EXCLUDE_PATTERNS = [/plans\//, /CHANGELOG\.md/, /\.bak/];

test("文件中無過時命令引用", () => {
	const violations = [];
	for (const file of SCAN_FILES) {
		const full = join(ROOT, file);
		let content;
		try {
			content = readFileSync(full, "utf8");
		} catch {
			continue;
		}
		if (EXCLUDE_PATTERNS.some((p) => p.test(file))) continue;
		for (const [pattern, msg] of FORBIDDEN_PATTERNS) {
			if (pattern.test(content)) {
				violations.push(`${file}: ${msg}`);
			}
		}
	}
	assert.deepEqual(violations, [], "發現過時命令：" + violations.join("\n"));
});
