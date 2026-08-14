<state_system>

## Tasks / Plans / Memory 邊界

| 工具 | 生命週期 | 用途 |
|---|---|---|
| **Tasks** | 當次對話 | 步驟追蹤（TodoWrite / 原生 tasks）|
| **Plans** | 至 PR merge | 跨 session 實作藍圖 |
| **Memory** | 永久 | 決策、偏好、踩過的坑 |

**口訣**：下次對話還有用？→ Memory ｜ 當前步驟？→ Tasks ｜ 需與用戶對齊方案？→ Plan。
（`task_<task-id>.md` 屬 run-task 框架的 task-scoped 暫存，非五層記憶一部分。）

## Memory 溫層

實際運作的是 **per-project** `~/.claude/projects/{encoded-cwd}/memory/MEMORY.md`（純 index ≤15 行）；全域 `~/.claude/memory/` 只放跨專案共用的極少量參考，非主要寫入目標。

**Stable**（`system-patterns.md`）偏好/feedback ｜ **Volatile**（`active-context.md`）進行中票號 ｜ **Warm**（`{topic}/index.md`）細節按需 ｜ **Cold**（`archive/`）封存。

**寫入規則**：stable → `system-patterns.md`；進行中 / pending-curate → `active-context.md`；**禁止直接 append 到 MEMORY.md**（僅可改 index 指向）。

## 手動觸發

「記住這個」/「存入記憶」→ 立即存入並回覆「已存入記憶：[摘要]」；「更新記憶」→ 覆蓋並確認，衝突須詢問**禁止靜默更新**。
**禁止存入**：token / 密碼 / 個資、未經確認的推斷、demo 級代碼片段。

## Mid-run 主動記憶（Curate > Wait）

不等使用者說「記住這個」，以下情境立即寫入並附「已記錄：[摘要]」：既有 pattern 和預期不同（記實際 pattern 與位置）｜確認設計決策（記**為什麼**非結論）｜踩到 non-obvious 坑（記坑 + 修復要點）｜使用者明示偏好但未說「記住」（記為 feedback memory）。

> 觸發判定標準 / 時序圖 / frontmatter 規範 / 資料夾命名 → 設計記憶結構時 Read `~/.claude/docs/state-system-details.md`。

## Context 管理

冷啟動讀取順序由 SessionStart hook 注入 `[冷啟動]` 指示，照指示執行；壓縮前掃描未入記憶的決策。Phase 切換點優先 Rewind「Summarize up to here」而非等 auto-compact；`rules/` 的 `paths:` 規則僅觸碰對應路徑時載入。

</state_system>
