---
name: vue-nuxt
description: Vue 3 / Nuxt 3 SSR 規範 — SSR 邊界、資料預取、Hydration、Cookie。
paths:
  - "**/*.vue"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.sass"
  - "nuxt.config.*"
  - "nuxt.*.ts"
  - "**/composables/**"
  - "**/pages/**"
  - "**/layouts/**"
  - "**/middleware/**"
---

<ssr_nuxt3>
- 禁止在 SSR 階段存取 window / document，必須使用 `import.meta.client` 判斷
- 資料預取統一使用 `useAsyncData` / `useFetch`，禁止在 `setup()` 直接 `await` API
- 動態內容必須使用 `<ClientOnly>` 避免 hydration mismatch
- Cookie 操作統一使用 `useCookie`，禁止手動操作 `document.cookie`
</ssr_nuxt3>

## 三態處理

資料驅動的 UI 必須處理三態：**loading / empty / error**，禁止只渲染 success 路徑。

## Design System Token

KKday DS token `var(--kk-xxx)` **禁止**附加 fallback 預設值（`.vue` / `.css` / `.scss` 的 style 區塊與 inline style 皆適用）：

```css
/* ❌ 禁止 */ background: var(--kk-color-background-surface-lighter, #f9f9f9);
/* ✅ 正確 */ background: var(--kk-color-background-surface-lighter);
```

DS token 由全域統一管理；補 fallback 會靜默遮蔽 DS 更新，導致 UI 與設計規格脫節。

## 響應式參數設計（composable / hook / helper）

- 參數若可能是響應式資料，**盡量同時接受 ref / computed / getter / 純值**，內部統一解包，呼叫端免寫 `.value` / `unref()`。
- 解包：**Vue 3（3.3+）用 `toValue()`**（對應 `MaybeRefOrGetter`）；**Vue 2.7 用 `unref()`**（只解 ref / 純值，無 `toValue`）。
- 型別：Vue 3 用 `MaybeRefOrGetter<T>` / `MaybeRef<T>`；Vue 2.7 無穩定匯出時用 union `T | import('vue').Ref<T>`。
- `toValue()` / `unref()` 在 `computed` / `watchEffect` 內存取仍被依賴追蹤。
- 例外：純展示元件 props、明確只吃快照的純資料工具；勿為支援響應式把非 Vue 純函式強行耦合 `vue`。
