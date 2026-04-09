import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	detectTechStack,
	initializeCommons,
	ResourceLoader,
	sanitizeContent,
	validateFileContent,
} from "../libs/external/commons-integration.mjs";

describe("commons-integration 橋接模組", () => {
	it("應重新匯出安全驗證", () => {
		assert.equal(typeof validateFileContent, "function");
		assert.equal(typeof sanitizeContent, "function");
	});

	it("應透過 commons 驗證檔案內容", () => {
		const safe = validateFileContent("test.md", "# Hello World");
		assert.ok(safe.valid);
		assert.ok(safe.checksum);

		// .md 檔：危險 pattern 產生警告（非錯誤）
		const mdWithPattern = validateFileContent("test.md", 'eval("alert(1)")');
		assert.ok(mdWithPattern.valid);
		assert.ok(mdWithPattern.warnings.length > 0);

		// 非文件檔：危險 pattern 產生錯誤
		const jsWithPattern = validateFileContent("test.js", 'eval("alert(1)")');
		assert.ok(!jsWithPattern.valid);
		assert.ok(jsWithPattern.errors.length > 0);
	});

	it("應重新匯出技術偵測", () => {
		assert.equal(typeof detectTechStack, "function");
	});

	it("應重新匯出 ResourceLoader", () => {
		assert.equal(typeof ResourceLoader, "function");
	});

	it("應匯出 initializeCommons", () => {
		assert.equal(typeof initializeCommons, "function");
	});
});
