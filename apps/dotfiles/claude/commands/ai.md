---
description: "rule-based 意圖 dispatcher：自然語言輸入 → 對應命令導航"
---

# /ai <intent>

將自然語言意圖映射到對應命令或工具。

## 使用方式

```
/ai PR review
/ai 釐清需求
/ai TDD 流程
/ai 找 skill
```

## 執行邏輯

1. **讀取意圖映射表**：載入 `~/.claude/.ab-tao/runtime/intent-cache.json`（若不存在，使用預設 seed）
2. **Fuzzy 匹配**：對輸入做字串包含匹配（case-insensitive），找最佳命中
3. **命中**：顯示「將執行：[命令]，是否繼續？[Y/N]」，等待確認後執行
4. **未命中**：顯示「未找到匹配意圖，可用意圖：[列表前 10 筆]」，並 append 到 unmatched log
5. **Metrics 追蹤**：追加 `{"event":"dispatcher_invoke","matched":<bool>,"intent":"<input>","ts":"<ISO>"}`

## 未命中行為

未命中的意圖 append 到 `~/.claude/.ab-tao/runtime/unmatched-intents.jsonl`：
```json
{"intent": "<input>", "ts": "<ISO8601>", "session": "<session-id>"}
```

當 `unmatched-intents.jsonl` 累積 ≥ 30 條時，執行 `/ai` 會顯示警告：
「⚠️ 未匹配意圖已達 30 條，建議執行 `pnpm run c:metrics --upgrade-readiness` 評估是否升級 dispatcher。」

## 可用意圖快查

| 意圖關鍵詞 | 映射命令 |
|---|---|
| PR review / 審查 PR | `/verify` |
| 釐清需求 / 寫 spec | `/specify` |
| TDD 流程 | `/chain-tdd` |
| 產品流程 | `/chain-product` |
| 找 skill | find-skills skill |
| 部署計畫 | deploy-plan skill |
| 切 profile | `d:profile` |
| 品質檢查 | `/check --gates` |

完整映射表：`~/.claude/.ab-tao/runtime/intent-cache.json`

完整 intent 說明與 30+ 映射條目：`@docs/ai-dispatcher.md`

## 擴充意圖

直接編輯 `~/.claude/.ab-tao/runtime/intent-cache.json` 的 `intents` 物件加入自訂映射。

v1.7+ 升級條件：unmatched-intents.jsonl ≥ 30 條 + 同一意圖重複 ≥ 3 次。
