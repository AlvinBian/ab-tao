import fs from "node:fs";
import path from "node:path";
import { P } from "../core/paths.mjs";

const MANUAL_START = "<!-- manual:start -->";
const MANUAL_END = "<!-- manual:end -->";
const AUTO_START = "<!-- auto:start -->";
const AUTO_END = "<!-- auto:end -->";

function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;
	const result = {};
	for (const line of match[1].split("\n")) {
		const m = line.match(/^(\w+):\s*(.+)$/);
		if (m) result[m[1]] = m[2].trim();
	}
	return Object.keys(result).length > 0 ? result : null;
}

function parseMarkdownFallback(content) {
	const name = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
	const lines = content.split("\n");
	let desc = null;
	let pastH1 = false;
	for (const line of lines) {
		if (/^#\s/.test(line)) {
			pastH1 = true;
			continue;
		}
		if (pastH1 && line.trim() && !line.startsWith("#")) {
			desc = line.trim();
			break;
		}
	}
	return { name, description: desc };
}

function parseEntryMeta(entryPath) {
	let stat;
	try {
		stat = fs.statSync(entryPath);
	} catch {
		return null;
	}

	if (stat.isDirectory()) {
		const indexPath = path.join(entryPath, "index.md");
		if (!fs.existsSync(indexPath)) return null;
		const content = fs.readFileSync(indexPath, "utf8");
		const fm = parseFrontmatter(content);
		if (fm?.name) return { name: fm.name, description: fm.description ?? "" };
		const fallback = parseMarkdownFallback(content);
		return fallback.name ? fallback : null;
	}

	if (!entryPath.endsWith(".md")) return null;
	const content = fs.readFileSync(entryPath, "utf8");
	const fm = parseFrontmatter(content);
	if (fm?.name) return { name: fm.name, description: fm.description ?? "" };
	const fallback = parseMarkdownFallback(content);
	return fallback.name ? fallback : null;
}

function scanMemoryDir(memDir) {
	if (!fs.existsSync(memDir)) return [];
	const entries = [];
	for (const dirent of fs.readdirSync(memDir, { withFileTypes: true })) {
		if (dirent.name === "MEMORY.md" || dirent.name === "archive") continue;
		const fullPath = path.join(memDir, dirent.name);
		let stat;
		try {
			stat = fs.statSync(fullPath);
		} catch {
			continue;
		}
		const meta = parseEntryMeta(fullPath);
		if (!meta) continue;
		const relRef = dirent.isDirectory()
			? `${dirent.name}/index.md`
			: dirent.name;
		entries.push({
			name: meta.name,
			description: meta.description ?? "",
			relRef,
			mtime: stat.mtimeMs,
		});
	}
	return entries.sort((a, b) => b.mtime - a.mtime);
}

function buildAutoSection(entries) {
	const lines = [AUTO_START];
	for (const e of entries.slice(0, 15)) {
		const desc = e.description ? ` — ${e.description}` : "";
		lines.push(`- [${e.name}](${e.relRef})${desc}`.slice(0, 150));
	}
	lines.push(AUTO_END);
	return lines.join("\n");
}

export function updateMemoryIndex(projectEncoded) {
	const memDir = path.join(P.projects, projectEncoded, "memory");
	const memoryMdPath = path.join(memDir, "MEMORY.md");
	const entries = scanMemoryDir(memDir);
	const autoSection = buildAutoSection(entries);

	if (!fs.existsSync(memoryMdPath)) {
		fs.mkdirSync(memDir, { recursive: true });
		fs.writeFileSync(
			memoryMdPath,
			`${MANUAL_START}\n\n${MANUAL_END}\n\n${autoSection}\n`,
			"utf8",
		);
		return;
	}

	const existing = fs.readFileSync(memoryMdPath, "utf8");

	// 首次執行：無 manual markers → 包裹現有內容
	if (!existing.includes(MANUAL_START)) {
		const wrapped = `${MANUAL_START}\n${existing.trim()}\n${MANUAL_END}\n\n${autoSection}\n`;
		fs.writeFileSync(memoryMdPath, wrapped, "utf8");
		return;
	}

	// 有 markers：保留 manual section，重建 auto section
	const manualMatch = existing.match(
		new RegExp(
			`${escapeRegex(MANUAL_START)}[\\s\\S]*?${escapeRegex(MANUAL_END)}`,
		),
	);
	const manualSection = manualMatch
		? manualMatch[0]
		: `${MANUAL_START}\n\n${MANUAL_END}`;

	let result;
	if (existing.includes(AUTO_START)) {
		result = existing.replace(
			new RegExp(
				`${escapeRegex(AUTO_START)}[\\s\\S]*?${escapeRegex(AUTO_END)}`,
			),
			autoSection,
		);
	} else {
		result = `${manualSection}\n\n${autoSection}\n`;
	}
	fs.writeFileSync(memoryMdPath, result, "utf8");
}

export function doctorMemoryIndex(projectEncoded) {
	const memDir = path.join(P.projects, projectEncoded, "memory");
	if (!fs.existsSync(memDir)) {
		process.stderr.write(`[doctor] memory 目錄不存在：${memDir}\n`);
		return;
	}
	for (const dirent of fs.readdirSync(memDir, { withFileTypes: true })) {
		if (dirent.name === "MEMORY.md" || dirent.name === "archive") continue;
		const fullPath = path.join(memDir, dirent.name);
		if (!parseEntryMeta(fullPath)) {
			process.stderr.write(`[doctor] 缺少 frontmatter 或 H1：${dirent.name}\n`);
		}
	}
	const memoryMdPath = path.join(memDir, "MEMORY.md");
	if (!fs.existsSync(memoryMdPath)) {
		process.stderr.write("[doctor] MEMORY.md 不存在\n");
		return;
	}
	const content = fs.readFileSync(memoryMdPath, "utf8");
	if (!content.includes(MANUAL_START)) {
		process.stderr.write(
			"[doctor] MEMORY.md 缺少 manual markers → 建議執行 update 初始化\n",
		);
	}
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
	const [cmd, arg] = process.argv.slice(2);
	if (!cmd || !arg) {
		process.stderr.write(
			"用法：node memory-index.mjs <update|doctor> <filePath|projectEncoded>\n",
		);
		process.exit(1);
	}

	let projectEncoded = arg;
	// 若 arg 是絕對路徑，從中提取 projectEncoded
	if (arg.startsWith("/")) {
		const projectsBase = P.projects;
		if (arg.startsWith(projectsBase + "/")) {
			projectEncoded = arg.slice(projectsBase.length + 1).split("/")[0];
		} else {
			process.exit(0); // 非 memory 檔案，靜默退出
		}
	}

	if (cmd === "update") updateMemoryIndex(projectEncoded);
	else if (cmd === "doctor") doctorMemoryIndex(projectEncoded);
	else {
		process.stderr.write(`未知命令：${cmd}\n`);
		process.exit(1);
	}
}
