import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { stateWrite } from "../../state/state.mjs";
import {
	applyFileChoice,
	ChoiceAction,
	evaluateFile,
	getCIDefault,
	isCI,
} from "../config-prompt.mjs";
import { setDryRun } from "../run-cmd.mjs";
import { sha256OfString } from "../three-way-diff.mjs";

const TMP = fs.mkdtempSync(
	path.join(os.tmpdir(), "ab-tao-config-prompt-test-"),
);
const TS = Date.now();
const testRel = (name) => `__test-config-prompt-${TS}__/${name}`;

function write(name, content) {
	const p = path.join(TMP, name);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, content, "utf8");
	return p;
}

function cleanState(...keys) {
	stateWrite((s) => {
		for (const k of keys) {
			delete s.choices[k];
			delete s.managed[k];
		}
	});
}

after(() => {
	fs.rmSync(TMP, { recursive: true, force: true });
	// 清除所有本次測試寫入的 state 條目
	stateWrite((s) => {
		for (const key of Object.keys(s.choices)) {
			if (key.startsWith(`__test-config-prompt-${TS}__`)) delete s.choices[key];
		}
		for (const key of Object.keys(s.managed)) {
			if (key.startsWith(`__test-config-prompt-${TS}__`)) delete s.managed[key];
		}
	});
	setDryRun(false);
});

// ── isCI ─────────────────────────────────────────────────────────────────────

describe("isCI()", () => {
	it("CI=true → 回傳 true", () => {
		const orig = process.env.CI;
		process.env.CI = "true";
		assert.equal(isCI(), true);
		if (orig === undefined) delete process.env.CI;
		else process.env.CI = orig;
	});

	it("CI 未設定 + stdin 非 TTY（測試環境）→ 回傳 true", () => {
		const orig = process.env.CI;
		delete process.env.CI;
		// Node.js test runner 的 stdin 不是 TTY
		assert.equal(isCI(), true);
		if (orig !== undefined) process.env.CI = orig;
	});
});

// ── getCIDefault ─────────────────────────────────────────────────────────────

describe("getCIDefault()", () => {
	const relPath = testRel("ci-default.md");

	after(() => {
		delete process.env.AB_TAO_CHOICE_DEFAULT;
		cleanState(relPath);
	});

	it("happy：無 env、無 state → keep-local（yadm 預設）", () => {
		const orig = process.env.AB_TAO_CHOICE_DEFAULT;
		delete process.env.AB_TAO_CHOICE_DEFAULT;
		assert.equal(getCIDefault(relPath), ChoiceAction.KEEP_LOCAL);
		if (orig !== undefined) process.env.AB_TAO_CHOICE_DEFAULT = orig;
	});

	it("edge：AB_TAO_CHOICE_DEFAULT=use-ab-tao → USE_AB_TAO", () => {
		process.env.AB_TAO_CHOICE_DEFAULT = "use-ab-tao";
		assert.equal(
			getCIDefault(testRel("ci-env-use.md")),
			ChoiceAction.USE_AB_TAO,
		);
		delete process.env.AB_TAO_CHOICE_DEFAULT;
	});

	it("edge：AB_TAO_CHOICE_DEFAULT=merge → MERGE", () => {
		process.env.AB_TAO_CHOICE_DEFAULT = "merge";
		assert.equal(getCIDefault(testRel("ci-env-merge.md")), ChoiceAction.MERGE);
		delete process.env.AB_TAO_CHOICE_DEFAULT;
	});

	it("error：state 已有選擇 → 直接採用（忽略 env）", () => {
		process.env.AB_TAO_CHOICE_DEFAULT = "use-ab-tao";
		stateWrite((s) => {
			s.choices[relPath] = {
				decision: "merge",
				lockedAt: new Date().toISOString(),
			};
		});
		assert.equal(getCIDefault(relPath), "merge");
		delete process.env.AB_TAO_CHOICE_DEFAULT;
		cleanState(relPath);
	});
});

// ── evaluateFile ─────────────────────────────────────────────────────────────

