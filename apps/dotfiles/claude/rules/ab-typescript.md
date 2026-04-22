---
name: ab-typescript
description: TypeScript 嚴格模式規範 — 型別安全、interface 設計、泛型使用。
paths:
  - "**/*.ts"
  - "**/*.tsx"
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
</typescript_rules>
