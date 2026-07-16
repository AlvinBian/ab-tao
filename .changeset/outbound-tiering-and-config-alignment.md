---
'@ab-tao/dotfiles': minor
---

對外發送分級制 + 全域配置帳實對齊與清退

**對外發送分級制（2026-07-16 拍板）**
- 結論性／總結性訊息（進度回報、總結、公告、自由文本）：發送前一律呈現草稿、由使用者親自確認 [Y]；動作語義只授權進入草稿流程，plan 預先聲明與自動化迴圈不豁免；唯一跳過＝當前 turn 明確標示「直接發送」
- Review 工作流產物（PR 評論／`gh pr review`／固定格式 Slack 單行回報）直發免逐則確認；拿不準一律當結論性
- `commands/slack.md` v4.2.0：A3/A3.5 雙軌 lint（直發 standard markdown／手貼 mrkdwn）、A4.3 工具前綴泛化＋發送後回讀驗證、轉換器全形標點 bug 定案（`**` 前後只放半形）

**agent 工作流斷鏈修復**
- 幽靈 agent：reviewer→code-reviewer、planner→內建 Plan；執行類 schema／模板／對應表補 `verdict`（Done-gate Critic 恢復可判定）
- agent-review-workflow：approve「5 條件」→6 對齊 §05；`/review-pr` 指涉改 `/code-review --effort=deep`

**清退與帳實對齊**
- 刪 10 個孤兒／過時 docs（8 零引用 + STRUCTURE.md + self-evolution.md，逐檔驗證無依賴）
- browser-harness 退役：瀏覽器調試／長任務統一 claude-in-chrome，router skill v3.0.0 三選一
- 結構索引全面對齊實際：config-map（claude-md 13／agents 7／commands 13／skills 22／docs 21）、claude-md README 重寫、skills README v2.0.0、audit-checklists 修過時斷言＋新增分級制檢查項
