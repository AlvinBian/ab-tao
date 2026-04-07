---
name: workflow
description: >
  工作流程規範：測試策略、效能、構建優化。
matchWhen:
  always: true
---

# Workflow

## 測試

- 繁體中文描述；檔旁命名 `*.test.*` / `*.spec.*`
- 覆蓋正向、反向、邊界；API ≥ 90%，整體 ≥ 80%
- Mock 外部 API、DB、時間；不 Mock 內部邏輯、純函式

## 效能與構建

- 開發用 Sonnet；代理用 Haiku；複雜決策用 Opus
- 避免 context window 最後 20%；單檔案直接編輯
- Turbopack / SWC；動態 import；WebP + lazy loading；API 加快取

## 外部調用

- 指數退避（1s, 2s, 4s），最多 3 次；冪等操作才 retry
- 超過限制記錄告警，不靜默失敗
