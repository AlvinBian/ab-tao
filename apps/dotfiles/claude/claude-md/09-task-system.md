<task_system>

## Tasks / Plans / Memory 邊界

| 工具 | 生命週期 | 用途 |
|---|---|---|
| **Tasks** | 當次對話 | 步驟追蹤（TodoWrite / 原生 tasks）|
| **Plans** | 至 PR merge | 跨 session 實作藍圖 |
| **Memory** | 永久 | 決策、偏好、踩過的坑 |

**口訣**：下次對話還有用？→ Memory ｜ 當前步驟？→ Tasks ｜ 需與用戶對齊方案？→ Plan

## 冷啟動

開新 session 先讀當前專案的 memory index 與 active plan（具體路徑由 ab-tao 的 `paths.mjs` 管理，不需手動拼）。

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

</task_system>
