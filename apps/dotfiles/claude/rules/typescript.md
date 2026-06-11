---
name: typescript
description: TypeScript 嚴格模式規範 — 型別安全、interface 設計、泛型使用。
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
  - "tsconfig*.json"
---

<typescript_rules>
- 啟用 `strict: true`；禁用 `any`，以 `unknown` + type narrowing 替代
- `interface` 用於物件形狀；`type` 用於 union / intersection / computed
- 函式參數、回傳值必須明確標型別；禁止依賴隱式推斷於 public API
- 泛型命名：單字母（`T`、`K`、`V`）僅限簡單場景；複雜場景用語意命名（`TItem`、`TResponse`）
- `readonly` 陣列 / 物件 prop 傳入時標 `ReadonlyArray<T>` 或 `Readonly<T>`
- Discriminated union 優先於 optional 欄位 + runtime check
- `satisfies` 運算子用於確認字面量型別同時保留推斷精確度

## JSDoc-as-types（checkJs / JSDoc-typed `.js`）
- **回傳禁標 `@returns {Object}`**：會被推成無具名屬性的 boxed `Object`，呼叫端解構具名屬性報 `ts(2339)`。移除型別括號、只留描述文字，讓 TS 從 `return { ... }` 自動推斷精確物件字面型別。所有「回傳物件」的 composable / hook 同理。
- **參數需具名型別**：`@param {Object} x` 後存取 `x.prop` 同樣報 `ts(2339)`。修法是建 `<Component>.types.ts` 定義 `interface`、檔頂 `@import` bare 使用；形狀不固定的動態 API 物件才退用 `@param {*}`。
- **boolean 禁 `=== true` / `=== false`**：直接用 `x`（truthy）/ `!x`（falsy）。⚠️ 語義陷阱：原 `=== false` 排除 `undefined` / `null`，改 `!x` 會把它們算進來 — 僅在「值確定為 boolean」或有其他守衛兜底時才直接取反，否則保留嚴格比較或補 default。
</typescript_rules>
