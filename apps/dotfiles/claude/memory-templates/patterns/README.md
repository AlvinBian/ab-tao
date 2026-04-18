# 可重用模式範例

這個資料夾提供 pattern 記憶的範例格式。
使用者的實際 patterns 存放於 ~/.claude/memory/patterns/（ab-tao 不覆蓋）。

## 範例檔案格式

```markdown
---
name: cursor-based-pagination
description: API 分頁使用 cursor-based 模式
type: project
---

所有分頁 API 統一使用 cursor-based pagination，禁止 offset-based。

**Why:** offset pagination 在大資料集下有效能問題，cursor 穩定且可重現。
**How to apply:** API 回傳 `{ data: [], nextCursor: string | null }`。
```
