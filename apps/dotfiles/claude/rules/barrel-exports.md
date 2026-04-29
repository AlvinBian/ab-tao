---
name: barrel-exports
description: 模組 barrel 統一規範 — 資料夾入口 re-export、外部禁 deep import、漸進落實。
paths:
  - "**/*.vue"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
---

<barrel_exports>

## 統一導出

1. **子資料夾必有 barrel 入口檔**：re-export 該層所有 public symbol
2. **父資料夾 barrel**：re-export 所有子資料夾入口 + 自身 root-level 模組
3. **既有 default export 保留**：追加 named export，不破壞舊呼叫端，外部逐步切換到 named

## 統一引入

4. **外部消費者只從資料夾根 import**：路徑指向 barrel 入口，禁止 deep import 至資料夾內部具體成員
5. **資料夾內部 cross-import 用相對路徑**（`./` / `../`）：避免迴繞 barrel 觸發 circular dep

## 適用範圍

6. **適用對象**：可被外部 reuse 的邏輯封裝模組 — 元件、hook / composable、helper / utility、常數、type 等
   **不適用**：page / route entry、CLI / app entrypoint、純 config leaf 檔（本身就是末端 node）

## 遷移策略

7. **touch 即轉**：只在當次任務碰到的資料夾執行 barrel 化；禁止主動發起跨資料夾大規模 codemod；入口檔語言形式由當前專案技術棧自然決定，不在規則中固定

</barrel_exports>
