/**
 * rule-content.mjs — Rules 核心內容提取
 *
 * 職責：
 *   匯出通用規則內容，供安裝流程和其他工具使用。
 *   核心規則內容與 ~/.claude/rules/ 中的定義同步，但去除語言特定部分。
 */

/**
 * 編碼風格核心規範
 *
 * 通用的編碼風格原則，不含 C# 特定部分。
 * C# 特定規範由 ~/.claude/rules/coding-style.md 透過 paths 條件載入覆蓋。
 */
export const CODING_STYLE_CONTENT = `
## 基本原則

- 優先不可變性：使用 immutable 資料結構，避免 in-place 修改
- 明確 access modifiers：公開 API 必須有明確的存取修飾符
- 保持檔案焦點：一個檔案對應一個主要類型

## 格式化與組織

- 使用專案配置的格式化工具（dotnet format、prettier 等）
- 移除未使用的 imports，組織 using 指令
- 保持表達式簡潔，但優先可讀性

## 非同步與錯誤處理

- 優先 async/await 而非阻塞呼叫（.Result、.Wait()）
- 透過公開 async API 傳遞 CancellationToken
- 丟出具體異常並記錄結構化屬性
`.trim();

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

/**
 * Git 工作流程核心規範
 *
 * 通用的 Git 和 PR 流程標準。
 */
export const GIT_WORKFLOW_CONTENT = `
## Commit 訊息格式

\`\`\`
<type>: <description>

<optional body>
\`\`\`

類型：feat（新功能）、fix（修復）、refactor（重構）、docs（文件）、test（測試）、chore（雜務）、perf（效能）、ci（CI/CD）

## Pull Request 工作流程

1. 分析完整 commit 歷史（不只最新 commit）
2. 使用 \`git diff [base-branch]...HEAD\` 檢視所有變更
3. 撰寫全面的 PR 摘要
4. 包含測試計畫與 TODOs
5. 若新分支需用 \`-u\` 旗標 push
`.trim();
