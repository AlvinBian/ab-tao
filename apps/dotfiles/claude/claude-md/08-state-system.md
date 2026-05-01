<state_system>

## Tasks / Plans / Memory 邊界

| 工具 | 生命週期 | 用途 |
|---|---|---|
| **Tasks** | 當次對話 | 步驟追蹤（TodoWrite / 原生 tasks）|
| **Plans** | 至 PR merge | 跨 session 實作藍圖 |
| **Memory** | 永久 | 決策、偏好、踩過的坑 |

**口訣**：下次對話還有用？→ Memory ｜ 當前步驟？→ Tasks ｜ 需與用戶對齊方案？→ Plan

## Memory 三溫層

**Hot**（MEMORY.md）：≤15 項，≤150 char/行，最近 30 天活躍 topic
**Warm**（`{topic}/index.md`）：細節，按需載入
**Cold**（`archive/`）：已封存，僅搜尋命中時提取

## 手動觸發（Memory）

「記住這個」/「存入記憶」/「記下來」→ 立即存入並回覆「已存入記憶：[摘要]」。
「更新記憶」→ 覆蓋對應舊記憶並確認。新結論與舊記憶衝突時必須詢問，禁止靜默更新。

**禁止存入**：token / 密碼 / 個資、未經確認的推斷、demo 級代碼片段。

## 資料夾組織

同一需求的記憶統一放一個資料夾：
- 有票號：`{TICKET}-{short-desc}/`（例：`VM-1482-m-new-order-detail/`）
- 無票號：`{short-desc}/`（例：`auth-refactor/`）
- 每個資料夾建 `index.md` 作索引；根層 MEMORY.md 每個專案只佔一行指向 `{folder}/index.md`

## 冷啟動

開新 session 先讀當前專案的 memory index 與 active plan（具體路徑由 ab-tao 的 `paths.mjs` 管理，不需手動拼）。

自動策略（session 中）：
- Context 壓縮前：掃描未入記憶的重要決策立即寫入
- Git 事件：新分支 → 更新 reference 欄；PR merge → 標記對應記憶狀態
- 90 天未存取 project 記憶 → decay scan 提示歸檔

## Plan Frontmatter Convention

Plan 文件首部可加入 frontmatter 以控制歸位命名：

```yaml
---
ticket: VM-1482
topic: pr-stack
status: draft
created: 2026-04-22
---
```

命名規則（優先級高到低）：
- `ticket + topic` → `{ticket}-{topic}.md`
- 僅 `topic` → `{topic}.md`
- 僅 `ticket` → `{ticket}.md`
- 全無 → 保留原隨機 slug（不加 timestamp 前綴）

</state_system>
