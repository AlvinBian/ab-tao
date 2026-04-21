/**
 * lock.mjs — settings.json 寫入互斥鎖
 *
 * 兩層保護：
 *   1. console.lock — Console 自身的互斥（防止 Console 並發寫）
 *   2. state.lock   — d:setup 寫入鎖（d:setup 執行時 Console 唯讀）
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

let _P = null;
async function getP() {
	if (!_P) {
		const m = await import(path.join(DOTFILES_LIB, "core/paths.mjs"));
		_P = m.P;
	}
	return _P;
}

export class LockedError extends Error {
	constructor(owner, since) {
		super(`settings.json 被鎖定中（owner: ${owner}）`);
		this.code = "LOCKED";
		this.owner = owner;
		this.since = since;
	}
}

/**
 * 包裹需要互斥的 settings mutation。
 * 若 d:setup 正在執行（state.lock 存在）→ 拋出 LockedError。
 * 若 Console 已有另一 mutation 在跑（console.lock 存在且 pid 存活）→ 拋出 LockedError。
 *
 * @template T
 * @param {() => Promise<T>} fn 要執行的 mutation
 * @returns {Promise<T>}
 */
export async function withSettingsLock(fn) {
	const P = await getP();
	const consoleLockPath = path.join(P.abTaoDir, "console.lock");
	const setupLockPath = path.join(P.abTaoDir, "state.lock");

	// 1. 檢查 d:setup lock
	if (existsSync(setupLockPath)) {
		let owner = "ab-tao_setup";
		let since = null;
		try {
			const raw = JSON.parse(readFileSync(setupLockPath, "utf8"));
			owner = raw.owner ?? owner;
			since = raw.since ?? null;
			// 若 lock 是 stale（pid 不存在），允許繼續（不 throw）
			const pid = raw.pid;
			if (pid) {
				try {
					process.kill(pid, 0); // 測試 pid 是否存活（不發送信號）
					throw new LockedError(owner, since);
				} catch (e) {
					if (e instanceof LockedError) throw e;
					// ESRCH = pid 不存在 → stale lock，忽略
				}
			} else {
				throw new LockedError(owner, since);
			}
		} catch (e) {
			if (e instanceof LockedError) throw e;
			// parse 失敗 → 保守起見仍 throw
			throw new LockedError(owner, since);
		}
	}

	// 2. Console 自身的互斥鎖
	if (existsSync(consoleLockPath)) {
		const _owner = "console";
		let since = null;
		try {
			const raw = JSON.parse(readFileSync(consoleLockPath, "utf8"));
			const pid = raw.pid;
			since = raw.since ?? null;
			if (pid) {
				try {
					process.kill(pid, 0);
					throw new LockedError("console_concurrent", since);
				} catch (e) {
					if (e instanceof LockedError) throw e;
					// stale lock → 清理
					unlinkSync(consoleLockPath);
				}
			}
		} catch (e) {
			if (e instanceof LockedError) throw e;
			unlinkSync(consoleLockPath);
		}
	}

	// 3. 取得鎖
	const lockData = JSON.stringify({
		owner: "console",
		pid: process.pid,
		since: new Date().toISOString(),
	});
	writeFileSync(consoleLockPath, lockData, "utf8");

	try {
		return await fn();
	} finally {
		try {
			unlinkSync(consoleLockPath);
		} catch {
			/* 已被清理 */
		}
	}
}
