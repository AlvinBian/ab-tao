import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

// 用臨時目錄隔離，不污染實際 ~/.claude
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ab-tao-state-test-"));
process.env.HOME = TMP; // paths.mjs 的 HOME 依賴

// 動態 import（需等 HOME 環境變數設好）
const {
	stateRead,
	stateWrite,
	stateSetManaged,
	stateGetManaged,
	stateSetChoice,
	stateGetChoice,
	stateResetChoices,
} = await import("../state.mjs");

const STATE_DIR = path.join(TMP, ".claude", ".ab-tao");
const STATE_PATH = path.join(STATE_DIR, "state.json");

describe("state.mjs", () => {
	beforeEach(() => {
		// 每個 test 前清除 state 檔
		try {
			fs.rmSync(STATE_DIR, { recursive: true });
		} catch {}
	});

	after(() => {
		try {
			fs.rmSync(TMP, { recursive: true });
		} catch {}
	});

	// ── happy path ────────────────────────────────────────────
	it("stateRead 在無 state.json 時回傳 empty state", () => {
		const s = stateRead();
		assert.equal(s.version, "1.0.0");
		assert.deepEqual(s.managed, {});
		assert.deepEqual(s.choices, {});
	});

	it("stateWrite 寫入後 stateRead 可讀回", () => {
		stateWrite((s) => {
			s.managed["CLAUDE.md"] = {
				sha256: "abc123",
				source: "ab-tao:apps/dotfiles/claude/CLAUDE.md",
				installedAt: "2026-04-18T00:00:00Z",
			};
		});
		const s = stateRead();
		assert.equal(s.managed["CLAUDE.md"].sha256, "abc123");
		assert(fs.existsSync(STATE_PATH), "state.json 應存在");
	});

	it("stateSetManaged + stateGetManaged 正確讀寫", () => {
		stateSetManaged("agents/architect.md", {
			sha256: "def456",
			source: "ab-tao:apps/dotfiles/claude/agents/architect.md",
			installedAt: "2026-04-18T00:00:00Z",
		});
		const entry = stateGetManaged("agents/architect.md");
		assert.equal(entry.sha256, "def456");
		assert.equal(entry.userOverride, undefined);
	});

	it("stateSetChoice keep-local 自動設 userOverride=true", () => {
		stateSetManaged("CLAUDE.md", {
			sha256: "aaa",
			source: "ab-tao:apps/dotfiles/claude/CLAUDE.md",
			installedAt: "2026-04-18T00:00:00Z",
		});
		stateSetChoice("CLAUDE.md", "keep-local");
		const choice = stateGetChoice("CLAUDE.md");
		const entry = stateGetManaged("CLAUDE.md");
		assert.equal(choice.decision, "keep-local");
		assert.equal(entry.userOverride, true);
	});

	// ── edge cases ────────────────────────────────────────────
	it("stateResetChoices 清空所有選擇並重設 userOverride", () => {
		stateSetManaged("CLAUDE.md", {
			sha256: "bbb",
			source: "ab-tao:...",
			installedAt: "2026-04-18T00:00:00Z",
		});
		stateSetChoice("CLAUDE.md", "keep-local");
		stateResetChoices();
		const s = stateRead();
		assert.deepEqual(s.choices, {});
		assert.equal(s.managed["CLAUDE.md"].userOverride, false);
	});

	it("stateWrite merge 語義不覆蓋未修改的欄位", () => {
		stateSetManaged("test.md", {
			sha256: "ccc",
			source: "ab-tao:...",
			installedAt: "2026-04-18T00:00:00Z",
		});
		stateSetManaged("test.md", { sha256: "ddd" });
		const entry = stateGetManaged("test.md");
		assert.equal(entry.sha256, "ddd");
		assert.equal(entry.source, "ab-tao:..."); // 原欄位保留
	});

	// ── error path ────────────────────────────────────────────
	it("stateRead 在 state.json 損壞時回傳 empty state", () => {
		fs.mkdirSync(STATE_DIR, { recursive: true });
		fs.writeFileSync(STATE_PATH, "{ invalid json }", "utf8");
		const s = stateRead();
		assert.deepEqual(s.managed, {});
	});
});
