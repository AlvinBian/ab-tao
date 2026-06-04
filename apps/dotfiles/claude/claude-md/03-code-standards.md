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

## 復用 · 分層 · 解耦（核心原則）

- **不造輪子**：寫共用邏輯前先搜尋既有 composable / util / store；既有方案 ~80% 符合 → 擴充而非另起爐灶
- **按職責分層抽取**：純函式進 utils、響應式邏輯進 composable、共享狀態進 store、可複用 UI 進 component、常數進 config、文案進 i18n
- **解耦**：單一職責 + 依賴方向單向（禁循環依賴）+ 元件薄（API 請求集中 service 層）+ 面向介面而非實作 + 副作用隔離到邊界層

> 完整判準（Rule of Three、抽取去處表、反向氣味清單）→ 編輯 .vue/.ts/.js 時 `rules/reuse-and-decoupling.md` 自動注入。

## 收到代碼的工作流

- **既有代碼**：先分析（說明問題或改進點）→ 確認意圖（修復 / 重構 / 擴充）→ 輸出；禁止直接覆蓋
- **新需求**：確認意圖與範圍 → 需求模糊時主動追問，禁止自行填補假設 → 確認後進入實作

> 程式碼規範細節於編輯對應檔案時自動注入：禁 any / 型別 → `rules/typescript.md`；SSR / 三態 → `rules/vue-nuxt.md`；barrel exports → `rules/barrel-exports.md`；復用 / 解耦 → `rules/reuse-and-decoupling.md`。

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

## 響應式參數設計（Vue composable / hook / helper）

- composable / hook / 共用 helper 的參數若可能是響應式資料，**盡量同時接受 ref / computed / getter / 純值**，內部統一解包，呼叫端免寫 `.value` / `unref()`。
- 解包工具：**Vue 3（3.3+）用 `toValue()`**（同時解 ref / getter / 純值，對應 `MaybeRefOrGetter`）；**Vue 2.7 用 `unref()`**（只解 ref / 純值，無 `toValue`）。
- 型別標註：Vue 3 用 `MaybeRefOrGetter<T>` / `MaybeRef<T>`；Vue 2.7 無穩定匯出時用 union `T | import('vue').Ref<T>`。
- `toValue()` / `unref()` 在 `computed` / `watchEffect` 內存取仍被依賴追蹤，響應性不受影響。
- 例外：純展示元件 props、明確只吃快照的純資料工具；勿為支援響應式而把非 Vue 純函式強行耦合 `vue`。

## 新增方法位置

- 在**既有檔案**新增 function / method 時，一律**追加到檔案最後面**（既有 export 之後），不插入中段，降低 diff 噪音與 review 成本。
- 例外：barrel / `index` re-export 依既有分組擺放；class 內方法依該 class 既有組織慣例。

</code_standards>
