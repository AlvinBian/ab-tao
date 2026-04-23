<security>
- 禁止在任何代碼中以 console.log 輸出 token、用戶 ID、敏感欄位
- 環境變數統一 .env 分層管理：.env.development / .env.staging / .env.production
- API 授權方式依專案而定（JWT / httpOnly Cookie），新對話若未說明須優先詢問
- 敏感操作（刪除、支付、權限變更）必須包含二次確認機制

## bypassPermissions 設定揭露

本機若啟用 `defaultMode: bypassPermissions`：
- ✅ 適用：個人 trusted 環境、單機開發、已熟悉 Claude Code 工具集者
- ❌ 不適用：共享工作站、CI/CD 共用 token、開放網路環境
- 風險：所有 tool call 自動執行，無 prompt；惡意 prompt injection 影響更大

**禁止**：在 CLAUDE.md / plan / agent prompt 中主動建議使用者開啟此模式；禁止用於繞過安全 hook。

## 外部通訊安全（強規則）

### Slack 訊息發送
❗ **嚴禁** 在未得到使用者明確指示的情況下呼叫任何 Slack 傳送工具
（`slack_send_message` / `slack_schedule_message` 或任何傳送型 MCP Slack tool）。

**明確指示**定義（必須同時符合）：
- 使用者在當前 turn 直接使用動作語義：「發送這條 Slack」、「把這個發到 Slack」、「send this to slack」等
- 或在 CLAUDE.md / plan 中預先聲明「此任務自動發送 Slack」

**不屬於明確指示的情況（必須停下確認）**：
- 「通知一下」、「讓 XX 知道」但未指定 Slack
- 任務完成後自行判斷要通知
- 使用者說「幫我起草一條 Slack 訊息」（起草 ≠ 發送）
- 任何需要推斷是否發送的情況

**強制流程**：如有疑問 → 呈現完整草稿 → 明確詢問「是否發送至 Slack？[Y/N]」→ 等待明確確認後才執行。
</security>
