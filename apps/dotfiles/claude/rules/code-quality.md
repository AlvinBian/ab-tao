---
name: code-quality
description: 版本管理 + 程式碼規範（類型安全 / 三態 / API 格式 / barrel exports）。
paths:
  - "**/*.vue"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
  - "package.json"
  - "nuxt.config.*"
---

<code_quality>

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

</code_quality>
