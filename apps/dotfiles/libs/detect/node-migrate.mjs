/**
 * Node 版本管理遷移 — nvm/n → fnm 完整遷移流程
 *
 * 職責：版本發現、shell 設定檔清理、目錄移除、卸載、fnm 環境啟用
 */

import { execFileSync, execSync } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { HOME } from "../core/paths.mjs";
import { has, run, ver } from "./shell-utils.mjs";

// ── 版本發現 ──────────────────────────────

/** semver 排序比較器 */
function semverCompare(a, b) {
	const [a1, a2, a3] = a.split(".").map(Number);
	const [b1, b2, b3] = b.split(".").map(Number);
	return a1 - b1 || a2 - b2 || (a3 || 0) - (b3 || 0);
}

/** 列出 nvm 已安裝的 Node 版本 */
export function discoverNvmVersions() {
	const nvmDir = process.env.NVM_DIR || `${HOME}/.nvm`;
	const versionsDir = `${nvmDir}/versions/node`;
	try {
		if (!existsSync(versionsDir)) return [];
		return readdirSync(versionsDir)
			.filter((e) => e.startsWith("v"))
			.map((e) => e.slice(1))
			.sort(semverCompare);
	} catch {
		return [];
	}
}

/** 取得 nvm 的 default 版本（解析 alias） */
function discoverNvmDefault() {
	const nvmDir = process.env.NVM_DIR || `${HOME}/.nvm`;
	try {
		const output = execFileSync(
			"bash",
			["-c", `source "${nvmDir}/nvm.sh" 2>/dev/null && nvm version default`],
			{ encoding: "utf8", stdio: "pipe", timeout: 5000 },
		).trim();
		if (output !== "N/A" && output.startsWith("v")) return output.slice(1);
	} catch {}
	try {
		const alias = readFileSync(`${nvmDir}/alias/default`, "utf8").trim();
		if (/^\d/.test(alias)) return alias;
	} catch {}
	return null;
}

/** 列出 n 已安裝的 Node 版本 */
export function discoverNVersions() {
	const nPrefix = process.env.N_PREFIX || "/usr/local";
	const versionsDir = `${nPrefix}/n/versions/node`;
	try {
		if (!existsSync(versionsDir)) return [];
		return readdirSync(versionsDir)
			.filter((e) => /^\d/.test(e))
			.sort(semverCompare);
	} catch {
		return [];
	}
}

// ── 遷移清理 ──────────────────────────────

