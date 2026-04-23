import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const RULES_DIR = resolve(
	new URL(".", import.meta.url).pathname,
	"../claude/rules",
);
const EXPECTED = [
	"api-and-data",
	"migrations",
	"testing",
	"typescript",
	"vue-nuxt",
].sort();

test("rules/ 只含預期的 5 個規則檔", () => {
	const actual = readdirSync(RULES_DIR)
		.filter((f) => f.endsWith(".md"))
		.map((f) => f.replace(".md", ""))
		.sort();
	assert.deepEqual(
		actual,
		EXPECTED,
		`rules/ 內容不符：\n  預期：${EXPECTED}\n  實際：${actual}`,
	);
});
