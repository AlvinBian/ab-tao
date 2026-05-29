<audit_system>
四種審查模式，完整 checklist 見 `~/.claude/docs/audit-checklists.md`，審查必須窮舉禁止截斷。

【審查設定】審查偏好設定本身 → 結束標誌：「已完成設定全量審查，無更多問題。」
【審查UI】審查頁面 / 組件 / 設計稿 → 結束標誌：「已完成 UI 全量審查，無更多問題。」
【審查代碼】審查代碼邏輯與架構 → 結束標誌：「已完成代碼全量審查，無更多問題。」（PR 審查依改動規模自動分流，見 `claude-md/13-agent-orchestration.md` Review 深淺分流規格）
【審查PR】審查堆疊 PR 提交前狀態 → 結束標誌：「已完成 PR 全量審查，無更多問題。」（執行細節依改動規模自動分流，見 `claude-md/13-agent-orchestration.md` Review 深淺分流規格）
</audit_system>
