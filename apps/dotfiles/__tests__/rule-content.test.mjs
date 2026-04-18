import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TESTING_CONTENT } from "../libs/config/rule-content.mjs";

describe("rule-content 常數", () => {
	it("TESTING_CONTENT 是非空字串", () => {
		assert.ok(typeof TESTING_CONTENT === "string");
		assert.ok(TESTING_CONTENT.length > 0);
	});
});

describe("TESTING_CONTENT 內容驗證", () => {
	it("包含測試架構章節", () => {
		assert.ok(TESTING_CONTENT.includes("## 測試架構"));
	});

	it("包含覆蓋率目標章節", () => {
		assert.ok(TESTING_CONTENT.includes("## 覆蓋率目標"));
	});

	it("包含 80% 覆蓋率標準", () => {
		assert.ok(TESTING_CONTENT.includes("80%"));
	});

	it("不包含未定義的佔位符", () => {
		const placeholderPattern = /\$\{[\w.]+\}/g;
		assert.ok(!placeholderPattern.test(TESTING_CONTENT));
	});

	it("非空白內容", () => {
		assert.ok(TESTING_CONTENT.trim().length > 0);
	});
});
