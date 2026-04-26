# Recipe：TDD 流程從 Spec 到測試骨架

## 1. 目標

透過 `/chain-tdd` 執行四步鏈（Spec → 測試骨架 → 實作 → 驗證），以測試驅動開發方式確保實作覆蓋所有 AC。

## 2. 前置條件

- 已完成 `/specify` 流程，spec 文件存在且 AC 清單完整（參考 `recipe-specify-flow.md`）
- 測試框架已設定（Vitest / Jest，視專案而定）
- `pnpm run test` 可正常執行（即使無測試也應顯示 `No test files found`）

## 3. 步驟

1. **確認 spec 已就位**

   ```bash
   # 確認 spec 文件存在
   ls .claude/plans/<ticket>-spec.md
   ```

2. **執行 `/chain-tdd` 四步鏈**

   在 Claude Code 中輸入：

   ```
   /chain-tdd <功能名稱>
   ```

   範例：

   ```
   /chain-tdd 訂單退款按鈕
   ```

   四步鏈自動依序執行：

   - **Step 1 — Spec 解析**：從 spec 文件提取所有 AC，轉化為可測試的 test case 描述
   - **Step 2 — 測試骨架生成**：產出 `*.test.ts`（或對應框架格式），每條 AC 對應一個 `it()` / `test()`，初始狀態為 `todo` 或 `skip`
   - **Step 3 — 最小實作**：依測試骨架產出最小可通過的實作程式碼（Red → Green）
   - **Step 4 — 覆蓋驗證**：執行測試，確認骨架全部通過

3. **審查測試骨架**

   ```bash
   # 查看產出的測試文件
   cat src/__tests__/<feature>.test.ts
   ```

   確認每條 AC 至少對應一個測試，edge case（empty / error / loading）有對應覆蓋。

4. **補充測試細節**

   骨架產出的測試預設為最小覆蓋，手動補充 mock 資料與 assertion：

   ```typescript
   // 範例：補充具體 assertion
   it('已退款訂單應顯示退款狀態標籤', () => {
     // arrange
     const order = { status: 'refunded', refundedAt: '2026-04-27' }
     // act
     const { getByText } = render(<OrderDetail order={order} />)
     // assert
     expect(getByText('已退款')).toBeInTheDocument()
   })
   ```

5. **執行完整測試**

   ```bash
   pnpm run test
   ```

## 4. 驗證

- 測試骨架文件存在，`describe` 區塊名稱與 spec 功能對應
- 測試數量 ≥ AC 數量（每條 AC 至少一個測試）
- `pnpm run test` 全部通過，無 skipped 警告（除非明確標記為 known limitation）

## 5. 相關資源

- [`docs/walkthroughs/`](../walkthroughs/) — 完整操作教學
- [`commands/specify.md`](~/.claude/commands/specify.md) — spec 產生（TDD 前置步驟）
- [`commands/verify.md`](~/.claude/commands/verify.md) — AC 覆蓋反向驗證
- [`claude-md/03-code-standards.md`](~/.claude/claude-md/03-code-standards.md) — 測試規範
