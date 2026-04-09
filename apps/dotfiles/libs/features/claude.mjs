/**
 * Claude Feature — Claude Code 開發配置 pipeline
 *
 * P2 階段實作：目前為 placeholder，委託給現有 phase 函式。
 * TODO: 拆出獨立的 envCheck / backup / verify / rollback
 */

export default {
	id: "claude",
	label: "🤖 Claude Code 開發配置",
	hint: "commands · agents · rules · hooks · settings",
	dependsOn: [],
	conflicts: [],

	// P2 實作
	async envCheck() {
		return { ok: true, message: "placeholder — P2 實作" };
	},
	async backup() {
		return { files: [], dir: "" };
	},
	async configure() {
		return {};
	},
	async plan() {
		return null;
	},
	async confirm() {
		return true;
	},
	async install() {
		return null;
	},
	async verify() {
		return { passed: 0, total: 0, missing: [] };
	},
	complete() {
		return [];
	},
	async rollback() {},
	session() {
		return {};
	},
	async cleanup() {},
	report() {
		return { feature: "claude" };
	},
};
