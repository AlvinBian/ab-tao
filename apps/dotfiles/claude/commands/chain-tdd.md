---
description: "跨步驟 TDD 流程 chain：specify → architect 測試骨架 → tdd-strict check → verify"
---

# /chain-tdd <feature-name>

測試驅動開發的 4 步 chain。

## 步驟

### Step 1：需求結構化
呼叫 `/specify <feature-name>`，產出 AC 列表。

### Step 2：測試骨架設計
spawn `architect` agent，設計：
- 單元測試檔案結構（test file names + describe blocks）
- 關鍵測試案例（happy path / edge cases / error cases）
- mock 策略

### Step 3：TDD 模式驗證
呼叫 `/check --tdd-strict`，確認：
- 測試先於實作（red-green-refactor）
- 測試覆蓋所有 AC

### Step 4：AC 覆蓋驗證
呼叫 `/verify`，確認所有 AC 都有對應測試案例。

## 完成條件
四步全部通過 → 輸出「✅ chain-tdd 完成：[feature-name] 測試骨架就緒」。

## 使用方式
```
/chain-tdd user-profile-update
/chain-tdd payment-validation
```

## Metrics
`{"event":"chain_invocations","chain":"chain-tdd","feature":"<name>","ts":"<ISO8601>"}`
