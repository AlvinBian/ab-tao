---
name: check
description: >
  統一構建檢查：構建修復 (Build Fix)、品質閘門 (Quality Gate)、9-gate 完整審查 (--gates)。
  Build Fix — Use when: "build 壞了", "編譯失敗", "build error", "build fix", "構建失敗".
  Quality Gate — Use when: "merge 前", "上線前", "quality check", "品質檢查", "pre-release".
  Full Gates — Use when: "--gates", "9 gate", "完整審查", "production ready".
metadata:
  version: 1.2.0
---

# Check — 構建修復 + 品質閘門 + 9-Gate 完整審查

## Step 0 — 模式偵測

根據使用情境自動選擇模式：

**模式 A — Build Fix**（構建修復）
- 觸發詞：build 壞了、編譯失敗、build error、build fix、構建失敗
- 目標：快速診斷與逐一修復構建錯誤

**模式 B — Quality Gate**（品質閘門）
- 觸發詞：merge 前、上線前、quality check、品質檢查、pre-release
- 目標：上線前五道關卡（build + types + lint + tests + security）

**模式 C — 9-Gate 完整審查**（`--gates` 參數）
- 觸發詞：`/check --gates`、9 gate、完整審查、production ready
- 目標：PR merge 前 9 維度 merge-ready 完整驗證

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

---

## 模式 C — 9-Gate 完整審查（`--gates`）

PR merge 前的完整 merge-ready 驗證。9 道 Gate 全 PASS 才允許 merge。

### Gate 1 — Git 衛生

```bash
git status --short          # 應無未提交修改
git log --oneline -3        # 確認 commit 乾淨
```

- 無未提交的修改（不含 .ab-tao-tdd-skip 等本地跳過檔）
- 每個 commit 都有 Conventional Commits 格式訊息

### Gate 2 — 文件完整性

- PR description 存在且包含：變更動機 + 影響範圍 + 測試方式
- 若新增 API 或 public interface → 對應文件已更新
- 若含 DB migration → migration filename + 執行順序已標明

### Gate 3 — Build

```bash
pnpm build 2>&1 | tail -5
```

無編譯錯誤、無 missing module。

### Gate 4 — Types

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

零 type error；`@ts-ignore` 計為警告不阻塞。

### Gate 5 — Lint

```bash
pnpm lint 2>&1 | tail -10
```

Error 阻塞，Warning 記錄不阻塞。

### Gate 6 — Tests

```bash
pnpm test --run 2>&1 | tail -15
```

覆蓋率 < 80% 視為 FAIL；snapshot 過期視為 FAIL。

### Gate 7 — Security

```bash
pnpm audit --audit-level=high 2>&1 | tail -10
```

CVSS ≥ 7.0（high/critical）阻塞；moderate 記錄警告。

### Gate 8 — 目標驗證

透過 `/verify` command 確認 spec 的每個 acceptance criteria 已被程式碼覆蓋。
若本 PR 無對應 spec 文件 → Gate 8 視為 N/A。

### Gate 9 — UI 與相容性（前端專案）

- 無破壞性 CSS 變更（對照設計稿）
- 無 `window` / `document` 裸存取（SSR 安全）
- 無 hydration mismatch 風險

後端專案 → Gate 9 視為 N/A。

### 9-Gate 輸出格式

```
9-GATE REPORT
────────────────────────────────────────────────────
Gate 1  Git 衛生       [PASS ✅ | FAIL ❌ | N/A ⬜]
Gate 2  文件完整性     [PASS ✅ | FAIL ❌ | N/A ⬜]
Gate 3  Build          [PASS ✅ | FAIL ❌]
Gate 4  Types          [PASS ✅ | FAIL ❌]
Gate 5  Lint           [PASS ✅ | FAIL ❌]
Gate 6  Tests          [PASS ✅ | FAIL ❌]  coverage: XX%
Gate 7  Security       [PASS ✅ | FAIL ❌]
Gate 8  目標驗證       [PASS ✅ | FAIL ❌ | N/A ⬜]
Gate 9  UI & 相容性    [PASS ✅ | FAIL ❌ | N/A ⬜]
────────────────────────────────────────────────────
MERGE-READY: PASS ✅ | FAIL ❌

阻塞項目：
- [Gate N] <具體描述>
```

所有非 N/A 的 Gate 全 PASS → `MERGE-READY: PASS ✅`。
有任一阻塞 → 列出全部阻塞項後輸出 `MERGE-READY: FAIL ❌`。
