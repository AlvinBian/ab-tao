#!/usr/bin/env node
/**
 * memory-federated.mjs — Federated Memory 管理 CLI
 *
 * 子命令：
 *   --list                              列出已註冊的跨專案 memory
 *   --register-federated <project-path> 註冊新的跨專案 memory
 *   --federate <memory-entry-title>     將當前專案的 memory entry 加入聯邦索引
 */

import fs from "node:fs";
import path from "node:path";
import { P } from "../libs/core/paths.mjs";

// federated 資料夾根路徑
const FEDERATED_DIR = path.join(P.abTao.memory, "federated");
const PROJECTS_JSON = path.join(FEDERATED_DIR, "projects.json");
const FEDERATED_INDEX = path.join(FEDERATED_DIR, "index.md");

/** 確保目錄存在 */
function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

/** 讀取 projects.json，不存在時回傳空陣列 */
function readProjects() {
	if (!fs.existsSync(PROJECTS_JSON)) {
		return [];
	}
	try {
		const raw = fs.readFileSync(PROJECTS_JSON, "utf-8");
		return JSON.parse(raw);
	} catch {
		console.error(`[memory-federated] 讀取 projects.json 失敗，回傳空陣列`);
		return [];
	}
}

/** 寫入 projects.json */
function writeProjects(projects) {
	ensureDir(FEDERATED_DIR);
	fs.writeFileSync(PROJECTS_JSON, JSON.stringify(projects, null, 2), "utf-8");
}

/** --list：列出已註冊的跨專案 memory */
function cmdList() {
	const projects = readProjects();
	if (projects.length === 0) {
		console.log("尚無 federated 專案，使用 --register-federated <path> 新增");
		return;
	}
	console.log(`已註冊 ${projects.length} 個 federated 專案：\n`);
	for (const proj of projects) {
		console.log(`  專案名稱：${proj.projectName}`);
		console.log(`  Memory 路徑：${proj.memoryPath}`);
		console.log(`  註冊時間：${proj.registeredAt}`);
		console.log("");
	}
}

/** --register-federated <project-path>：註冊新專案 */
function cmdRegister(projectPath) {
	if (!projectPath) {
		console.error("[memory-federated] 請提供 project-path 參數");
		process.exit(1);
	}

	const absProjectPath = path.resolve(projectPath);
	const projectName = path.basename(absProjectPath);
	const memoryPath = path.join(absProjectPath, "memory", "MEMORY.md");

	// 確認 MEMORY.md 存在才允許註冊
	if (!fs.existsSync(memoryPath)) {
		console.error(
			`[memory-federated] 找不到 ${memoryPath}，請確認路徑正確且 MEMORY.md 存在後再註冊`,
		);
		process.exit(1);
	}

	const projects = readProjects();

	// 已存在則更新，否則新增
	const existing = projects.findIndex((p) => p.projectName === projectName);
	const entry = {
		projectName,
		memoryPath,
		registeredAt: new Date().toISOString(),
	};

	if (existing >= 0) {
		projects[existing] = entry;
		console.log(`[memory-federated] 已更新：${projectName}`);
	} else {
		projects.push(entry);
		console.log(`[memory-federated] 已註冊：${projectName}`);
	}

	writeProjects(projects);
	console.log(`  memoryPath：${memoryPath}`);
	console.log(`  projects.json：${PROJECTS_JSON}`);
}

/** --federate <title>：將 memory entry 加入聯邦索引 */
function cmdFederate(title) {
	if (!title) {
		console.error("[memory-federated] 請提供 memory-entry-title 參數");
		process.exit(1);
	}

	// 取得當前專案名稱（以 cwd basename 為準）
	const currentProjectName = path.basename(process.cwd());
	const absPath = process.cwd();

	ensureDir(FEDERATED_DIR);

	// 初始化 index.md（首次時寫入標頭）
	if (!fs.existsSync(FEDERATED_INDEX)) {
		fs.writeFileSync(FEDERATED_INDEX, "# Federated Memory Index\n\n", "utf-8");
	}

	const line = `- [${title}](${currentProjectName}/MEMORY.md) — federated from ${absPath}\n`;
	fs.appendFileSync(FEDERATED_INDEX, line, "utf-8");

	console.log(`[memory-federated] 已加入聯邦索引：${title}`);
	console.log(`  index.md：${FEDERATED_INDEX}`);
}

/** 主入口：解析 CLI 引數 */
function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--list") {
		cmdList();
		return;
	}

	if (args[0] === "--register-federated") {
		cmdRegister(args[1]);
		return;
	}

	if (args[0] === "--federate") {
		// 支援多詞標題（將後續引數合併）
		const title = args.slice(1).join(" ");
		cmdFederate(title);
		return;
	}

	console.error(`[memory-federated] 不支援的子命令：${args[0]}`);
	console.error("用法：");
	console.error(
		"  --list                              列出已註冊的 federated 專案",
	);
	console.error("  --register-federated <project-path> 註冊新專案");
	console.error("  --federate <memory-entry-title>     加入聯邦索引");
	process.exit(1);
}

main();
