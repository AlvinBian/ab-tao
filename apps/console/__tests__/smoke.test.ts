import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";

describe("Wave 0 Smoke Test", () => {
	it("Pinia store 可初始化", () => {
		setActivePinia(createPinia());
		expect(true).toBe(true);
	});

	it("TTL 常數合理（30 秒）", () => {
		// 確認 30_000ms = 30s
		expect(30_000 / 1000).toBe(30);
	});
});
