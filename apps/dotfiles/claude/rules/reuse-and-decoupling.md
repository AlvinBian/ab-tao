---
name: reuse-and-decoupling
description: 復用優先 / DRY 分層抽取 / 解耦 — 不造輪子、職責分層、單向依賴、面向介面、副作用隔離。
paths:
  - "**/*.vue"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/composables/**"
  - "**/stores/**"
---

<reuse_and_decoupling>

## 1. 復用優先（不造輪子）

寫任何共用邏輯前，先按此順序找現成方案，找到即用 / 擴充，不平行造第二套：

1. **codebase 既有**：composable / util / component / store — grep 或 symbol search 先確認
2. **專案已裝套件**：`package.json` 既有依賴能否完成
3. **語言 / 框架標準 API**：原生 JS/TS、Vue/Nuxt 內建 composable
4. **才考慮**新增第三方套件或自寫

- 既有方案 ~80% 符合需求 → **擴充它**，不要另起爐灶
- 新增依賴前一句話說明：為何既有工具不夠（呼應 03 Simplicity First）

## 2. 抽取與分層（DRY，但避免過早抽象）

- **Rule of Three**：相同邏輯出現第 **3** 次才抽；出現 2 次容忍重複 — 錯誤抽象的維護成本高於重複
- **抽取判準**：複製貼上時意識到「改一處必須同步改多處」的風險 → 該抽
- **按職責決定抽到哪一層**：

  | 性質 | 去處 |
  |---|---|
  | 純資料 / 格式轉換、無副作用 | `utils/`（純函式） |
  | 響應式狀態 / 生命週期 / 依賴 Vue API | `composables/`（hook） |
  | 跨元件 / 跨頁面共享狀態 | `store`（Pinia / Vuex） |
  | 可複用 UI | `components/` |
  | 常數 / 列舉 / 設定 | `constants` / `config` |
  | 文案 | i18n（禁寫死，見 04-verification） |

## 3. 解耦（避免過度耦合）

- **單一職責**：一個函式 / 元件 / composable / store 只負責一件事；函式 > 50 行或承擔多職責 → 拆分
- **分層邊界**：元件薄（只管渲染 + 互動）→ 業務邏輯進 composable → 狀態進 store → API 請求集中在 `api` / `service` 層；**元件禁止直接 `fetch` / 寫死 API path**
- **依賴方向單向**：上層 → 下層（page → composable → util）；**禁止反向依賴與循環依賴**；store 不 import 元件
- **面向介面而非實作**：模組間只透過 props / 參數 / 回傳型別通訊，不依賴對方內部結構；改內部實作不應波及呼叫端
- **副作用隔離**：DOM / storage / network / 全域狀態 的操作收斂到邊界層，核心邏輯保持純函式可測
- **封裝最小公開面**：只 export 必要 symbol（呼應 barrel-exports），內部 helper 不外洩

## 4. 反向氣味（出現即停下重新設計）

- 同一段邏輯第 3 次複製貼上 → 抽（§2）
- 元件內直接 `fetch` / 操作 `localStorage` / 寫死 API path → 移到 service / composable（§3）
- 一個函式 > 50 行或一個元件塞多個職責 → 拆分（§3）
- 為傳資料層層 props drilling（≥3 層）→ 改用 provide/inject 或 store
- 巨型元件靠一堆 boolean prop 切換形態 → 拆分或用組合（composable / slot）
- 為「假設性未來需求」預先抽象 → 刪掉，等真的重複再抽（§2 + 03 Simplicity First）

</reuse_and_decoupling>
