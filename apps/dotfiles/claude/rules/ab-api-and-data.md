---
name: ab-api-and-data
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

- 新增 NOT NULL 分三步：nullable → 回填 → 約束
- 重命名分步：加新欄位 → 雙寫 → 切讀 → 刪舊
- 刪除欄位：先確認代碼已不讀取，再刪
- 大表（> 100 萬行）：用 `CONCURRENTLY` 或 `pt-online-schema-change`

## 可觀測性

- 結構化日誌 JSON：timestamp / level / service / traceId / requestId
- RED 指標：Rate `requests_total`；Errors `errors_total`；Duration `duration_seconds`
- 告警基於 SLO（error rate > 1%）；每條告警附 runbook
