# cost-routing

啟發式 cost-aware routing hook，依 prompt 長度與任務類型動態選擇模型，在品質與 token 成本之間自動平衡。

## 觸發場景

- 日常短查詢（< 500 tokens）自動路由至輕量模型（Haiku），節省成本
- 複雜架構設計或多檔案分析自動升級至 Sonnet / Opus
- 月底成本超標時，手動切換至 `"static"` 模式鎖定模型，停止動態路由

## Usage

hook 自動運作，無需手動觸發。每次 tool call 前，cost-router 評估 prompt context 長度並選擇模型。

```bash
# 查看當前 routing 決策紀錄
cat ~/.claude/.ab-tao/runtime/cost-routing.jsonl | tail -20

# 查看成本摘要（當日 / 當週 / 當月）
pnpm run d:status --cost

# 關閉動態路由（鎖定使用 settings.json 指定的 model）
# 在 settings.json 中設定：
# "model": "claude-sonnet-4-6"  ← 指定要鎖定的模型
# "_abTao": { "costRouting": "static" }
```

`settings.json` 設定選項：

```json
{
  "model": "claude-sonnet-4-6",
  "_abTao": {
    "costRouting": "dynamic",
    "costRoutingThresholds": {
      "haiku": 500,
      "sonnet": 8000,
      "opus": 32000
    }
  }
}
```

`costRouting` 可選值：
- `"dynamic"`（預設）：依 prompt 長度自動選模型
- `"static"`：鎖定使用 `model` 欄位指定的模型，關閉動態路由

路由決策邏輯（以 token 數為閾值）：
- context < 500 tokens → Haiku
- 500 ≤ context < 8,000 tokens → Sonnet
- context ≥ 8,000 tokens → Opus
- 含 `architect` / `adversarial` 任務 → 強制 Opus（忽略 token 數）

## Troubleshoot

**動態路由選了 Haiku 但回答品質不佳**
降低 `costRoutingThresholds.haiku` 閾值（如從 500 降至 200），或在該 session 手動指定模型：`settings.json` 的 `model` 臨時改為 `claude-sonnet-4-6`，同時將 `costRouting` 設為 `"static"`。

**成本仍然偏高（`dynamic` 模式下仍多用 Opus）**
檢視 routing 紀錄：`cat ~/.claude/.ab-tao/runtime/cost-routing.jsonl | grep '"model":"claude-opus'`。若大量 architect/adversarial 任務觸發強制 Opus，考慮減少這類任務的使用頻率。

**`d:status --cost` 顯示無資料**
cost-routing hook 需 session-end hook 配合寫入統計。確認兩者均已啟用：`pnpm run d:hooks --list | grep -E "cost-router|session-end"`。

## Uninstall

```bash
pnpm run d:uninstall --feature cost-router
```

移除後：動態路由停用，Claude 使用 `settings.json` 的 `model` 欄位作為固定模型。已記錄的 cost-routing.jsonl 不受影響。
