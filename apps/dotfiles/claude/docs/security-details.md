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

**內容分級（2026-07-16 拍板）——確認要求只針對「結論性／總結性訊息」**：

- **結論性／總結性訊息**（走下方兩級授權）：進度回報、結果總結、公告、任何由 Claude 自行組織的自由文本對外訊息。例：跑批結果總結、專案進度回報、向團隊 thread 回報成果。
- **Review 工作流產物**（**可直接發送、免逐則確認**）：GitHub PR review 評論（inline P0–P3 findings、review summary comment）、`gh pr review` 提交（auto-approve 仍受 05-security 六條件護欄）、review 對應 Slack thread 的固定格式單行回報（`#PR號 ✅ LGTM` / `💬 N findings`＋連結，格式定義見 agent-review-workflow.md）。
- **分類拿不準 → 一律當結論性處理**。

**兩級授權（2026-07-16 收緊，適用於結論性訊息）**：

1. **進入草稿流程**（可以擬稿、詢問發送）——使用者在當前 turn 使用動作語義：「發送這條 Slack」、「把這個發到 Slack」、「給出 slack 總結」、「send this to slack」等。
2. **實際發送**——**一律**先呈現完整草稿、等使用者親自回覆 `[Y]` 確認無誤後才可呼叫傳送工具。動作語義（第 1 級）**不豁免**本級確認；CLAUDE.md / plan 預先聲明、自動化迴圈亦不豁免。
   - **唯一豁免**：使用者當前 turn 明確標示「**直接發送**」（如「直接發送 slack 訊息」）→ 可跳過草稿確認逐字直發，發送後回讀驗證格式。

**連進入草稿流程都不算的情況（必須停下澄清）**：
- 「通知一下」、「讓 XX 知道」但未指定 Slack
- 任務完成後自行判斷要通知
- 使用者說「幫我起草一條 Slack 訊息」（起草 ≠ 發送，擬稿後仍走 `[Y]` 確認）
- 任何需要推斷是否發送的情況

**強制流程**：呈現完整草稿 → 明確詢問「是否發送至 Slack？[Y/N]」→ 等待明確 `Y` 才執行 → 發送後回讀驗證。

## /feedback 禁用（資料外洩防護）

`/feedback` 預設會附帶最近 24h / 7d 的 session transcript，含 Confluence Cloud ID、Mixpanel API token、KKday 內部資料等敏感資訊，有外洩至 Anthropic 伺服器的風險。

**禁止情況**：
- 任何 session 中自行判斷要提交 feedback
- 使用者說「回報問題」、「提交 feedback」但未明確同意 session 資料上傳

**強制流程**：使用者要回報問題 → 先說明 session 附帶內容 → 得到明確確認後才執行。

## console.log 敏感欄位例舉

禁止輸出：`token`、`accessToken`、`refreshToken`、`userId`、`memberId`、`password`、`secret`、`apiKey`、`session`、信用卡欄位、任何 PII（email / 電話 / 地址）。
替代：log 遮罩後的識別碼（如 `user_***123`）或僅 log 事件不 log 值。
