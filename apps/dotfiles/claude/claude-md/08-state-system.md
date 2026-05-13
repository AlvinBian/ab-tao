<state_system>

## Tasks / Plans / Memory 邊界

| 工具 | 生命週期 | 用途 |
|---|---|---|
| **Tasks** | 當次對話 | 步驟追蹤（TodoWrite / 原生 tasks）|
| **Plans** | 至 PR merge | 跨 session 實作藍圖 |
| **Memory** | 永久 | 決策、偏好、踩過的坑 |

**口訣**：下次對話還有用？→ Memory ｜ 當前步驟？→ Tasks ｜ 需與用戶對齊方案？→ Plan

## Memory 三溫層

**Hot**（MEMORY.md）：≤15 項，≤150 char/行 ｜ **Warm**（`{topic}/index.md`）：細節按需 ｜ **Cold**（`archive/`）：封存

## 手動觸發（Memory）

「記住這個」/「存入記憶」/「記下來」→ 立即存入並回覆「已存入記憶：[摘要]」。
「更新記憶」→ 覆蓋對應舊記憶並確認。新結論與舊記憶衝突時必須詢問，禁止靜默更新。

**禁止存入**：token / 密碼 / 個資、未經確認的推斷、demo 級代碼片段。

## 冷啟動

開新 session 先讀當前專案的 memory index 與 active plan。Context 壓縮前掃描未入記憶的重要決策。

> 資料夾命名 / Plan Frontmatter Convention 細節 → `~/.claude/docs/state-system-details.md`

</state_system>
