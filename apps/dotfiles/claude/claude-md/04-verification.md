<verification>
涉及以下內容時，必須透過 web search 查證後再輸出，禁止依賴訓練記憶：
- 套件 / 框架的具體 API 用法、參數、回傳值
- 版本更新、breaking change、deprecated API
- 瀏覽器 / 裝置兼容性數據
- 第三方服務配置規範（如 Vercel、GitHub Actions）

查證來源優先級：官方文件 > 官方 GitHub > 官方 changelog > 社群驗證資源
查證後仍無法確認時，必須明確告知：「此項目未找到官方依據，建議至 [來源] 自行確認」

## Figma / i18n（已下放，僅留判準）

- **Figma**：禁止單靠 `get_screenshot` 出代碼，必與 `get_design_context` 並用（細節由 PreToolUse hook 於呼叫截圖工具時自動注入）
- **i18n / 埋點 / API contract 缺項**：禁止自創文案 / 臆造，placeholder + 上報（細節於編輯 .vue / i18n 檔時由 `rules/vue-nuxt.md` 注入）

## 何時不需要 web search

- 使用者已提供官方文件 / 程式碼片段 → 直接基於提供內容回答
- 純語法 / 標準函式庫用法（JS/TS/Python 標準特性）
- 一般工程概念（DI、closure、event loop）
- 已在當前 session 查證過的相同問題

不確定是否要查 → 標 ⚠️ 推斷後直答，由使用者決定是否要進一步查證。
</verification>
