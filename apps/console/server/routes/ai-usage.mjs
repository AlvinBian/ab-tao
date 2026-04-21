/**
 * ai-usage.mjs — /api/status/ai-usage 路由
 *
 * 讀取 ~/.claude/.ab-tao/metrics.jsonl，aggregate 並回傳 AI 使用統計。
 * 支援 range 參數：24h | 7d | 30d（預設 7d）
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOTFILES_LIB = path.resolve(__dirname, "../../../dotfiles/libs");

const METRICS_MAX_LINES = 50_000;
const METRICS_WARN_BYTES = 10 * 1024 * 1024; // 10MB

async function getP() {
	const { P } = await import(path.join(DOTFILES_LIB, "core/paths.mjs"));
	return P;
}

function rangeMs(range) {
	const map = { "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
	return map[range] ?? map["7d"];
}

/**
 * 尾部讀取 JSONL 檔（最後 maxLines 行）並解析
 * @returns {{ lines: object[], parseErrors: number, tailed: boolean }}
 */
async function tailJsonl(filePath, maxLines) {
	let parseErrors = 0;
	const rl = createInterface({
		input: createReadStream(filePath, { encoding: "utf8" }),
		crlfDelay: Infinity,
	});
	const allLines = [];
	for await (const line of rl) {
		if (line.trim()) allLines.push(line);
	}
	const totalLines = allLines.length;
	const slice = allLines.slice(-maxLines);
	const tailed = totalLines > maxLines;
	const lines = [];
	for (const line of slice) {
		try {
			lines.push(JSON.parse(line));
		} catch {
			parseErrors++;
		}
	}
	return { lines, parseErrors, tailed, totalLines };
}

export async function aiUsageRouter(req, res, url, json) {
	if (req.method !== "GET" || url.pathname !== "/api/status/ai-usage")
		return false;

	const range = url.searchParams.get("range") ?? "7d";
	const cutoff = Date.now() - rangeMs(range);

	let P;
	try {
		P = await getP();
	} catch {
		json(res, 500, "無法載入路徑配置", null, 500);
		return true;
	}

	const metricsPath = path.join(P.abTaoDir, "metrics.jsonl");

	// 檔案不存在 → 200 + source: absent
	if (!existsSync(metricsPath)) {
		json(res, 0, "ok", {
			byModel: [],
			byTool: [],
			byDay: [],
			meta: {
				source: "absent",
				parseErrors: 0,
				totalLines: 0,
				tailed: false,
				range,
			},
		});
		return true;
	}

	// IO 統計
	let fileSize = 0;
	try {
		fileSize = statSync(metricsPath).size;
	} catch (e) {
		json(
			res,
			500,
			"metrics.jsonl 讀取失敗",
			{ code: "METRICS_READ_FAILED", cause: e.message },
			500,
		);
		return true;
	}

	const sizeWarn = fileSize > METRICS_WARN_BYTES;

	let parsed, parseErrors, tailed, totalLines;
	try {
		({
			lines: parsed,
			parseErrors,
			tailed,
			totalLines,
		} = await tailJsonl(metricsPath, METRICS_MAX_LINES));
	} catch (e) {
		json(
			res,
			500,
			"metrics.jsonl 讀取失敗",
			{ code: "METRICS_READ_FAILED", cause: e.message },
			500,
		);
		return true;
	}

	// filter by time range
	const inRange = parsed.filter((r) => {
		if (!r.ts) return false;
		return new Date(r.ts).getTime() >= cutoff;
	});

	// aggregate by model / tool / day
	const modelMap = {};
	const toolMap = {};
	const dayMap = {};

	for (const r of inRange) {
		const day = r.ts?.slice(0, 10) ?? "unknown";
		dayMap[day] = (dayMap[day] ?? 0) + 1;

		if (r.event === "model_request" && r.model) {
			if (!modelMap[r.model]) {
				modelMap[r.model] = {
					model: r.model,
					requests: 0,
					inputTokens: 0,
					outputTokens: 0,
					cacheReadTokens: 0,
				};
			}
			modelMap[r.model].requests++;
			modelMap[r.model].inputTokens += r.inputTokens ?? 0;
			modelMap[r.model].outputTokens += r.outputTokens ?? 0;
			modelMap[r.model].cacheReadTokens += r.cacheReadTokens ?? 0;
		}

		if (r.event === "tool_use" && r.toolName) {
			if (!toolMap[r.toolName]) {
				toolMap[r.toolName] = {
					toolName: r.toolName,
					calls: 0,
					errors: 0,
					totalMs: 0,
				};
			}
			toolMap[r.toolName].calls++;
			if (!r.ok) toolMap[r.toolName].errors++;
			toolMap[r.toolName].totalMs += r.durationMs ?? 0;
		}
	}

	const source = parseErrors > 0 && inRange.length === 0 ? "partial" : "ok";

	json(res, 0, "ok", {
		byModel: Object.values(modelMap),
		byTool: Object.values(toolMap),
		byDay: Object.entries(dayMap)
			.map(([day, count]) => ({ day, count }))
			.sort((a, b) => a.day.localeCompare(b.day)),
		meta: { source, parseErrors, totalLines, tailed, sizeWarn, range },
	});
	return true;
}
