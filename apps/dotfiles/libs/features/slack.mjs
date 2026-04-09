/**
 * Slack Feature — Slack 通知配置 pipeline
 *
 * P3 階段實作：目前為 placeholder。
 */

export default {
	id: "slack",
	label: "💬 Slack 通知",
	hint: "Channel / DM",
	dependsOn: [],
	conflicts: [],

	async envCheck() {
		return { ok: true, message: "placeholder — P3 實作" };
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
		return { feature: "slack" };
	},
};
