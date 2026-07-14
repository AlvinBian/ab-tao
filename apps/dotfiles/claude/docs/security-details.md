# 安全規則細節（05-security 的按需展開層）

> 紅線一行式判準常駐於 `claude-md/05-security.md`；本檔為授權邊界的逐條定義、反例與揭露說明。
> 觸發時機：對授權邊界有疑問、需要引用完整定義、或使用者詢問安全規則細節時 Read 本檔。

## bypassPermissions 設定揭露

本機若啟用 `defaultMode: bypassPermissions`：

- ✅ 適用：個人 trusted 環境、單機開發、已熟悉 Claude Code 工具集者
- ❌ 不適用：共享工作站、CI/CD 共用 token、開放網路環境
- 風險：所有 tool call 自動執行，無 prompt；惡意 prompt injection 影響更大

**禁止**：在 CLAUDE.md / plan / agent prompt 中主動建議使用者開啟此模式；禁止用於繞過安全 hook。

## Git `commit` / `push` 三豁免 — 完整反例清單

**授權任一即可**：
1. **當前 turn 動作語義**：「commit 這個」「幫我提交」「push 出去」
2. **session 級預先聲明**：plan frontmatter `autoCommit: true` 或 CLAUDE.local.md 明寫
3. **自動化迴圈情境**：`/loop`、`ralph-loop`、CI/CD agent runs — skill prompt 已隱含授權

**不屬於授權（必須暫停確認）**：
- 「處理一下」「弄好它」「修完這個」（含糊指令，無動作語義）
- task 完成後 Claude 自行判斷該 commit
- 多 PR 工作流中段不確定是否該推進到下一支

**強制流程**：如有疑問 → 呈現 diff + 詢問「是否 commit / push？[Y/N]」→ 等明確 Y 才執行。

## Slack「明確指示」逐條定義

**明確指示**定義（必須同時符合）：
- 使用者在當前 turn 直接使用動作語義：「發送這條 Slack」、「把這個發到 Slack」、「send this to slack」等
- 或在 CLAUDE.md / plan 中預先聲明「此任務自動發送 Slack」

**不屬於明確指示的情況（必須停下確認）**：
- 「通知一下」、「讓 XX 知道」但未指定 Slack
- 任務完成後自行判斷要通知
- 使用者說「幫我起草一條 Slack 訊息」（起草 ≠ 發送）
- 任何需要推斷是否發送的情況

**強制流程**：如有疑問 → 呈現完整草稿 → 明確詢問「是否發送至 Slack？[Y/N]」→ 等待明確確認後才執行。

## /feedback 禁用（資料外洩防護）

`/feedback` 預設會附帶最近 24h / 7d 的 session transcript，含 Confluence Cloud ID、Mixpanel API token、KKday 內部資料等敏感資訊，有外洩至 Anthropic 伺服器的風險。

**禁止情況**：
- 任何 session 中自行判斷要提交 feedback
- 使用者說「回報問題」、「提交 feedback」但未明確同意 session 資料上傳

**強制流程**：使用者要回報問題 → 先說明 session 附帶內容 → 得到明確確認後才執行。

## console.log 敏感欄位例舉

禁止輸出：`token`、`accessToken`、`refreshToken`、`userId`、`memberId`、`password`、`secret`、`apiKey`、`session`、信用卡欄位、任何 PII（email / 電話 / 地址）。
替代：log 遮罩後的識別碼（如 `user_***123`）或僅 log 事件不 log 值。
