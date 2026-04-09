/**
 * Project Feature — 專案配置 pipeline
 *
 * P2 階段實作：目前為 placeholder。
 */

export default {
	id: "project",
	label: "📁 專案配置（repos + AI）",
	hint: "CLAUDE.md + AI 資源 + 技術棧",
	dependsOn: [],
	conflicts: [],

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
		return { feature: "project" };
	},
};
