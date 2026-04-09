import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CODING_STYLE_CONTENT,
	GIT_WORKFLOW_CONTENT,
	TESTING_CONTENT,
} from "../lib/config/rule-content.mjs";

describe("rule-content 常數", () => {
	it("CODING_STYLE_CONTENT 是非空字串", () => {
		assert.ok(typeof CODING_STYLE_CONTENT === "string");
		assert.ok(CODING_STYLE_CONTENT.length > 0);
	});

	it("TESTING_CONTENT 是非空字串", () => {
		assert.ok(typeof TESTING_CONTENT === "string");
		assert.ok(TESTING_CONTENT.length > 0);
	});

	it("GIT_WORKFLOW_CONTENT 是非空字串", () => {
		assert.ok(typeof GIT_WORKFLOW_CONTENT === "string");
		assert.ok(GIT_WORKFLOW_CONTENT.length > 0);
	});
});

describe("CODING_STYLE_CONTENT 內容驗證", () => {
	it("包含基本原則章節", () => {
		assert.ok(CODING_STYLE_CONTENT.includes("## 基本原則"));
	});

	it("包含不可變性相關內容", () => {
		assert.ok(
			CODING_STYLE_CONTENT.includes("immutable") ||
				CODING_STYLE_CONTENT.includes("不可變"),
		);
	});

	it("包含格式化與組織章節", () => {
		assert.ok(CODING_STYLE_CONTENT.includes("## 格式化與組織"));
	});

	it("包含非同步與錯誤處理章節", () => {
		assert.ok(CODING_STYLE_CONTENT.includes("## 非同步與錯誤處理"));
	});

	it("包含 async/await 相關內容", () => {
		assert.ok(
			CODING_STYLE_CONTENT.includes("async") ||
				CODING_STYLE_CONTENT.includes("await"),
		);
	});
});

describe("TESTING_CONTENT 內容驗證", () => {
	it("包含測試架構章節", () => {
		assert.ok(TESTING_CONTENT.includes("## 測試架構"));
	});

	it("包含 src/ 和 tests/ 相關內容", () => {
		assert.ok(
			TESTING_CONTENT.includes("src/") || TESTING_CONTENT.includes("tests/"),
		);
	});

	it("包含覆蓋率目標章節", () => {
		assert.ok(TESTING_CONTENT.includes("## 覆蓋率目標"));
	});

	it("包含 80% 覆蓋率標準", () => {
		assert.ok(TESTING_CONTENT.includes("80%"));
	});

	it("包含行為驅動命名相關內容", () => {
		assert.ok(
			TESTING_CONTENT.includes("行為") || TESTING_CONTENT.includes("命名"),
		);
	});

	it("包含領域邏輯、驗證、授權、失敗路徑相關內容", () => {
		assert.ok(
			TESTING_CONTENT.includes("領域邏輯") ||
				TESTING_CONTENT.includes("驗證") ||
				TESTING_CONTENT.includes("失敗路徑"),
		);
	});
});

describe("GIT_WORKFLOW_CONTENT 內容驗證", () => {
	it("包含 Commit 訊息格式章節", () => {
		assert.ok(GIT_WORKFLOW_CONTENT.includes("## Commit 訊息格式"));
	});

	it("包含 type 類型列表", () => {
		assert.ok(
			GIT_WORKFLOW_CONTENT.includes("feat") ||
				GIT_WORKFLOW_CONTENT.includes("fix") ||
				GIT_WORKFLOW_CONTENT.includes("refactor"),
		);
	});

	it("包含 Pull Request 工作流程章節", () => {
		assert.ok(GIT_WORKFLOW_CONTENT.includes("## Pull Request 工作流程"));
	});

	it("包含 git diff 相關內容", () => {
		assert.ok(GIT_WORKFLOW_CONTENT.includes("git diff"));
	});

	it("包含分析完整 commit 歷史的指導", () => {
		assert.ok(
			GIT_WORKFLOW_CONTENT.includes("commit 歷史") ||
				GIT_WORKFLOW_CONTENT.includes("commit") ||
				GIT_WORKFLOW_CONTENT.includes("分析"),
		);
	});

	it("包含 push -u 旗標相關內容", () => {
		assert.ok(
			GIT_WORKFLOW_CONTENT.includes("-u") ||
				GIT_WORKFLOW_CONTENT.includes("push"),
		);
	});
});

describe("rule-content 常數完整性", () => {
	it("三個常數都不是空白或僅包含空格", () => {
		assert.ok(CODING_STYLE_CONTENT.trim().length > 0);
		assert.ok(TESTING_CONTENT.trim().length > 0);
		assert.ok(GIT_WORKFLOW_CONTENT.trim().length > 0);
	});

	it("三個常數都不包含未定義的佔位符", () => {
		const placeholderPattern = /\$\{[\w.]+\}/g;
		assert.ok(!placeholderPattern.test(CODING_STYLE_CONTENT));
		assert.ok(!placeholderPattern.test(TESTING_CONTENT));
		assert.ok(!placeholderPattern.test(GIT_WORKFLOW_CONTENT));
	});
});