describe("evaluateFile()", () => {
	it("happy：source == target → status=same, autoAction=same", () => {
		const src = write("eval-same-src.md", "identical content");
		const tgt = write("eval-same-tgt.md", "identical content");
		const result = evaluateFile(testRel("same.md"), src, tgt);
		assert.equal(result.status, "same");
		assert.equal(result.autoAction, "same");
	});

	it("edge：target 不存在（DELETED_LOCAL）→ status=new-file, autoAction=USE_AB_TAO", () => {
		const src = write("eval-new-src.md", "source content");
		const result = evaluateFile(
			testRel("new-file.md"),
			src,
			path.join(TMP, "ghost-nonexistent.md"),
		);
		assert.equal(result.status, "new-file");
		assert.equal(result.autoAction, ChoiceAction.USE_AB_TAO);
	});

	it("edge：SOURCE_ONLY_CHANGE → status=drift, autoAction=USE_AB_TAO, autoReason=source-only", () => {
		const relPath = testRel("source-only.md");
		const originalContent = "original content";
		const src = write("eval-src-only-src.md", "upstream updated");
		const tgt = write("eval-src-only-tgt.md", originalContent);
		// 模擬 ancestor sha == targetSha（target 未動）
		stateWrite((s) => {
			s.managed[relPath] = {
				sha256: sha256OfString(originalContent),
				source: "test",
				installedAt: new Date().toISOString(),
				userOverride: false,
			};
		});
		const result = evaluateFile(relPath, src, tgt);
		cleanState(relPath);
		assert.equal(result.status, "drift");
		assert.equal(result.autoAction, ChoiceAction.USE_AB_TAO);
		assert.equal(result.autoReason, "source-only");
	});

	it("edge：BOTH_CHANGED → status=drift, autoAction=null（需要 prompt）", () => {
		const relPath = testRel("both-changed.md");
		const src = write("eval-both-src.md", "upstream changed");
		const tgt = write("eval-both-tgt.md", "user changed");
		stateWrite((s) => {
			s.managed[relPath] = {
				sha256: sha256OfString("original base"),
				source: "test",
				installedAt: new Date().toISOString(),
				userOverride: false,
			};
		});
		const result = evaluateFile(relPath, src, tgt);
		cleanState(relPath);
		assert.equal(result.status, "drift");
		assert.equal(result.autoAction, null);
	});

	it("error：source 不存在 → status=source-missing, autoAction=SKIP", () => {
		const result = evaluateFile(
			testRel("src-missing.md"),
			path.join(TMP, "nonexistent-source.md"),
			write("eval-src-missing-tgt.md", "local content"),
		);
		assert.equal(result.status, "source-missing");
		assert.equal(result.autoAction, ChoiceAction.SKIP);
	});
});

// ── applyFileChoice ───────────────────────────────────────────────────────────

describe("applyFileChoice()", () => {
	it("happy：USE_AB_TAO（dry-run）→ applied=true，不實際複製", () => {
		setDryRun(true);
		const relPath = testRel("apply-use.md");
		const src = write("apply-use-src.md", "template content");
		const tgt = path.join(TMP, "apply-use-tgt.md");
		const result = applyFileChoice(ChoiceAction.USE_AB_TAO, relPath, src, tgt);
		setDryRun(false);
		assert.equal(result.applied, true);
		assert(!fs.existsSync(tgt), "dry-run 不應寫入 target");
	});

	it("edge：MERGE with valid JSON → applied=true（dry-run：不實際寫入）", () => {
		setDryRun(true);
		const relPath = testRel("apply-merge.json");
		const src = write(
			"apply-merge-src.json",
			JSON.stringify({ a: 1, b: { x: 10 } }),
		);
		const tgt = write(
			"apply-merge-tgt.json",
			JSON.stringify({ b: { y: 20 }, c: 3 }),
		);
		const result = applyFileChoice(ChoiceAction.MERGE, relPath, src, tgt);
		setDryRun(false);
		// dry-run 不寫，但 applied=true（合併計算完成）
		assert.equal(result.applied, true);
	});

	it("edge：MERGE with non-JSON → fallback keep-local, applied=false", () => {
		setDryRun(true);
		const relPath = testRel("apply-merge-fallback.md");
		const src = write("apply-merge-fb-src.md", "# plain markdown");
		const tgt = write("apply-merge-fb-tgt.md", "# local markdown");
		const result = applyFileChoice(ChoiceAction.MERGE, relPath, src, tgt);
		setDryRun(false);
		assert.equal(result.applied, false);
		assert.equal(result.fallback, "keep-local");
	});

	it("error：SKIP → applied=false，無任何副作用", () => {
		const relPath = testRel("apply-skip.md");
		const src = write("apply-skip-src.md", "content");
		const tgt = write("apply-skip-tgt.md", "local");
		const origMtime = fs.statSync(tgt).mtimeMs;
		const result = applyFileChoice(ChoiceAction.SKIP, relPath, src, tgt);
		assert.equal(result.applied, false);
		assert.equal(fs.statSync(tgt).mtimeMs, origMtime, "target 不應被觸及");
	});
});
