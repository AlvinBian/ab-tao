<code_standards>

## 技術傾向（冷啟動參考）

- Vue 2 / Vue 3（並存）、Nuxt 3、TypeScript、Vite
- Vuex（Vue 2 專案）/ Pinia（Vue 3 專案）
- Node.js、PHP、Tailwind CSS
- iOS / Android WebView、移動端 H5

有明確上下文時以實際代碼為準；無上下文時以此為預設傾向，並於輸出前確認。
需求超出上述技術棧時，先列出棧內最接近替代方案，確認後再輸出跨棧方案。

## Simplicity First

- 拒絕 over-engineering：解決當下需求，不為假設性未來需求設計抽象
- 3 行相似代碼可接受；4+ 行才考慮抽取，且確認複用機會真實存在
- 優先複用 codebase 中已有的元件 / composable / util，新引入前先搜尋既有實現
- 新增套件前問：既有工具能否完成？能則不加依賴

## 收到代碼的工作流

- **既有代碼**：先分析（說明問題或改進點）→ 確認意圖（修復 / 重構 / 擴充）→ 輸出；禁止直接覆蓋
- **新需求**：確認意圖與範圍 → 需求模糊時主動追問，禁止自行填補假設 → 確認後進入實作

> 版本管理 / 程式碼規範細節（禁 any、三態、barrel exports 等）→ 編輯 .vue/.ts 時 `rules/code-quality.md` 自動注入。

## Design System Token 規範

使用 KKday DS token 時，`var(--kk-xxx)` **禁止**附加 fallback 預設值：

```css
/* ❌ 禁止 */
background: var(--kk-color-background-surface-lighter, #f9f9f9);

/* ✅ 正確 */
background: var(--kk-color-background-surface-lighter);
```

DS token 由全域統一管理；補 fallback 會靜默遮蔽 DS 更新，導致 UI 與設計規格脫節。
適用範圍：所有 `.vue` / `.css` / `.scss` 的 style 區塊與 inline style。

## JSDoc 規範

開發時盡量補全完整 JSDoc 註釋：

**必須加**：公開函式 / composable / utility、複雜邏輯、公開 `interface` / `type`、回傳值語義不明確的函式

**標準格式**：
```ts
/**
 * 一句話說明函式用途（繁體中文）。
 *
 * @param paramName - 參數說明
 * @returns 回傳值說明
 * @throws {ErrorType} 觸發條件（若會拋錯）
 * @example
 * const result = myFn('input') // => 'output'
 */
```

**規則**：`@param` 與 `@returns` 每個都要補；TS 類型已宣告時可省略類型括號 `{Type}`；優先說明「為什麼 / 什麼時候用」，不重複函式名稱已表達的資訊。

**可省略**：自說明的簡單 getter/setter、框架生命週期鉤子、單行 arrow function。

</code_standards>
