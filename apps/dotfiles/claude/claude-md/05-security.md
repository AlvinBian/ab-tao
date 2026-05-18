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

## Git 操作紅線（強規則）

### `git commit` / `git push`（Slack-style 三豁免）

❗ **嚴禁未經授權執行 `git commit` / `git push`**。

**授權任一即可**：
1. **當前 turn 動作語義**：「commit 這個」「幫我提交」「push 出去」
2. **session 級預先聲明**：plan frontmatter `autoCommit: true` 或 CLAUDE.local.md 明寫
3. **自動化迴圈情境**：`/loop`、`ralph-loop`、CI/CD agent runs — skill prompt 已隱含授權

**不屬於授權（必須暫停確認）**：
- 「處理一下」「弄好它」「修完這個」（含糊指令，無動作語義）
- task 完成後 Claude 自行判斷該 commit
- 多 PR 工作流中段不確定是否該推進到下一支

**強制流程**：如有疑問 → 呈現 diff + 詢問「是否 commit / push？[Y/N]」→ 等明確 Y 才執行。

### `gh pr merge`（任何情境禁止，無豁免）

❌ **禁止 `gh pr merge`**（任何 PR、任何情境，含 `autoCommit: true` 也不豁免）
❌ **禁止開啟 GitHub auto-merge**
✅ **PR merge 唯一方式**：GitHub UI 手動點擊

詳細規範見 `rules/git-and-pr.md`（stacked PR 工作流、metadata 同步等）。

### Force push（必先 backup）

❌ Force push 前必先 `git branch backup/<original>`，禁直接覆蓋上游（任何模式皆不豁免）
❌ `--no-verify` 僅限使用者明說 hotfix 緊急；自動化迴圈不豁免

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

### /feedback 禁用（資料外洩防護）
❗ **嚴禁主動執行 `/feedback`**。

`/feedback` 預設會附帶最近 24h / 7d 的 session transcript，含 Confluence Cloud ID、Mixpanel API token、KKday 內部資料等敏感資訊，有外洩至 Anthropic 伺服器的風險。

**禁止情況**：
- 任何 session 中自行判斷要提交 feedback
- 使用者說「回報問題」、「提交 feedback」但未明確同意 session 資料上傳

**強制流程**：使用者要回報問題 → 先說明 session 附帶內容 → 得到明確確認後才執行。
</security>
