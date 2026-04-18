/**
 * rule-content.mjs — Rules 核心內容提取
 *
 * 職責：
 *   匯出通用規則內容，供安裝流程和其他工具使用。
 *   核心規則內容與 ~/.claude/rules/ 中的定義同步，但去除語言特定部分。
 */

/**
 * 測試核心規範
 *
 * 通用的測試框架與組織原則。
 * C# 特定框架（xUnit、FluentAssertions）由 ~/.claude/rules/testing.md 透過 paths 條件載入覆蓋。
 */
export const TESTING_CONTENT = `
## 測試架構

- 鏡像 src/ 結構到 tests/ 目錄
- 清楚分離單元、整合、端對端測試
- 以行為命名測試，不要基於實作細節

## 覆蓋率目標

- 目標 80%+ 行覆蓋率
- 重點涵蓋：領域邏輯、驗證、授權、失敗路徑
- 執行測試：node --test 或項目配置的測試指令
`.trim();
