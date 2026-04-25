/**
 * Slack 通知設定精靈
 *
 * 模式選擇：channel / dm / off / skip
 *   - channel：貼上 Channel Link 或 ID，自動提取 channelId
 *   - dm：設定為 "dm" sentinel，發送時由 Slack MCP 自動解析當前使用者
 *   - 回傳 { SLACK_NOTIFY_CHANNEL } 或 null（跳過）
 */
import * as p from "@clack/prompts";

const CHANNEL_RE = /\b(C[A-Z0-9]{8,})\b/;

/**
 * @param {Record<string, string>} existingEnv  現有 settings.json 的 env 物件
 * @returns {Promise<{ SLACK_NOTIFY_CHANNEL: string } | null>}
 */
export async function setupSlackNotify(existingEnv = {}) {
	const currentChannel = existingEnv.SLACK_NOTIFY_CHANNEL ?? "";

	// 已設定 → 確認是否保持
	if (currentChannel) {
		p.log.info(`Slack 目前設定　Channel = ${currentChannel}`);
		const keep = await p.confirm({
			message: "保持現有 Slack 設定不變？",
			initialValue: true,
		});
		if (p.isCancel(keep) || keep === true) return null;
	}

	const mode = await p.select({
		message: "Slack 通知模式",
		options: [
			{ value: "channel", label: "Channel 指定頻道（推薦）" },
			{ value: "dm", label: "DM 私發給自己" },
			{ value: "off", label: "關閉（清除設定）" },
			{ value: "skip", label: "稍後手動設定" },
		],
	});
	if (p.isCancel(mode) || mode === "skip") return null;

	if (mode === "off") {
		return { SLACK_NOTIFY_CHANNEL: "" };
	}

	if (mode === "dm") {
		return { SLACK_NOTIFY_CHANNEL: "dm" };
	}

	// channel 模式
	const link = await p.text({
		message: "貼上 Channel Link 或 Channel ID",
		placeholder: "https://xxx.slack.com/archives/C07XXXXXX 或 C07XXXXXX",
		initialValue: currentChannel.startsWith("C") ? currentChannel : "",
		validate: (v) => {
			if (!v) return "不能為空";
			if (!CHANNEL_RE.test(v))
				return "找不到有效 Channel ID（應含 C 開頭 9+ 字元英數字串）";
		},
	});
	if (p.isCancel(link)) return null;

	const channelId = (link.match(CHANNEL_RE) ?? [])[1] ?? link.trim();
	return { SLACK_NOTIFY_CHANNEL: channelId };
}
