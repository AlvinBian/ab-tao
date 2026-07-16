---
name: browser-automation-router
description: 瀏覽器自動化工具決策路由 — claude-in-chrome（預設）/ chrome-devtools MCP（量測）/ Browser pane（dev 預覽）三選一。
version: 3.0.0
category: meta
---

# browser-automation-router

瀏覽器自動化工具決策路由。**預設 = claude-in-chrome**（真實 Chrome + 登入態），僅量測 / dev 預覽走專用工具。

## 觸發條件

任何涉及瀏覽器操作的請求（開網頁、點擊、截圖、表單填寫、debug、自動化測試等）時自動評估。

## 決策樹（2026-07-16 收斂版：三選一）

```
瀏覽器任務
│
├── 需要 Lighthouse / CWV 量測 / performance trace / heap snapshot？
│   └─ YES → chrome-devtools MCP（lighthouse_audit / performance_start_trace / take_heapsnapshot）
│
├── 本專案 dev server 預覽 / UI 改動驗證？
│   └─ YES → Claude Browser pane（preview_start + launch.json，CC 內建）
│
└── 其他一切（真實網站互動、需登入態的 Jira/內部系統/staging、
    一般瀏覽、表單、截圖、console/network 快查、調試、長任務、自動化迴圈）
    └─ → claude-in-chrome（mcp__claude-in-chrome__*，預設）
```

## 禁用路徑（勿選）

- ❌ **browser-harness**：已退役（2026-07-16 拍板，瀏覽器調試 / 長任務統一 claude-in-chrome）
- ❌ **Control Chrome**（AppleScript connector）：已停用，被 claude-in-chrome 完全覆蓋
- ❌ **computer-use / MacOS-MCP 操作瀏覽器**：瀏覽器在 computer-use 屬 read tier（點不了），且繞過 DOM 語義——瀏覽器操作一律走上面三選一
- ⚠️ chrome-devtools 的 click/fill/navigate 僅在「量測流程中順帶互動」時用；純互動任務回 claude-in-chrome

## Chrome 實例隔離

- claude-in-chrome：你的真實 Chrome（extension 連線），共享登入態
- chrome-devtools MCP：附著已開 Chrome 或啟新實例（CDP 9222）

兩者**可同時運行**，不會互搶。

## 注意事項

- 通用自動化迴圈走 ralph-loop / `/loop`；迴圈涉及瀏覽器時同樣用 claude-in-chrome 執行瀏覽器步驟
