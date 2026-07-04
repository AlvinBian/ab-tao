---
name: browser-automation-router
description: 瀏覽器自動化工具決策路由 — 判斷當前任務應使用 chrome-devtools MCP 還是 browser-harness。
version: 1.0.0
category: meta
---

# browser-automation-router

瀏覽器自動化工具決策路由 — 判斷當前任務應使用 chrome-devtools MCP 還是 browser-harness。

## 觸發條件

任何涉及瀏覽器操作的請求（點擊、截圖、表單填寫、自動化測試等）時自動評估。

## 決策樹

```
瀏覽器自動化任務
│
├── 需要 Lighthouse / performance trace？
│   └─ YES → chrome-devtools MCP（mcp__chrome-devtools__lighthouse_audit）
│
├── 需要 memory snapshot / network 分析？
│   └─ YES → chrome-devtools MCP（take_memory_snapshot / list_network_requests）
│
├── 在當前 Claude Code session 內互動操作（單次、短暫）？
│   └─ YES → chrome-devtools MCP（click / fill / navigate / screenshot）
│
├── 過夜長任務 / 自動化迴圈 / 需要離開 session 繼續跑？
│   └─ YES → browser-harness
│
├── 需要 self-healing（selector 失效自動修復）？
│   └─ YES → browser-harness
│
└── 需要把流程沉澱為可重用 domain helper（KKday 結帳、登入等）？
    └─ YES → browser-harness
```

## Chrome 實例隔離

browser-harness 使用獨立 Chrome profile，與 chrome-devtools MCP 互不干擾：

- chrome-devtools MCP：附著到已開啟的 Chrome 或啟動新實例（CDP port 9222）
- browser-harness：獨立 profile `~/.ab-tao/browser-harness/profile`，CDP port 隨機

兩者**可同時運行**，不會 port 衝突。

## browser-harness 前置確認

使用前確認環境就緒：

```bash
pnpm run c:locals --status   # 確認 browser-harness 狀態
# 若未安裝：
source ~/.ab-tao/browser-harness/.venv/bin/activate
# 詳細安裝步驟：docs/local-tools.md § B. browser-harness
```

## 注意事項

- browser-harness 預設啟用；若不需要可在 d:setup 功能選擇時取消勾選
- ab-tao 已有 ralph-loop / `/loop` skill 處理通用自動化迴圈；只有當迴圈**涉及瀏覽器**時才需要 browser-harness
