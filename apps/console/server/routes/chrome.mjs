/**
 * chrome.mjs — /api/chrome/* 路由
 *
 * Chrome 安裝狀態檢查、flags 套用、ZSH 模組部署狀態。
 * 僅限 localhost 開發工具使用，不需認證。
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();

/** Chrome 相關路徑 */
const CHROME_APP = "/Applications/Google Chrome.app";
const LOCAL_STATE_PATH = path.join(
	HOME,
	"Library/Application Support/Google/Chrome/Local State",
);
const ZSH_CONF_DIR = path.join(HOME, ".zshrc.d/conf");
const ZSH_CHROME_FILE = path.join(ZSH_CONF_DIR, "35-chrome.zsh");

/** flags.json 來源路徑（相對 routes/ → dotfiles/chrome/config/） */
const FLAGS_JSON = path.resolve(
	__dirname,
	"../../../dotfiles/chrome/config/flags.json",
);

/** 讀取 Local State JSON（容錯） */
async function readLocalState() {
	try {
		const raw = await readFile(LOCAL_STATE_PATH, "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

/** 備份 Local State */
async function backupLocalState() {
	if (!fs.existsSync(LOCAL_STATE_PATH)) return;
	const stamp = new Date()
		.toISOString()
		.slice(0, 16)
		.replace("T", "-")
		.replace(":", "-");
	const backupPath = `${LOCAL_STATE_PATH}.backup-${stamp}`;
	await copyFile(LOCAL_STATE_PATH, backupPath);
}

/** 檢查 Chrome 是否在執行（使用 execFileSync 避免 shell 注入） */
function isChromeRunning() {
	try {
		execFileSync("pgrep", ["-x", "Google Chrome"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

export async function chromeRouter(req, res, url, json) {
	// ── GET /api/chrome/status ──
	if (req.method === "GET" && url.pathname === "/api/chrome/status") {
		const installed = fs.existsSync(CHROME_APP);
		const localStateExists = fs.existsSync(LOCAL_STATE_PATH);
		let experiments = [];

		if (localStateExists) {
			const state = await readLocalState();
			experiments = state?.browser?.enabled_labs_experiments ?? [];
		}

		json(res, 0, "ok", { installed, localStateExists, experiments });
		return true;
	}

	// ── POST /api/chrome/apply-flags ──
	if (req.method === "POST" && url.pathname === "/api/chrome/apply-flags") {
		// 檢查 Chrome 是否在執行
		if (isChromeRunning()) {
			json(res, 400, "請先關閉 Chrome 後再套用 flags", { running: true }, 400);
			return true;
		}

		// 讀取 flags.json
		let flagsConfig;
		try {
			const raw = await readFile(FLAGS_JSON, "utf8");
			flagsConfig = JSON.parse(raw);
		} catch (e) {
			json(res, 500, `讀取 flags.json 失敗：${e.message}`, null, 500);
			return true;
		}

		const experiments = flagsConfig.experiments ?? [];
		if (experiments.length === 0) {
			json(res, 400, "flags.json 中沒有 experiments", null, 400);
			return true;
		}

		// 備份 Local State
		await backupLocalState();

		// 讀取或初始化 Local State
		const state = (await readLocalState()) ?? {};
		if (!state.browser) state.browser = {};

		// 合併 experiments（去重）
		const existing = new Set(state.browser.enabled_labs_experiments ?? []);
		for (const exp of experiments) {
			existing.add(exp);
		}
		state.browser.enabled_labs_experiments = [...existing];

		// 寫回 Local State
		try {
			await writeFile(
				LOCAL_STATE_PATH,
				JSON.stringify(state, null, "\t"),
				"utf8",
			);
		} catch (e) {
			json(res, 500, `寫入 Local State 失敗：${e.message}`, null, 500);
			return true;
		}

		json(res, 0, `已套用 ${experiments.length} 個 flags`, {
			applied: experiments,
			total: state.browser.enabled_labs_experiments.length,
		});
		return true;
	}

	// ── GET /api/chrome/zsh-status ──
	if (req.method === "GET" && url.pathname === "/api/chrome/zsh-status") {
		const deployed = fs.existsSync(ZSH_CHROME_FILE);
		json(res, 0, "ok", {
			deployed,
			path: ZSH_CHROME_FILE,
			confDir: ZSH_CONF_DIR,
		});
		return true;
	}

	return false;
}
