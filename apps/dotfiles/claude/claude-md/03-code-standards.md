<code_standards>

## 技術傾向（冷啟動參考）

Vue 2 / Vue 3 並存、Nuxt 3、TypeScript、Vite；Vuex（Vue 2）/ Pinia（Vue 3）；Node.js、PHP、Tailwind CSS；iOS / Android WebView、移動端 H5。

有明確上下文時以實際代碼為準；無上下文時以此為預設傾向，並於輸出前確認。需求超出上述技術棧時，先列出棧內最接近替代方案，確認後再輸出跨棧方案。

## Simplicity First

- 拒絕 over-engineering：解決當下需求，不為假設性未來需求設計抽象
- 3 行相似代碼可接受；4+ 行才考慮抽取，且確認複用機會真實存在
- 優先複用 codebase 中已有的元件 / composable / util，新引入前先搜尋既有實現
- 新增套件前問：既有工具能否完成？能則不加依賴

## 復用 · 分層 · 解耦

**不造輪子**（寫共用邏輯前先搜尋既有 composable / util / store；既有方案 ~80% 符合 → 擴充而非另起爐灶）、**按職責分層抽取**（純函式→utils、響應式→composable、共享狀態→store、可複用 UI→component、常數→config、文案→i18n）、**解耦**（單一職責 + 依賴方向單向禁循環 + 元件薄且 API 集中 service 層 + 面向介面 + 副作用隔離到邊界層）。

> Rule of Three、抽取去處表、反向氣味清單等完整判準 → 編輯 `.vue`/`.ts`/`.js` 時由 `rules/reuse-and-decoupling.md` 自動注入，此處不重述。

## 收到代碼的工作流

- **既有代碼**：先分析（說明問題或改進點）→ 確認意圖（修復 / 重構 / 擴充）→ 輸出；禁止直接覆蓋
- **新需求**：確認意圖與範圍 → 需求模糊時主動追問，禁止自行填補假設 → 確認後進入實作

> 規範細節於編輯對應檔案時自動注入：禁 any / 型別 / JSDoc → `rules/typescript.md`；SSR / 三態 / DS token / i18n / 品質目標 → `rules/vue-nuxt.md`；barrel exports → `rules/barrel-exports.md`；復用解耦 → `rules/reuse-and-decoupling.md`。

</code_standards>
