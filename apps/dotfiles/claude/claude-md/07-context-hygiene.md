<context_hygiene>

## 降噪四層策略

**L0 — Always-loaded**（CLAUDE.md @import chain）：核心身份、語言規則、代碼標準、安全限制、Agent 調度。最高優先級，永遠存在，不可被 /compact 犧牲。

**L1 — Per-session**（自動注入）：當前專案 memory index、active plan、今日任務狀態。壓縮時保留決策結果，丟棄調試過程。

**L2 — Conditional**（`paths:` frontmatter）：框架/語言特定規則（vue-nuxt / typescript / testing / migrations）。只在相關檔案工作時載入，減少冷啟動 token。

**L3 — On-demand**（工具呼叫時）：Skills、docs、agents。遇需求才讀取，不佔冷啟動 context。

## /compact 指令注入

壓縮前優先保留：
- 核心需求、硬性約束、API 介面定義
- 當前任務狀態、XML 標籤內所有內容
- 最近 3 輪有效工具輸出

壓縮可犧牲：
- 調試輸出、失敗嘗試、已解決的中間問題
- 超過 3 條以前的工具輸出摘要

</context_hygiene>
