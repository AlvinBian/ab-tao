#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const SOURCES = [
	{
		ns: "d",
		label: "dotfiles（互動式，需 TTY）",
		path: "apps/dotfiles/commands.mjs",
		color: "\x1b[33m",
	},
	{
		ns: "c",
		label: "commons（AI 資源，4 個來源）",
		path: "packages/commons/commands.mjs",
		color: "\x1b[32m",
	},
];

console.log(`
${BOLD} ab-tao 指令總覽${RESET}  ${DIM}d = dotfiles · c = commons${RESET}

\x1b[36m── 全局 ───────────────────────────────────────────${RESET}
  pnpm run build            構建所有套件
  pnpm run test             執行測試
  pnpm run lint             Biome lint
  pnpm run format           格式化
  pnpm run clean            清理快取與 node_modules`);

for (const { ns, label, path: modPath, color } of SOURCES) {
	console.log(
		`\n${color}── ${ns}: ${label} ──────────────────────────────${RESET}`,
	);
	try {
		const mod = await import(path.join(ROOT, modPath));
		for (const [cmd, desc] of Object.entries(mod.commands || {})) {
			console.log(`  pnpm run ${ns}:${cmd.padEnd(16)} ${desc}`);
		}
		for (const [key, val] of Object.entries(mod.aliases || {})) {
			console.log(`  pnpm run ${ns}:${key.padEnd(16)} ${val.desc}`);
		}
	} catch {
		console.log(`  ${DIM}（無 commands.mjs）${RESET}`);
	}
}

console.log(`
  指定同步: pnpm run c:sync -- --pick ecc,superpowers

\x1b[35m── 版本與發布 ──────────────────────────────────────${RESET}
  pnpm run changeset        建立變更記錄
  pnpm run version          更新版本號
  pnpm run release          構建 + 發布
`);
