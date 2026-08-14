---
description: "跨步驟產品流程 chain：specify → review → verify"
---

# /chain-product <feature-name>

從功能描述到驗證的 3 步完整鏈。

## 步驟

### Step 1：需求結構化
呼叫 `/specify <feature-name>`，產出包含 AC / non-goals 的結構化 spec。

### Step 2：Spec 審查
spawn `reviewer` agent（唯讀），以第二意見角度審查 spec：
- AC 是否可測量
- 範圍是否合理
- 是否有遺漏的 edge case

### Step 3：AC 反查驗證
呼叫 `/verify`，確認 spec 的所有 AC 都有對應的實作驗證點。

## 完成條件
三步全部通過 → 輸出「✅ chain-product 完成：[feature-name] spec 就緒，可進入實作」。
任一步驟有嚴重問題 → 停下並列出具體問題，等待使用者確認後再繼續。

## 使用方式
```
/chain-product 新訂單明細頁
/chain-product user-auth-system
```

## Metrics
每次成功完成時在 `~/.claude/.ab-tao/metrics/metrics.jsonl` 追加：
`{"event":"chain_invocations","chain":"chain-product","feature":"<name>","ts":"<ISO8601>"}`
