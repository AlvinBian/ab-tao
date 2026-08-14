---
name: browser-automation-router
description: 瀏覽器自動化工具決策閉環 — 一律走 Google Chrome：本地 dev 預覽用 Browser pane，一般調試/量測預設 chrome-devtools MCP，真實登入態退回 claude-in-chrome。三選一收斂版，不涉入任何非 Chrome 瀏覽器。
version: 6.0.0
category: meta
---

# browser-automation-router

瀏覽器自動化工具決策閉環（2026-08-04 收斂）。**目標瀏覽器一律 Google Chrome**，不涉入 Tabbit / Arc / Edge 等任何非 Chrome 瀏覽器。三個角色各司其職，不重疊、不留空隙：

| 角色 | 工具 | 何時用 |
|---|---|---|
| 一般調試 / 量測（**預設**） | **chrome-devtools MCP** | 所有瀏覽器任務的起點——互動、console/network、Lighthouse、performance trace、heap snapshot |
| 真實登入態退回 | **claude-in-chrome** | chrome-devtools MCP 的 profile 沒有你要的登入態，且任務就是要「以你的身分」操作 |
| 本地 dev 預覽 | **Browser pane**（Claude Code 內建） | 驗證自己專案的改動、開本機 dev server |

## 觸發條件

任何涉及瀏覽器操作的請求（開網頁、點擊、截圖、表單填寫、debug、自動化測試等）時自動評估。

## 決策樹

```
瀏覽器任務（目標一律 Google Chrome）
│
├── 本專案 dev server 預覽 / 驗證自己剛寫的改動？
│   └─ YES → Browser pane（preview_start + launch.json，Claude Code 內建，零安裝）
│
└── 其餘一切（一般瀏覽、互動、debug、量測、外部網站、自動化迴圈）
    │
    └─ → chrome-devtools MCP（預設起點）
        │
        └── 任務要求「以使用者身分」操作真實已登入帳號
            （Gmail/Notion/內部系統等），且 chrome-devtools MCP
            自己的 profile 沒有那個登入態？
            └─ YES → claude-in-chrome（僅此情境才退回，
                      前提是它本身可用，見下方已知限制）
```

## 已知限制（誠實記錄，勿隱藏）

- **chrome-devtools MCP 預設不是你的真實 Chrome 登入態**：用自己的持久化 profile（`~/.cache/chrome-devtools-mcp/chrome-profile-$CHANNEL`）或全新乾淨實例，跟你日常 Chrome 是分開身分。純技術互動、量測、大部分 debug 場景不受影響；真的需要已登入的真實帳號才退回 claude-in-chrome。
- **claude-in-chrome 近期不穩定**：2026-07 起多次遇到「安全分類器暫時離線」導致整個 `mcp__claude-in-chrome__*` 命名空間打不開（連 `tabs_context_mcp` 都失敗；2026-08-04 再次實測重現——`list_connected_browsers` 這類唯讀呼叫通得過，但任何操作分頁的呼叫都被擋在執行之前）。這是後端暫時性故障，非本機配置問題，也非 claude-in-chrome 本身壞掉——遇到時重試或等恢復，不要因此切換到不適合的工具硬做（例如拿 chrome-devtools MCP 硬做需要真實登入態的任務）。
- **Browser pane 明確不共用真實登入態**（官方文件原文）：乾淨 profile，跟本地 dev 預覽以外的任務無關。

## 禁用路徑（勿選）

- ❌ **非 Chrome 瀏覽器（Tabbit / Arc / Edge / Brave / Vivaldi…）**：2026-08-04 拍板全部移出路由——瀏覽器調試一律在 Google Chrome 上做，不再為單一瀏覽器維護專用 MCP 或 profile 複製方案。使用者若明確要求調某個非 Chrome 瀏覽器，先說明此規則並確認，不自行接回。
- ❌ **computer-use / MacOS-MCP 操作瀏覽器**：瀏覽器在 computer-use 屬 read tier（點不了），且繞過 DOM 語義——瀏覽器操作一律走上面三選一

## 為什麼不再收其他方案（2026-07-23 補漏調研後的判斷）

調研過 26 個「AI 操控瀏覽器」方案（Amazon Nova Act、Lightpanda、Firecrawl MCP、Chrome MCP Server 等），確認沒有整類遺漏，但刻意不加進日常路由——它們解決的是這裡沒有的需求（AWS 生產無人值守流程、大量批次爬蟲、開源版 claude-in-chrome 替代品），加了只是重複造輪子，違反 Simplicity First。真的出現對應需求時再評估，不預先納入。

## 注意事項

- 通用自動化迴圈走 ralph-loop / `/loop`；迴圈涉及瀏覽器時同樣走上面決策樹，預設 chrome-devtools MCP，需要登入態才退回 claude-in-chrome
