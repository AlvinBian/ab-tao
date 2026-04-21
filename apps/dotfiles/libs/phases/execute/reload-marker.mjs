import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HOME, P } from "../../core/paths.mjs";

const MARKER_PATH = path.join(P.abTaoDir, "reload-required.json");
const TARGETS = [
	{
		key: "settings",
		path: path.join(HOME, ".claude", "settings.json"),
		label: "settings.json（hooks / permissions / mcpServers / statusLine）",
	},
	{
		key: "claudeMd",
		path: path.join(HOME, ".claude", "CLAUDE.md"),
		label: "CLAUDE.md 全域規則",
	},
	{
		key: "agents",
		path: path.join(HOME, ".claude", "agents"),
		label: "agents 定義",
		isDir: true,
	},
	{
		key: "commands",
		path: path.join(HOME, ".claude", "commands"),
		label: "slash commands",
		isDir: true,
	},
	{
		key: "skills",
		path: path.join(HOME, ".claude", "skills"),
		label: "skills",
		isDir: true,
	},
];

export function writeReloadMarker(ctx = {}) {
	try {
		const changed = [];
		for (const t of TARGETS) {
			const curHash = hashTarget(t);
			const preHash = ctx.preHashes?.[t.key];
			if (preHash && curHash && preHash !== curHash) changed.push(t.label);
		}
		if (changed.length === 0) return;

		fs.mkdirSync(path.dirname(MARKER_PATH), { recursive: true });
		fs.writeFileSync(
			MARKER_PATH,
			JSON.stringify(
				{
					ts: new Date().toISOString(),
					changed,
					source: "ab-tao d:setup",
				},
				null,
				2,
			),
		);
	} catch {
		// marker 失敗不阻塞 d:setup（hint 非關鍵路徑）
	}
}

export function snapshotHashes() {
	const result = {};
	for (const t of TARGETS) result[t.key] = hashTarget(t);
	return result;
}

function hashTarget(t) {
	try {
		if (t.isDir) {
			if (!fs.existsSync(t.path)) return null;
			const files = fs
				.readdirSync(t.path)
				.filter((f) => !f.startsWith("."))
				.sort();
			const h = crypto.createHash("sha256");
			for (const f of files) {
				h.update(f);
				h.update(fs.readFileSync(path.join(t.path, f)));
			}
			return h.digest("hex");
		}
		if (!fs.existsSync(t.path)) return null;
		return crypto
			.createHash("sha256")
			.update(fs.readFileSync(t.path))
			.digest("hex");
	} catch {
		return null;
	}
}
