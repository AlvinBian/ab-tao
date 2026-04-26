# config-map-v160

v1.6.0 新增的所有設定路徑彙整，作為升級後快速定位新設定位置的參考文件。

## 觸發場景

- 升級至 v1.6.0 後，確認哪些新目錄和設定欄位已正確建立
- 排查 v1.6.0 新功能異常時，快速定位對應的設定路徑
- 閱讀 `config-map.md`（整體架構）的補充，專注於 v1.6.0 新增部分

## Usage

```bash
# 驗證 v1.6.0 所有新增路徑是否存在
pnpm run c:validate --checklist v160 --tier core

# 查看 state.json 新增區段
cat ~/.claude/.ab-tao/state.json | python3 -m json.tool | grep -A5 "federatedMemory\|failurePatterns\|intentCache"

# 列出 .ab-tao/ 新增的 runtime 目錄
ls ~/.claude/.ab-tao/runtime/
ls ~/.claude/.ab-tao/corrections/
ls ~/.claude/.ab-tao/memory/federated/
```

## `~/.claude/.ab-tao/` 新增的 7 個子目錄

| 子目錄 | 用途 | 對應功能 |
|--------|------|---------|
| `runtime/` | 執行期暫存資料（intent-cache / chain-state / cost-routing） | ai-dispatcher / chains / cost-routing |
| `runtime/intent-cache.json` | 意圖映射 cache，30 天 TTL | ai-dispatcher |
| `runtime/chain-state.json` | chain command 中斷恢復狀態 | chains |
| `runtime/cost-routing.jsonl` | 模型路由決策紀錄（append-only） | cost-routing |
| `corrections/` | 自我演進資料目錄 | failure-catalog |
| `corrections/failure-patterns.md` | append-only 錯誤模式累積 | failure-catalog |
| `memory/federated/` | 跨專案 memory pointer 目錄 | federated-memory |
| `memory/federated/projects.json` | federated source 清單 | federated-memory |

（合計：3 個目錄 + 4 個檔案 = 7 個新增項目）

## `settings.json._abTao` 7 個新增欄位

```json
{
  "_abTao": {
    "version": "1.6.0",
    "costRouting": "dynamic",
    "costRoutingThresholds": {
      "haiku": 500,
      "sonnet": 8000,
      "opus": 32000
    },
    "voiceTrigger": true,
    "voiceTriggerMode": "auto",
    "intentOverrides": {},
    "chainAutoConfirm": false,
    "profile": "day-to-day"
  }
}
```

| 欄位 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `version` | string | `"1.6.0"` | ab-tao 版本標記，供 CI gate 驗證 |
| `costRouting` | `"dynamic" \| "static"` | `"dynamic"` | 模型路由模式 |
| `costRoutingThresholds` | object | 見上 | 動態路由 token 閾值 |
| `voiceTrigger` | boolean | `true` | 語音 prompt rewrite hook 開關 |
| `voiceTriggerMode` | `"auto" \| "always" \| "confirm"` | `"auto"` | rewrite 觸發模式 |
| `intentOverrides` | object | `{}` | 意圖映射覆蓋規則（key: 意圖, value: 命令） |
| `chainAutoConfirm` | boolean | `false` | chain 執行中間步驟是否跳過確認 |
| `profile` | string | `"day-to-day"` | 當前啟用的 profile 名稱 |

## `state.json` 新增的 3 個區段

`~/.claude/.ab-tao/state.json` v1.6.0 schema 新增：

```json
{
  "federatedMemory": {
    "enabled": true,
    "sourcesPath": "~/.claude/.ab-tao/memory/federated/projects.json",
    "lastRefresh": "2026-04-27T10:00:00Z"
  },
  "failurePatterns": {
    "enabled": true,
    "patternsPath": "~/.claude/.ab-tao/corrections/failure-patterns.md",
    "totalEntries": 0,
    "lastDedupe": null
  },
  "intentCache": {
    "enabled": true,
    "cachePath": "~/.claude/.ab-tao/runtime/intent-cache.json",
    "ttlDays": 30,
    "unmatchedCount": 0
  }
}
```

| 區段 | 說明 |
|------|------|
| `federatedMemory` | 第四溫層跨專案 memory 狀態 |
| `failurePatterns` | failure-catalog 統計與路徑 |
| `intentCache` | ai-dispatcher cache 設定與統計 |

## Troubleshoot

**`state.json` 缺少 v1.6.0 新增區段**
執行 `pnpm run d:setup --repair` 嘗試補全。若修復失敗，手動將上述三個區段加入 `state.json`（需符合 `state.schema.json` 定義）。

**`settings.json` 缺少 `_abTao` 欄位**
ab-tao v1.5.x 及以前不含此欄位。執行 `pnpm run d:setup` 升級時會自動注入；若手動管理 `settings.json` 則需手動添加。

**新增目錄不存在（`ls` 找不到 `runtime/` 或 `corrections/`）**
執行 `pnpm run d:setup` 重新建立目錄結構；或手動建立：
```bash
mkdir -p ~/.claude/.ab-tao/{runtime,corrections,memory/federated}
```

## Uninstall

```bash
pnpm run d:uninstall --feature config-map-v160
```

此 feature 為文件功能，uninstall 僅移除 `c:validate --checklist v160` 的 v160 定義；不刪除任何 v1.6.0 建立的目錄或設定檔。
