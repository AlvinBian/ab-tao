---
name: migrations
description: DB Migration 安全規範 — 不停機變更、大表策略、回滾設計。
paths:
  - "**/migrations/**"
  - "**/*.sql"
  - "**/prisma/**"
  - "**/drizzle/**"
  - "**/knex/**"
---

<migrations_rules>
## 新增 NOT NULL 欄位（三步驟）

1. 新增 nullable 欄位
2. 回填預設值（批次，避免鎖表）
3. 加 NOT NULL 約束

## 重命名欄位（四步驟）

1. 加新欄位
2. 雙寫（新舊欄位同時寫入）
3. 切換讀取至新欄位
4. 刪除舊欄位（確認代碼已不讀取）

## 大表策略（> 100 萬行）

- 索引用 `CREATE INDEX CONCURRENTLY`
- Schema 變更用 `pt-online-schema-change` 或 `gh-ost`
- 避免鎖表超過 1 秒

## 回滾設計

每條 migration 必須有對應 down migration；禁止破壞性無法回滾的操作（如刪除欄位）直接 up，需先確認代碼不依賴。
</migrations_rules>
