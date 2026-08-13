---
name: test
description: >
  單元測試生成與覆蓋率分析，自動偵測框架並載入對應測試模式。
  Use when: "寫測試", "unit test", "加測試", "補測試", "coverage", "覆蓋率", "測試覆蓋", "哪裡沒測", "test coverage".
model: sonnet
effort: medium
metadata:
  version: 1.0.0
matchWhen:
  skills: ["vitest", "jest", "phpunit", "pytest", "go"]
---

# 測試生成與覆蓋率分析

## Step 1 — 框架偵測

分析專案配置檔（package.json / go.mod / Podfile 等），偵測：
- 語言：TypeScript / JavaScript / PHP / Swift / Go / Python
- 測試框架：Vitest / Jest / PHPUnit / XCTest / Go test / pytest

## Step 2 — 模式偵測

根據輸入意圖選擇對應模式：

| 模式 | 觸發詞 | 目標 |
|------|--------|------|
| **模式 A - 生成** | "寫測試", "unit test", "加測試", "補測試" | 編寫新的測試案例 |
| **模式 B - 覆蓋率** | "coverage", "覆蓋率", "測試覆蓋", "哪裡沒測" | 分析與改善測試覆蓋率 |

---

## 模式 A — 測試生成

### 測試類型

| 類型 | 說明 |
|------|------|
| ✅ 正向 | Happy path，預期行為 |
| ❌ 反向 | 錯誤輸入、例外處理 |
| 🔲 邊界 | null / empty / 極值 |

### 編寫規範

檔案放原始碼旁（同目錄或 `__tests__/`），每個 `describe` / test class 對應一個 export / method。

> 命名語言、覆蓋率條數（happy path + ≥2 edge case + 1 error path）、Mock 政策、runner 選型等完整規範
> **不在此重述**：編輯 `*.test.*` / `*.spec.*` / `__tests__/` 時由 `rules/testing.md` 自動注入，且比本處完整。

### 執行驗證

執行測試確認全部通過，無 skip / pending。

---

## 模式 B — 覆蓋率分析

### Step 1 — 產生覆蓋率報告

```bash
# Vitest
npx vitest --coverage --reporter=json

# Jest
npx jest --coverage --json
```

### Step 2 — 分析低覆蓋

找出覆蓋率 < 80% 的檔案，按業務重要性排序：
1. API 路由 / 控制器
2. 業務邏輯 / 服務層
3. 工具函數
4. UI 組件

### Step 3 — 補測試

針對低覆蓋的函式，按 TDD 原則補測試：
- 正向：happy path
- 反向：error handling、invalid input
- 邊界：null、empty、極值
