<state_system>

## Tasks / Plans / Memory 邊界

| 工具 | 生命週期 | 用途 |
|---|---|---|
| **Tasks** | 當次對話 | 步驟追蹤（TodoWrite / 原生 tasks）|
| **Plans** | 至 PR merge | 跨 session 實作藍圖 |
| **Memory** | 永久 | 決策、偏好、踩過的坑 |

**口訣**：下次對話還有用？→ Memory ｜ 當前步驟？→ Tasks ｜ 需與用戶對齊方案？→ Plan

## Memory 溫層（三溫層架構，現行五層）

**Hot**（MEMORY.md）：純 index，≤15 行，永不直接寫入內容 → 利於 prompt cache ｜ **Stable**（`system-patterns.md`）：偏好 / feedback / 永久參考 ｜ **Volatile**（`active-context.md`）：進行中 ticket / mid-run 記錄 ｜ **Warm**（`{topic}/index.md`）：細節按需 ｜ **Cold**（`archive/`）：封存

**寫入規則**：stable feedback / 工具偏好 → `system-patterns.md` ｜ 進行中票號 / pending-curate → `active-context.md` ｜ 禁止直接 append 到 MEMORY.md（僅允許修改 index 指向）

## 手動觸發（Memory）

「記住這個」/「存入記憶」/「記下來」→ 立即存入並回覆「已存入記憶：[摘要]」。
「更新記憶」→ 覆蓋對應舊記憶並確認。新結論與舊記憶衝突時必須詢問，禁止靜默更新。

**禁止存入**：token / 密碼 / 個資、未經確認的推斷、demo 級代碼片段。

## Mid-run 主動記憶（Curate > Wait）

不等使用者說「記住這個」，以下情境立即寫入 memory 並在回覆末附「已記錄：[摘要]」：

- 發現既有 pattern（composable / util / store）和預期不同 → 記錄實際 pattern 與位置
- 確認了設計決策的「為什麼」（業務約束 / 歷史背景）→ 記錄動機，非結論
- 踩到 non-obvious 坑且修復方式不在 commit message 可見 → 記錄坑 + 修復要點
- 使用者明示偏好但未說「記住」（如「我們都用 pnpm」）→ 記錄為 feedback memory

> 觸發判定標準 / 時序圖 / frontmatter 規範 → `~/.claude/docs/state-system-details.md`

## Context 管理（冷啟動 → SessionStart hook 注入；壓縮策略 → PreCompact hook 注入）

- 冷啟動讀取順序與 pending-curate 偵測由 SessionStart hook 於 session 開頭注入 `[冷啟動]` 指示，照指示執行即可
- Context 壓縮前掃描未入記憶的重要決策；Phase 切換點優先建議 Rewind「Summarize up to here」（surgical）而非等 auto-compact
- `rules/` 的 `paths:` 規則僅在觸碰對應路徑時載入；使用者問「有什麼規則」只回答 always-loaded 部分

> 資料夾命名 / Plan Frontmatter Convention 細節 → `~/.claude/docs/state-system-details.md`

</state_system>
