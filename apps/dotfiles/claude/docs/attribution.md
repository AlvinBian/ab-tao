# attribution

AI 資源建議溯源報表系統，追蹤各 source 對 skills / commands 使用的 30 天貢獻排行，協助評估 source 訂閱價值。

## 觸發場景

- 月末評估哪些 AI source 實際被使用，決定是否續訂或取消
- 發現某個 skill 頻繁被使用後，追溯其來源以了解背後的 source 生態
- 團隊報告需要展示 AI 工具 ROI 時，匯出 30 天使用分析

> **注意：attribution 目前為 planned feature（M3 CLI 規劃中）**
> 以下命令格式為預留介面，預計於 ab-tao v2.0.0 釋出。

## Usage

```bash
# 產生 30 天 source 貢獻報告
pnpm run c:attribution --report

# 指定時間區間
pnpm run c:attribution --report --from 2026-04-01 --to 2026-04-27

# 輸出 JSON 格式（供外部工具處理）
pnpm run c:attribution --report --format json

# 查看特定 source 的使用明細
pnpm run c:attribution --source gstack --detail

# 匯出 CSV 報告
pnpm run c:attribution --report --format csv > attribution-april.csv
```

報告輸出範例：
```
Attribution Report — 2026-04-01 to 2026-04-27
───────────────────────────────────────────────
Source              Usage Count   Skills Used   Rank
─────────────────────────────────────────────────────
ECC                 142           8             #1
ab-tao built-in     98            12            #2
Anthropic Official  67            4             #3
gstack community    23            3             #4
Superpowers         5             1             #5
───────────────────────────────────────────────────
Total tool calls:   335
Most used skill:    /test (47 calls, source: ECC)
Least used source:  Context-Engineering (0 calls)
```

## Troubleshoot

**執行命令後收到「Feature not yet available」**
此為預期行為。attribution 為 M3 計劃功能，於 ab-tao v2.0.0 釋出。目前可透過 `~/.claude/.ab-tao/runtime/cost-routing.jsonl` 手動分析 skill 使用頻率（不含 source attribution）。

**報告顯示 0 usage 但確定有使用**
attribution 依賴 session-end hook 寫入使用紀錄。確認 hook 已啟用：`pnpm run d:hooks --list | grep session-end`。

**不同時間區間報告加總不等於總數**
attribution 以 session 為單位統計，跨 session 的同一工具計為多次。此為設計行為。

## Uninstall

```bash
pnpm run d:uninstall --feature attribution
```

移除後：`c:attribution` 命令停用；已累積的使用紀錄（`~/.claude/.ab-tao/runtime/attribution.jsonl`）不自動刪除。
