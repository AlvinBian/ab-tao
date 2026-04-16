#!/usr/bin/env node

/**
 * d:report — 即時生成統一 HTML Dashboard 並開啟瀏覽器
 */

import path from "node:path";
import * as p from "@clack/prompts";
import { getDirname } from "../libs/core/paths.mjs";

const __dirname = getDirname(import.meta);
const REPO = path.resolve(__dirname, "..");

async function main() {
	p.intro(" d:report ");
	const s = p.spinner();
	s.start("收集配置狀態...");

	const { collectUnifiedReportData } = await import(
		"../libs/core/usage-scanner.mjs"
	);
	const { saveAndOpenReport } = await import(
		"../libs/report/unified-renderer.mjs"
	);

	let data;
	try {
		data = await collectUnifiedReportData();
		s.stop("資料收集完成");
	} catch (err) {
		s.stop("收集失敗");
		p.log.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}

	const outputPath = path.join(REPO, "dist", "report.html");
	try {
		await saveAndOpenReport(data, outputPath);
		p.log.success(`報告已開啟：${outputPath}`);
	} catch (err) {
		p.log.error(
			`生成報告失敗：${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}
	p.outro("完成");
}

main().catch((e) => {
	console.error(e.message);
	process.exit(1);
});
