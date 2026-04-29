# TDD 完整流程

適用對象：測試驅動開發場景，確保測試先行、實作對齊規格、品質嚴格閘控。

## 前置需求

1. ab-tao `d:setup` 已完成，`~/.claude/` 配置就緒
2. `settings.json` 的 `tddStrictMode` 已啟用（或透過 `/chain-tdd` 自動啟用）
3. 測試框架已安裝（Vitest / Jest，視專案而定）

## 完整步驟

### 步驟 1：需求結構化

```bash
/specify <功能描述>
```

產出包含：
- 明確的 Acceptance Criteria（AC）
- 邊界條件與 edge cases
- 輸入 / 輸出型別定義

儲存為 `spec.md` 或記下 AC 清單，後續測試直接對應每條 AC。

### 步驟 2：Architect Agent 設計測試骨架

```bash
/agent architect
```

告知 architect：「根據以下 spec，設計測試骨架（describe / it 結構），不包含實作」

Architect 輸出測試骨架範例：

```typescript
// feature.test.ts
describe('功能名稱', () => {
  describe('AC-1：正常路徑', () => {
    it('應回傳正確資料', () => {
      // TODO: 待實作
    })
  })

  describe('AC-2：錯誤處理', () => {
    it('輸入無效時應拋出錯誤', () => {
      // TODO: 待實作
    })
  })

  describe('AC-3：邊界條件', () => {
    it('空陣列輸入應回傳空結果', () => {
      // TODO: 待實作
    })
  })
})
```

將骨架提交為獨立 commit：`test: 新增 <feature> 測試骨架`

### 步驟 3：/check --tdd-strict 驗證「紅燈」狀態

```bash
/check --tdd-strict
```

確認所有測試目前為 **失敗狀態**（紅燈）。
若有測試意外通過，代表骨架邏輯有誤，需回到步驟 2 修正。

### 步驟 4：實作讓測試通過（綠燈）

逐條 AC 實作，每完成一條立即跑測試：

```bash
pnpm test --run <test-file>
```

目標：讓所有測試從紅燈轉綠燈，不多不少。

### 步驟 5：/verify 反查 AC 覆蓋率

```bash
/verify
```

確認每條 AC 都有對應測試覆蓋。
輸出覆蓋率報告，標記未覆蓋的 AC。

### 步驟 6：/check 品質閘（TDD 嚴格模式）

```bash
/check --gates
```

TDD 嚴格模式額外閘：
- 測試覆蓋率 ≥ 80%（行覆蓋率）
- 無空 `it()` / `test()`（禁止殭屍測試）
- 測試描述必須為中文（符合專案規範）

## 預期結果

- 每條 AC 對應至少一個測試案例
- 測試全部通過，覆蓋率達標
- 代碼不包含多餘邏輯（只寫讓測試通過的最小實作）

## 常見問題

**Q：architect 設計的測試骨架太粗略怎麼辦？**
A：補充 edge cases 到 spec 中，重新讓 architect 細化骨架。

**Q：`--tdd-strict` 報告有測試意外通過（假綠燈）？**
A：通常是測試斷言不夠嚴格（如 `toBeTruthy()` 太寬鬆），需改為精確斷言。

**Q：實作過程中發現 spec 有誤？**
A：先停下，更新 spec 並補 `/verify`，再繼續實作，避免測試與規格漂移。

**Q：TDD 適合 UI 組件嗎？**
A：適合邏輯層（composable、service、store），UI snapshot test 另外處理。
