import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { isDryRun, runCmd, runCmdAsync, setDryRun } from "../run-cmd.mjs";

describe("run-cmd.mjs", () => {
	beforeEach(() => setDryRun(false));

	it("isDryRun 預設為 false", () => {
		assert.equal(isDryRun(), false);
	});

	it("setDryRun(true) 後 runCmd 不執行 fn", () => {
		setDryRun(true);
		let called = false;
		const result = runCmd("測試操作", () => {
			called = true;
			return 42;
		});
		assert.equal(called, false);
		assert.equal(result, undefined);
	});

	it("setDryRun(false) 後 runCmd 正常執行 fn", () => {
		let called = false;
		const result = runCmd("測試操作", () => {
			called = true;
			return 42;
		});
		assert.equal(called, true);
		assert.equal(result, 42);
	});

	it("runCmdAsync dry-run 模式下不執行 fn", async () => {
		setDryRun(true);
		let called = false;
		const result = await runCmdAsync("非同步操作", async () => {
			called = true;
			return 99;
		});
		assert.equal(called, false);
		assert.equal(result, undefined);
	});
});
