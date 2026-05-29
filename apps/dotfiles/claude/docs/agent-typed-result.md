# Subagent Typed Result 規範

> 對應 `claude-md/13-agent-orchestration.md § Subagent 回傳結構規範`。
> 啟動 subagent 時必須在 prompt 明確指定 schema，禁止以 prose 回傳後再自行解析。

## 研究 / 探索類

適用：Explore subagent、general-purpose（做 research 用途）

**Schema：**
```json
{
  "findings": [
    {
      "path": "src/composables/useOrder.ts",
      "line": 42,
      "confidence": "✅",
      "summary": "useFetch 封裝，帶 retry 邏輯，第二個 arg 是 options"
    }
  ],
  "conclusion": "一句話：找到了 / 沒找到 / 發現了 X"
}
```

**confidence 三態**：
- `✅` 直接讀過程式碼 / 有官方文件佐證
- `⚠️` 合理推斷 / 版本相近類比
- `❓` 直覺 / 需使用者確認

**Prompt 模板：**
```
...（任務描述）...

請以下列 JSON 結構回傳，不要加 prose 說明：
{
  "findings": [{"path", "line", "confidence": "✅|⚠️|❓", "summary"}],
  "conclusion": "..."
}
```

## 審查類

適用：reviewer、architect、pr-test-analyzer、silent-failure-hunter、type-design-analyzer

**Schema：**
```json
{
  "issues": [
    {
      "severity": "P0",
      "confidence": "high",
      "location": "src/api/order.ts:88",
      "finding": "未處理 network timeout，silent fail",
      "fix": "加 try/catch 並 emit error event"
    }
  ],
  "verdict": "BLOCK"
}
```

**severity 定義**：
- `P0` 阻塞上線（data loss / security / 功能壞掉）
- `P1` 強烈建議修（技術債、邊界 case 未處理）
- `P2` 建議改（可讀性、效能）
- `P3` 建議考慮（pure style、nitpick）

**confidence 定義**：
- `high` 確定有問題，有證據
- `medium` 合理懷疑，需確認
- `low` 風格偏好 / 不確定

**verdict 定義**：
- `SHIP` 無 P0/P1，可直接上線
- `BLOCK` 有 P0，必須先修
- `NEEDS-DISCUSSION` 有 P1 或有設計爭議需 trade-off 討論

**Prompt 模板：**
```
...（review 任務描述）...

請以下列 JSON 結構回傳，issues 按 severity 降序排列：
{
  "issues": [{"severity": "P0|P1|P2|P3", "confidence": "high|medium|low", "location", "finding", "fix"}],
  "verdict": "SHIP|BLOCK|NEEDS-DISCUSSION"
}
```

## 執行類

適用：debugger、planner

**Schema：**
```json
{
  "changes": [
    {
      "file": "src/composables/useOrder.ts",
      "before": "const data = await fetch(...)",
      "after": "const { data, error } = await useFetch(...)",
      "verify": "在 /order/:id 頁面確認 error state 有正確顯示"
    }
  ],
  "done": true
}
```

**Prompt 模板：**
```
...（執行任務描述）...

完成後請以下列 JSON 結構回傳：
{
  "changes": [{"file", "before": "改動前關鍵片段", "after": "改動後關鍵片段", "verify": "驗證方式"}],
  "done": true|false
}
若 done=false 請在 changes 後補一行說明阻塞原因。
```

## 與既有 agents/*.md 的對應表

| Agent | 類型 | 用 typed result 時的 schema |
|---|---|---|
| `architect` | 審查類 | issues(P0-P3) + verdict |
| `reviewer` | 審查類 | issues(P0-P3) + verdict |
| `pr-test-analyzer` | 審查類 | issues(P0-P3) + verdict（test coverage）|
| `silent-failure-hunter` | 審查類 | issues(P0-P3) + verdict |
| `type-design-analyzer` | 審查類 | issues(P0-P3) + verdict |
| `debugger` | 執行類 | changes + done |
| `planner` | 執行類 | changes + done |
| `pm` | 研究類 | findings + conclusion（需求釐清結果）|
| Explore subagent | 研究類 | findings + conclusion |

## 注意事項

- 若 subagent 回傳非此格式，**不要自行從 prose 解析**，改為回傳 `{"error": "格式不符", "raw": "..."}`，由主對話決定是否重試
- P0 issue 必須在 verdict=SHIP 的場合解釋為何接受（通常不應出現）
- `before` / `after` 欄位只需包含關鍵片段，不需完整檔案內容
