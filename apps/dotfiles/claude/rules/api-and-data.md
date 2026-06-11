---
name: api-and-data
description: API 錯誤格式、Schema 命名、Migration 安全、可觀測性（專案特有規範）。
paths:
  - "src/api/**"
  - "routes/**"
  - "pages/api/**"
  - "**/prisma/**"
  - "**/drizzle/**"
  - "**/*.sql"
  - "**/migrations/**"
---

# API & Data（專案特有）

## 統一錯誤回傳

```json
{ "error": { "code": "ERROR_CODE", "message": "說明", "details": [], "requestId": "req_id" } }
```

時間 ISO 8601 UTC；金額整數分；版本 URL `/api/v1/`；分頁含 page/perPage/total/hasNext

## Schema 慣例

- 表名 snake_case 複數；`id UUID PRIMARY KEY`；`created_at`/`updated_at` TIMESTAMPTZ
- 軟刪除用 `deleted_at`；Boolean 用 `is_` 前綴
- 索引順序：等值 → 範圍 → 排序；偏好 partial index（`WHERE deleted_at IS NULL`）

## Migration 安全

→ 見 `rules/migrations.md`（NOT NULL 三步 / 重命名四步 / 大表策略 / 回滾設計，編輯 migration 檔時自動注入，避免兩處重複）

## 可觀測性

- 結構化日誌 JSON：timestamp / level / service / traceId / requestId
- RED 指標：Rate `requests_total`；Errors `errors_total`；Duration `duration_seconds`
- 告警基於 SLO（error rate > 1%）；每條告警附 runbook