/** 靜默執行 fnm 命令（遷移批量安裝時不輸出到 stdout） */
function runFnmQuiet(fnmCmd) {
	try {
		const args = fnmCmd.split(/\s+/);
		execFileSync("fnm", args, { stdio: "pipe", timeout: 120000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * 註解所有 shell 設定檔中的 nvm/n 相關行
 *
 * 策略：標題註解替換為遷移說明；程式碼行前加 #。
 * 涵蓋：.zshrc · .zprofile · .bashrc · .bash_profile · .profile
 */
function commentOutManagerInShellConfigs(manager) {
	const shellConfigs = [
		`${HOME}/.zshrc`,
		`${HOME}/.zprofile`,
		`${HOME}/.bashrc`,
		`${HOME}/.bash_profile`,
		`${HOME}/.profile`,
	];
	const codePatterns =
		manager === "nvm"
			? [/nvm\.sh/, /NVM_DIR/, /nvm.*bash_completion/]
			: [/N_PREFIX/];
	const headerRe = manager === "nvm" ? /^#\s*nvm[\s（(]/ : /^#\s*n[\s（(]/;
	const migrationNote =
		manager === "nvm"
			? "# nvm（node 版本管理, 已由 ab-tao 遷移至 fnm 統一管理）"
			: "# n（node 版本管理, 已由 ab-tao 遷移至 fnm 統一管理）";

	const modified = [];
	for (const filePath of shellConfigs) {
		try {
			if (!existsSync(filePath)) continue;
			const content = readFileSync(filePath, "utf8");
			const lines = content.split("\n");
			let changed = false;
			const result = lines.map((line) => {
				if (line.trimStart().startsWith("#")) {
					if (headerRe.test(line.trimStart()) && line !== migrationNote) {
						changed = true;
						return migrationNote;
					}
					return line;
				}
				if (codePatterns.some((pat) => pat.test(line))) {
					changed = true;
					return `# ${line}`;
				}
				return line;
			});
			if (changed) {
				writeFileSync(filePath, result.join("\n"));
				modified.push(filePath.replace(HOME, "~"));
			}
		} catch {
			/* 權限不足等，略過 */
		}
	}
	return modified;
}

/** 收集 nvm 所有可能的安裝目錄（curl / git / Homebrew / XDG） */
function collectNvmDirs() {
	const dirs = new Set();
	const nvmDir = process.env.NVM_DIR || `${HOME}/.nvm`;
	dirs.add(nvmDir);
	dirs.add(`${HOME}/.nvm`);
	const xdg = process.env.XDG_CONFIG_HOME || `${HOME}/.config`;
	if (existsSync(`${xdg}/nvm`)) dirs.add(`${xdg}/nvm`);
	for (const prefix of ["/opt/homebrew", "/usr/local"]) {
		const brewOpt = `${prefix}/opt/nvm`;
		if (existsSync(brewOpt)) dirs.add(brewOpt);
	}
	return [...dirs];
}

/** 收集 n 所有可能的安裝目錄（npm / Homebrew / n-install） */
function collectNDirs() {
	const dirs = new Set();
	if (existsSync(`${HOME}/.n`)) dirs.add(`${HOME}/.n`);
	const nPrefix = process.env.N_PREFIX;
	if (nPrefix && existsSync(`${nPrefix}/n`)) dirs.add(`${nPrefix}/n`);
	if (existsSync("/usr/local/n")) dirs.add("/usr/local/n");
	return [...dirs];
}

/** 卸載 nvm/n — 涵蓋所有安裝方式 */
function uninstallManager(manager) {
	const cleaned = [];

	if (manager === "nvm") {
		try {
			execSync("brew list nvm", { stdio: "pipe" });
			run("brew uninstall nvm");
			cleaned.push("brew");
		} catch {
			/* 非 brew 安裝 */
		}
		delete process.env.NVM_DIR;
	} else {
		const nUninstall = `${process.env.N_PREFIX || `${HOME}/.n`}/bin/n-uninstall`;
		if (existsSync(nUninstall)) {
			try {
				execSync(`echo y | "${nUninstall}"`, {
					stdio: "pipe",
					shell: true,
					timeout: 30000,
				});
				cleaned.push("n-uninstall");
			} catch {}
		}
		try {
			execSync("brew list n", { stdio: "pipe" });
			run("brew uninstall n");
			cleaned.push("brew");
		} catch {}
		try {
			execSync("npm list -g n", { stdio: "pipe" });
			run("npm uninstall -g n");
			cleaned.push("npm");
		} catch {}
		for (const bin of ["/usr/local/bin/n", `${HOME}/.n/bin/n`]) {
			if (existsSync(bin)) {
				try {
					rmSync(bin, { force: true });
					cleaned.push(bin.replace(HOME, "~"));
				} catch {}
			}
		}
		delete process.env.N_PREFIX;
	}

	if (cleaned.length > 0) {
		p.log.info(pc.dim(`已卸載 ${manager}（${cleaned.join("、")}）`));
	}
}

/** 將 fnm 環境注入當前 process.env（讓後續步驟能找到 node） */
function activateFnmInProcess() {
	try {
		const output = execSync("fnm env --shell bash", {
			encoding: "utf8",
			stdio: "pipe",
			timeout: 5000,
		});
		for (const line of output.split("\n")) {
			const match = line.match(/^export (\w+)="(.*)"/);
			if (match) process.env[match[1]] = match[2];
		}
	} catch {}
}

// ── 完整遷移 ──────────────────────────────

/**
 * 完整遷移 nvm/n → fnm
 *
 * 流程：發現版本 → 安裝 fnm → 遷移版本 → 設定預設 → 註解設定檔 → 移除目錄 → 卸載 → 啟用
 *
 * @param {string} existing - "nvm" | "n"
 * @returns {Promise<boolean>} 遷移成功返回 true
 */
export async function migrateToFnm(existing) {
	const isNvm = existing === "nvm";

	// ① 發現已安裝的版本與預設
	const versions = isNvm ? discoverNvmVersions() : discoverNVersions();
	const defaultVer = isNvm
		? discoverNvmDefault()
		: ver("node")?.match(/[\d.]+/)?.[0];

	if (versions.length > 0) {
		p.log.info(
			`📋 發現 ${versions.length} 個 Node 版本${defaultVer ? `（預設：${defaultVer}）` : ""}\n   ${versions.map((v) => `v${v}`).join(" · ")}`,
		);
	}

	// ② 安裝 fnm（已安裝則跳過）
	if (has("fnm")) {
		p.log.info(pc.dim("fnm 已安裝，跳過安裝步驟"));
	} else {
		const s = p.spinner();
		s.start("📦 安裝 fnm...");
		const fnmOk = has("brew") && run("brew install fnm");
		if (!fnmOk) {
			s.stop(`${pc.yellow("⚠")} fnm 安裝失敗，繼續使用 ${existing}`);
			return false;
		}
		s.stop(`${pc.green("✔")} fnm 安裝完成`);
	}

	// ③ 遷移全部版本（逐個顯示 spinner）
	if (versions.length > 0) {
		let migrated = 0;
		const s3 = p.spinner();
		for (let i = 0; i < versions.length; i++) {
			const v = versions[i];
			s3.start(`🔄 遷移版本（${i + 1}/${versions.length}）v${v}...`);
			if (runFnmQuiet(`install ${v}`)) {
				migrated++;
				s3.stop(`${pc.green("✔")} v${v}`);
			} else {
				s3.stop(`${pc.yellow("⚠")} v${v}（失敗）`);
			}
		}
		p.log.info(pc.dim(`遷移完成：${migrated}/${versions.length} 個版本`));

		// ④ 設定預設
		const target = defaultVer || versions[versions.length - 1];
		if (target) {
			const sd = p.spinner();
			sd.start(`設定預設版本 v${target}...`);
			if (runFnmQuiet(`default ${target}`)) {
				sd.stop(`${pc.green("✔")} 預設版本：v${target}`);
			} else {
				sd.stop(`${pc.yellow("⚠")} 設定預設失敗`);
			}
		}
	} else {
		const sl = p.spinner();
		sl.start("安裝 Node LTS...");
		runFnmQuiet("install --lts");
		runFnmQuiet("default lts-latest");
		sl.stop(`${pc.green("✔")} 已安裝 Node LTS`);
	}

	// ⑤ 註解所有 shell 設定檔
	const modified = commentOutManagerInShellConfigs(existing);
	if (modified.length > 0) {
		p.log.info(pc.dim(`已註解 ${existing} 設定：${modified.join("、")}`));
	}

	// ⑥ 移除目錄
	const dirsToRemove = isNvm ? collectNvmDirs() : collectNDirs();
	for (const dir of dirsToRemove) {
		if (!existsSync(dir)) continue;
		const s2 = p.spinner();
		const label = dir.replace(HOME, "~");
		s2.start(`🗑️  移除 ${label}...`);
		try {
			rmSync(dir, { recursive: true, force: true });
			s2.stop(`${pc.green("✔")} 已移除 ${label}`);
		} catch (e) {
			s2.stop(`${pc.yellow("⚠")} 移除失敗：${e.message}`);
		}
	}

	// ⑦ 卸載
	uninstallManager(existing);

	// ⑧ 更新當前 process 的 PATH
	activateFnmInProcess();

	return true;
}
