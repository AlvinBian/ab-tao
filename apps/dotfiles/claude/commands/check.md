---
name: check
description: >
  統一構建檢查：構建修復 (Build Fix) 與品質閘門 (Quality Gate)。
  Build Fix — Use when: "build 壞了", "編譯失敗", "build error", "build fix", "構建失敗".
  Quality Gate — Use when: "merge 前", "上線前", "quality check", "品質檢查", "pre-release".
metadata:
  version: 1.1.0
---

# Check — 構建修復 + 品質閘門

## Step 0 — 模式偵測

根據使用情境自動選擇模式：

**模式 A — Build Fix**（構建修復）
- 觸發詞：build 壞了、編譯失敗、build error、build fix、構建失敗
- 目標：快速診斷與逐一修復構建錯誤

**模式 B — Quality Gate**（品質閘門）
- 觸發詞：merge 前、上線前、quality check、品質檢查、pre-release
- 目標：上線前全套檢查（build + types + lint + tests + security）

---

## 模式 A — Build Fix（構建修復）

當 build 失敗時執行下列步驟。

### Step 1 — 錯誤收集

```bash
# 依專案類型選擇
npm run build 2>&1 | tail -50
npx tsc --noEmit 2>&1 | head -30
```

### Step 2 — 錯誤分類

| 類型 | 處理 |
|------|------|
| 型別錯誤 | 修正 type annotation / 加 type assertion |
| Import 錯誤 | 修正路徑 / 安裝缺少套件 |
| 語法錯誤 | 修正語法 |
| 配置錯誤 | 修正 tsconfig / vite.config / nuxt.config |

### Step 3 — 逐一修復

1. 按錯誤數量排序，從影響最大的開始
2. 每修一個跑一次 build，確認錯誤數減少
3. 不做額外改動，只修 build 錯誤

### Step 4 — 驗證

```bash
npm run build && echo "✅ Build passed"
npx tsc --noEmit && echo "✅ Type check passed"
```

---

## 模式 B — Quality Gate（品質閘門）

上線前五道關卡全自動執行，任一 FAIL 即阻塞發版。

### Gate 1 — Build

```bash
pnpm build 2>&1 | tail -5
```

確認無編譯錯誤、無 missing module。

### Gate 2 — Types

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

零 type error 才算 PASS，`@ts-ignore` 計為警告不阻塞。

### Gate 3 — Lint

```bash
pnpm lint 2>&1 | tail -10
```

Error 阻塞，Warning 記錄但不阻塞。

### Gate 4 — Tests

```bash
pnpm test --run 2>&1 | tail -15
```

覆蓋率 < 80% 視為 FAIL，snapshot 過期視為 FAIL。

### Gate 5 — Security

```bash
pnpm audit --audit-level=high 2>&1 | tail -10
```

CVSS ≥ 7.0（high/critical）阻塞，moderate 記錄警告。

### 輸出格式

```
QUALITY GATE REPORT
────────────────────────────────────────
Gate 1 Build    [PASS ✅ | FAIL ❌]
Gate 2 Types    [PASS ✅ | FAIL ❌]
Gate 3 Lint     [PASS ✅ | FAIL ❌]
Gate 4 Tests    [PASS ✅ | FAIL ❌]  coverage: XX%
Gate 5 Security [PASS ✅ | FAIL ❌]
────────────────────────────────────────
GATE: PASS ✅ | FAIL ❌

阻塞項目：
- [Gate N] <具體錯誤描述>
```

所有 5 道 PASS 才輸出 `GATE: PASS ✅`，否則列出全部阻塞項目後輸出 `GATE: FAIL ❌`。
