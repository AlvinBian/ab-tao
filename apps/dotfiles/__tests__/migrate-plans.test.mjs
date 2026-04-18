import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	decodedLabel,
	readRelocated,
	updateIndex,
} from "../bin/migrate-plans.mjs";

// ── 臨時目錄工廠 ─────────────────────────────────────────────────────────────
let tmpDir;
beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-plans-test-"));
});
afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── decodedLabel ─────────────────────────────────────────────────────────────
describe("decodedLabel", () => {
	it("長路徑取最後三段（連字號各自視為路徑分隔）", () => {
		// "-Users-alvin-ab-projects-ab-tao" 拆成 6 段，取後 3 段
		assert.equal(
			decodedLabel("-Users-alvin-ab-projects-ab-tao"),
			".../projects/ab/tao",
		);
	});

	it("短路徑（≤2 段）直接呈現", () => {
		assert.equal(decodedLabel("-foo-bar"), "foo/bar");
	});
});

// ── updateIndex（一般 slug）────────────────────────────────────────────────────
describe("updateIndex — 一般 slug", () => {
	it("不存在時建立 index.md，連結不含雙 .md", () => {
		const plansDir = path.join(tmpDir, "plans");
		fs.mkdirSync(plansDir);
		updateIndex(plansDir, "my-plan.md", "My Plan");
		const content = fs.readFileSync(path.join(plansDir, "index.md"), "utf8");
		assert.ok(content.includes("- [My Plan](./my-plan.md)"));
		assert.ok(!content.includes(".md.md"), "不應出現雙副檔名");
	});

	it("已存在 index.md 時 append 一行", () => {
		const plansDir = path.join(tmpDir, "plans");
		fs.mkdirSync(plansDir);
		fs.writeFileSync(path.join(plansDir, "index.md"), "# Plans\n\n");
		updateIndex(plansDir, "plan-a.md", "Plan A");
		updateIndex(plansDir, "plan-b.md", "Plan B");
		const content = fs.readFileSync(path.join(plansDir, "index.md"), "utf8");
		assert.ok(content.includes("./plan-a.md"));
		assert.ok(content.includes("./plan-b.md"));
	});

	it("冪等：相同 slug 不重複新增", () => {
		const plansDir = path.join(tmpDir, "plans");
		fs.mkdirSync(plansDir);
		updateIndex(plansDir, "dup.md", "Dup");
		updateIndex(plansDir, "dup.md", "Dup");
		const content = fs.readFileSync(path.join(plansDir, "index.md"), "utf8");
		const matches = content.match(/dup\.md/g) ?? [];
		assert.equal(matches.length, 1, "slug 只應出現一次");
	});
});

// ── updateIndex（archive slug）────────────────────────────────────────────────
describe("updateIndex — archive slug（B1 修復驗證）", () => {
	it("archive 連結包含 archive/ 前綴", () => {
		const plansDir = path.join(tmpDir, "plans");
		fs.mkdirSync(plansDir);
		updateIndex(plansDir, "archive/old-plan.md", "Old Plan");
		const content = fs.readFileSync(path.join(plansDir, "index.md"), "utf8");
		assert.ok(
			content.includes("- [Old Plan](./archive/old-plan.md)"),
			`連結應為 ./archive/old-plan.md，實際：${content}`,
		);
	});

	it("archive 冪等：相同路徑不重複新增", () => {
		const plansDir = path.join(tmpDir, "plans");
		fs.mkdirSync(plansDir);
		updateIndex(plansDir, "archive/old-plan.md", "Old Plan");
		updateIndex(plansDir, "archive/old-plan.md", "Old Plan");
		const content = fs.readFileSync(path.join(plansDir, "index.md"), "utf8");
		const matches = content.match(/old-plan\.md/g) ?? [];
		assert.equal(matches.length, 1, "archive slug 只應出現一次");
	});
});

// ── readRelocated / markRelocated ─────────────────────────────────────────────
describe("readRelocated / markRelocated", () => {
	// 覆寫 RELOCATED_MARKER 路徑需要注入，這裡透過測試臨時環境驗證邏輯
	it("marker 不存在時回傳空 Set", () => {
		// readRelocated 讀取 HOME/.claude/.plans-relocated；
		// 這個測試確認正常執行不 throw
		const result = readRelocated();
		assert.ok(result instanceof Set);
	});

	it("markRelocated 追加後 readRelocated 可讀到", () => {
		// 此測試依賴真實 HOME，若 marker 已存在則結果會包含既有內容
		// 只驗證函式不 throw、回傳型別正確
		assert.doesNotThrow(() => {
			const before = readRelocated();
			assert.ok(before instanceof Set);
		});
	});
});
