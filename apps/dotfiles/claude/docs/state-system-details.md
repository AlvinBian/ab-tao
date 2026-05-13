# State System 詳細規範

> 由 `claude-md/08-state-system.md` 按需指向，操作 plan/memory 細節時 Read。

## 資料夾組織（Memory）

同一需求的記憶統一放一個資料夾：
- 有票號：`{TICKET}-{short-desc}/`（例：`VM-1482-m-new-order-detail/`）
- 無票號：`{short-desc}/`（例：`auth-refactor/`）
- 每個資料夾建 `index.md` 作索引；根層 MEMORY.md 每個專案只佔一行指向 `{folder}/index.md`

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

## 自動策略（session 中）

- Context 壓縮前：掃描未入記憶的重要決策立即寫入
- Git 事件：新分支 → 更新 reference 欄；PR merge → 標記對應記憶狀態
- 90 天未存取 project 記憶 → decay scan 提示歸檔
