// install-fallback.mjs — Plugin install 降級狀態管理（ADR fallback policy）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FALLBACK_FILE = path.join(
	os.homedir(),
	".claude",
	".ab-tao",
	"runtime",
	"install-fallback.json",
);

export function markFallback(sourceId, reason) {
	let data = {};
	try {
		data = JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf8"));
	} catch {}
	data[sourceId] = {
		fallbackAt: new Date().toISOString(),
		reason,
		mode: "copy",
	};
	fs.mkdirSync(path.dirname(FALLBACK_FILE), { recursive: true });
	fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2));
}

export function getFallbackSources() {
	try {
		return JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf8"));
	} catch {
		return {};
	}
}

export function isFallback(sourceId) {
	return Boolean(getFallbackSources()[sourceId]);
}
