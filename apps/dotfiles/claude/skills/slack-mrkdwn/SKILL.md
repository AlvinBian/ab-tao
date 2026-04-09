---
name: slack-mrkdwn
description: Slack mrkdwn 格式規範：禁止語法、對照表、結構規範。
user-invocable: false
---

# Slack mrkdwn 格式規範

> 完整語法參考：https://api.slack.com/reference/surfaces/formatting

## 禁止事項（與 Markdown 不同之處）

| 效果   | Slack（正確）     | Markdown（禁止）     |
|--------|------------------|---------------------|
| 粗體   | `*文字*`         | `**文字**`          |
| 斜體   | `_文字_`         | — |
| 刪除線 | `~文字~`         | `~~文字~~`          |
| 連結   | `<url\|顯示文字>` | `[文字](url)`       |
| 提及   | `<@USERID>`      | `@名字`             |
| 頻道   | `<#CHANNELID\|name>` | `#name`        |
| 分隔線 | 空行             | `---`               |
| 標題   | `*粗體*`（獨行） | `## 標題`           |

- 格式符號前後**不可有空白**：`* 文字 *` 無效

## 結構規範

- 段落之間留空行
- 清單用 `•` 或 `-` 開頭，不支援巢狀縮排
- 引言：`> 文字`（只支援單層）
- 程式碼：`` `inline` `` 或 ` ``` 多行 ``` `（區塊內 mrkdwn 失效）
- 訊息超過 400 字建議改用 Canvas 或分段
- `<!here>` 通知頻道在線成員；`<!channel>` 通知所有成員（謹慎使用）

## 發送目標

| 用戶說 | 發送目標 | 環境變數 |
|--------|---------|---------|
| 「發到頻道」「通知頻道」 | 指定頻道 | `$SLACK_NOTIFY_CHANNEL` |
| 「發給我」「DM 我」「傳給我」 | 私訊用戶（MCP 直接發送） | `$SLACK_NOTIFY_USER_ID` |
| 未指定 | 指定頻道（預設） | `$SLACK_NOTIFY_CHANNEL` |

- **不詢問確認**，直接按上表發送
- `$SLACK_NOTIFY_CHANNEL` 未設定時，才詢問用戶頻道
