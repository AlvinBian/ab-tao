import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deepMergeUnlessPresent, parseJsonSafe } from "../deep-merge.mjs";

describe("deep-merge.mjs", () => {
	it("使用者 key 優先：target 的 key 不被 source 覆蓋", () => {
		const source = { a: 1, b: 2 };
		const target = { a: 99 };
		const result = deepMergeUnlessPresent(source, target);
		assert.equal(result.a, 99, "使用者 a 應保留");
		assert.equal(result.b, 2, "source 的 b 補入");
	});

	it("source 新增 key 補入 target（merge-unless-present）", () => {
		const source = { existing: "x", newKey: "from-template" };
		const target = { existing: "user" };
		const result = deepMergeUnlessPresent(source, target);
		assert.equal(result.existing, "user");
		assert.equal(result.newKey, "from-template");
	});

	it("深度物件遞迴：target 子物件的 key 保留，source 補入缺漏", () => {
		const source = { nested: { a: 1, b: 2 } };
		const target = { nested: { a: 99 } };
		const result = deepMergeUnlessPresent(source, target);
		assert.equal(result.nested.a, 99);
		assert.equal(result.nested.b, 2);
	});

	it("陣列不做深度合併，以 target 為準", () => {
		const source = { arr: [1, 2, 3] };
		const target = { arr: [4, 5] };
		const result = deepMergeUnlessPresent(source, target);
		assert.deepEqual(result.arr, [4, 5]);
	});

	it("parseJsonSafe 解析合法 JSON", () => {
		assert.deepEqual(parseJsonSafe('{"a":1}'), { a: 1 });
	});

	it("parseJsonSafe 非法 JSON 回傳 null", () => {
		assert.equal(parseJsonSafe("{ bad json }"), null);
	});
});
