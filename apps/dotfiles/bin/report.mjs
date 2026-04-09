#!/usr/bin/env node

/**
 * 打開上次 setup 部署後的 HTML 報告
 *
 * 報告由 phase-complete.mjs 生成，儲存於 dist/report.html
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const reportPath = path.join(REPO, "dist", "report.html");

if (!fs.existsSync(reportPath)) {
	console.error("⚠️ 找不到上次報告，請先執行 pnpm run d:setup");
	process.exit(1);
}

const { openInBrowser } = await import("../lib/report.mjs");
await openInBrowser(reportPath);
