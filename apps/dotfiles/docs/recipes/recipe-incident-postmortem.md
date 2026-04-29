# Recipe：事件覆盤（Incident Postmortem）

## 1. 目標

使用 `runbook` skill 跑完整事件覆盤流程，透過 Keep / Improve / Stop / Action 四象限產出 postmortem 報告。

## 2. 前置條件

- 事件已解除（服務恢復正常），具備事件時間軸記錄（log、alert 截圖、on-call 記錄）
- 相關人員（on-call、RD、PM）均可提供事件期間的操作記錄
- `runbook` skill 已安裝（`pnpm run c:skills` 可查詢）

## 3. 步驟

1. **觸發 runbook skill**

   在 Claude Code 中輸入：

   ```
   /runbook incident-postmortem
   ```

   或手動啟動 skill：

   ```
   <觸發 runbook skill，場景：incident postmortem>
   ```

2. **填寫事件基本資訊**

   依 skill 提示填入：
   - 事件編號 / 名稱
   - 發生時間（ISO 8601 格式）
   - 影響範圍（服務、用戶數、持續時長）
   - 嚴重等級（P1 / P2 / P3）

3. **執行 Retro 四象限填寫**

   依序輸入每個象限的條目：

   ```
   Keep（繼續做好的）：
   - 監控告警在 5 分鐘內觸發，反應迅速

   Improve（可以改善的）：
   - Runbook 文件過時，需更新 rollback 步驟

   Stop（應該停止的）：
   - 在 peak hour 執行 DB migration

   Action（具體行動項）：
   - [ ] 更新 Runbook v2（負責人：@alvin，截止：2026-05-10）
   - [ ] 加入 migration 時間窗口限制（負責人：@infra，截止：2026-05-03）
   ```

4. **產出 postmortem 報告**

   skill 自動整合以上內容，產出 Markdown 格式報告。儲存至：

   ```bash
   # 報告儲存路徑（視專案而定）
   docs/postmortem/<YYYY-MM-DD>-<incident-name>.md
   ```

5. **同步 Action Items 至 Jira / Slack**

   ```
   # 若需發送至 Slack，透過 /slack 指令
   /slack
   ```

   確認目標 channel 後發送報告摘要。

## 4. 驗證

- postmortem Markdown 文件存在，含完整四象限內容
- Action Items 有明確負責人與截止日期
- 報告已同步給相關 stakeholder（Slack / Jira）

## 5. 相關資源

- [`docs/walkthroughs/`](../walkthroughs/) — 完整操作教學
- [`commands/slack.md`](~/.claude/commands/slack.md) — Slack 發送流程
- [`claude-md/09-task-system.md`](~/.claude/claude-md/09-task-system.md) — Action Items 追蹤
