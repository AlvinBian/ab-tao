---
name: ab-testing
description: 測試慣例 — 測試結構、命名、覆蓋策略、mock 使用規範。
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/test/**"
  - "vitest.config.*"
  - "jest.config.*"
---

<testing_rules>
- 測試描述使用繁體中文，格式：`describe('模組名稱') + it('行為描述')`
- 每個測試覆蓋：happy path + 至少 2 個 edge case + 1 個 error path
- 禁止在測試中 `console.log`；失敗訊息需明確說明預期 vs 實際
- Mock 僅用於外部服務（HTTP、DB、FS）；禁止 mock 內部業務邏輯
- 測試不應依賴其他測試的執行順序或共享可變狀態
- Node.js 內建 test runner：`node --test __tests__/*.test.mjs`（偏好零依賴）
- Vitest 用於前端（Vue 組件、Composable）；Node test runner 用於 CLI / 工具庫
</testing_rules>
