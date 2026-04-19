import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { backup, listBackups, pruneOldBackups } from "../backup.mjs";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ab-tao-backup-test-"));

describe("backup.mjs", () => {
	after(() => {
		try {
			fs.rmSync(TMP, { recursive: true });
		} catch {}
	});

	it("backup 對存在的檔案建立 .bak.{ts} 副本", () => {
		const src = path.join(TMP, "test.md");
		fs.writeFileSync(src, "hello");
		const bak = backup(src);
		assert(bak !== null, "應回傳 backup 路徑");
		assert(bak.includes(".bak."), "backup 路徑應含 .bak.");
		assert.equal(fs.readFileSync(bak, "utf8"), "hello");
	});

	it("backup 對不存在的檔案回傳 null", () => {
		assert.equal(backup(path.join(TMP, "ghost.md")), null);
	});

	it("listBackups 回傳由新到舊的 backup 清單", () => {
		const src = path.join(TMP, "multi.md");
		fs.writeFileSync(src, "v1");
		const _b1 = backup(src);
		fs.writeFileSync(src, "v2");
		const _b2 = backup(src);
		const list = listBackups(src);
		assert(list.length >= 2);
		assert(list[0] >= list[1], "應由新到舊排序");
	});

	it("pruneOldBackups 刪除超過 maxAgeDays 的 backup", () => {
		const src = path.join(TMP, "prune.md");
		fs.writeFileSync(src, "x");
		// 手動建立一個 30 天前的假 backup
		const oldBak = `${src}.bak.${Date.now() - 31 * 24 * 60 * 60 * 1000}`;
		fs.writeFileSync(oldBak, "old");
		const deleted = pruneOldBackups(src, 30);
		assert(deleted.includes(oldBak), "舊 backup 應被刪除");
		assert(!fs.existsSync(oldBak), "檔案應已不存在");
	});
});
