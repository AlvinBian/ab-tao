/**
 * Slack 通知設定精靈
 *
 * 對應 docs/flows/slack-setup.mmd 的實作：
 *   - 已設定 → 確認保持 / 重新設定
 *   - 模式選擇：channel / dm / off / skip
 *   - channel 模式：貼上 Channel Link 或 ID，自動提取 channelId
 *   - dm 模式：輸入 Slack User ID
 *   - 回傳 { SLACK_NOTIFY_CHANNEL, SLACK_NOTIFY_USER_ID } 或 null（跳過）
 */
import * as p from "@clack/prompts";

const CHANNEL_RE = /\b(C[A-Z0-9]{8,})\b/;
const USER_ID_RE = /^U[A-Z0-9]{8,}$/;

/**
 * @param {Record<string, string>} existingEnv  現有 settings.json 的 env 物件
 * @returns {Promise<{ SLACK_NOTIFY_CHANNEL: string, SLACK_NOTIFY_USER_ID: string } | null>}
 */
export async function setupSlackNotify(existingEnv = {}) {
	const currentChannel = existingEnv.SLACK_NOTIFY_CHANNEL ?? "";
	const currentUserId = existingEnv.SLACK_NOTIFY_USER_ID ?? "";

	// 兩者都已設定 → 確認是否保持
	if (currentChannel && currentUserId) {
		p.log.info(
			`Slack 目前設定　Channel = ${currentChannel}　UserID = ${currentUserId}`,
		);
		const keep = await p.confirm({
			message: "保持現有 Slack 設定不變？",
			initialValue: true,
		});
		if (p.isCancel(keep) || keep === true) return null;
	}

	const mode = await p.select({
		message: "Slack 通知模式",
		options: [
			{ value: "channel", label: "Channel — 指定頻道（推薦）" },
			{ value: "dm", label: "DM — 私發給自己" },
			{ value: "off", label: "關閉（清除設定）" },
			{ value: "skip", label: "稍後手動設定" },
		],
	});
	if (p.isCancel(mode) || mode === "skip") return null;

	if (mode === "off") {
		return { SLACK_NOTIFY_CHANNEL: "", SLACK_NOTIFY_USER_ID: "" };
	}

	if (mode === "dm") {
		const userId = await p.text({
			message: "輸入你的 Slack User ID",
			placeholder: "U04B933M4G6",
			initialValue: currentUserId,
			validate: (v) =>
				v && USER_ID_RE.test(v.trim())
					? undefined
					: "格式應為 U 開頭 + 英數字，例：U04B933M4G6",
		});
		if (p.isCancel(userId)) return null;
		const uid = userId.trim();
		return { SLACK_NOTIFY_CHANNEL: uid, SLACK_NOTIFY_USER_ID: uid };
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

	const userId = await p.text({
		message: "輸入你的 Slack User ID（用於 /slack 發給我，Enter 跳過）",
		placeholder: "U04B933M4G6",
		initialValue: currentUserId,
	});
	if (p.isCancel(userId)) return null;

	return {
		SLACK_NOTIFY_CHANNEL: channelId,
		SLACK_NOTIFY_USER_ID: (userId ?? "").trim(),
	};
}
