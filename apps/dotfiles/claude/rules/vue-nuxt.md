---
name: vue-nuxt
description: Vue 3 / Nuxt 3 SSR 規範 — SSR 邊界、資料預取、Hydration、Cookie。
paths:
  - "**/*.vue"
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

<quality_targets>
- Core Web Vitals：LCP < 2.5s、CLS < 0.1、INP < 200ms
- 單一路由 JS bundle < 200KB（gzip 後）
- 圖片必須附帶 lazy loading 與 WebP fallback 方案
- 桌面：Chrome 最新兩版、Safari 16+、Firefox 最新版
- 移動端：iOS Safari 15+、Android Chrome 最新兩版
- 不支援 IE，無需提供 polyfill 方案
</quality_targets>
