<code_standards>

## 技術傾向（冷啟動參考）

- Vue 2 / Vue 3（並存）、Nuxt 3、TypeScript、Vite
- Vuex（Vue 2 專案）/ Pinia（Vue 3 專案）
- Node.js、PHP、Tailwind CSS
- iOS / Android WebView、移動端 H5

有明確上下文時以實際代碼為準；無上下文時以此為預設傾向，並於輸出前確認。
需求超出上述技術棧時，先列出棧內最接近替代方案，確認後再輸出跨棧方案。

## 版本管理

涉及 Vue 2/3、Vuex/Pinia、Options/Composition API、PHP/Laravel 版本差異時：
- 優先從 `package.json`、`nuxt.config.ts` 等自動判斷
- 無法判斷時**停止並詢問**，禁止假設
- 禁止版本未確認即輸出版本特定 API，禁止混用不同版本語法
- 推斷時標註：「以下基於上下文推斷，請確認是否符合實際專案」
- 版本特定 API 代碼頂部標註：`// Requires: Vue 3.x / Nuxt 3.x`

## 程式碼規範

1. 完整性：完整可運行代碼，含 import、interface、類型定義，不丟失上下文
2. 類型安全：TypeScript 嚴格 interface/type，禁用 any，優先泛型
3. 異常處理：內建完整錯誤處理與 loading / empty / error 三態
4. 依賴管理：不隨意引入新套件；若必須引入，需說明版本、理由、優缺點與風險
5. 禁止輸出：demo 代碼、過時 API、有安全漏洞的實現、邏輯不完整的片段
6. API 規範：統一回傳 `{ code, message, data }`；分頁統一使用 cursor-based
7. 模組導出 / 引入：資料夾統一以 barrel 入口檔 re-export，外部禁止 deep import — 詳見 `rules/barrel-exports.md`

## Simplicity First

<!-- 來源：Karpathy LLM Coding Principles 缺項補充（Think Before Coding / Goal-Driven Execution 已內建於 15-§2/§5）-->
- 拒絕 over-engineering：解決當下需求，不為假設性未來需求設計抽象
- 3 行相似代碼可接受；4+ 行才考慮抽取，且確認複用機會真實存在
- 優先複用 codebase 中已有的元件 / composable / util，新引入前先搜尋既有實現
·- 新增套件前問：既有工具能否完成？能則不加依賴

## 收到代碼的工作流

- **既有代碼**：先分析（說明問題或改進點）→ 確認意圖（修復 / 重構 / 擴充）→ 輸出；禁止直接覆蓋
- **新需求**：確認意圖與範圍 → 需求模糊時主動追問，禁止自行填補假設 → 確認後進入實作


</code_standards>
