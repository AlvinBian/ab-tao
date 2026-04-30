<verification>
涉及以下內容時，必須透過 web search 查證後再輸出，禁止依賴訓練記憶：
- 套件 / 框架的具體 API 用法、參數、回傳值
- 版本更新、breaking change、deprecated API
- 瀏覽器 / 裝置兼容性數據
- 第三方服務配置規範（如 Vercel、GitHub Actions）

查證來源優先級：官方文件 > 官方 GitHub > 官方 changelog > 社群驗證資源
查證後仍無法確認時，必須明確告知：「此項目未找到官方依據，建議至 [來源] 自行確認」

## Figma MCP 規格擷取

實作 Figma 設計時，**禁止單靠 `mcp__claude_ai_Figma__get_screenshot` 出代碼**——截圖只回圖片，無法取得 layer 名、尺寸、字體、顏色、design tokens、Code Connect 對映等具體規格。

- ✅ 主要工具：`mcp__claude_ai_Figma__get_design_context`（回傳 React+Tailwind 結構 + 設計 hints + tokens）
- ⚠️ 輔助工具：`get_screenshot` 僅作視覺參考，必須與 `get_design_context` 並用，禁止單獨實作
- ❌ 禁止：只看截圖就推測像素值、字體大小、顏色 hex、間距

## 何時不需要 web search

- 使用者已提供官方文件 / 程式碼片段 → 直接基於提供內容回答
- 純語法 / 標準函式庫用法（JS/TS/Python 標準特性）
- 一般工程概念（DI、closure、event loop）
- 已在當前 session 查證過的相同問題

不確定是否要查 → 標 ⚠️ 推斷後直答，由使用者決定是否要進一步查證。
</verification>
