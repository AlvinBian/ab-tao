<context_hygiene>

## /compact 壓縮策略

壓縮時**必須保留**：
- 核心需求、硬性約束、API 介面定義
- 當前任務狀態、XML 標籤內所有內容
- 最近 3 輪有效工具輸出

壓縮**可犧牲**：
- 調試輸出、失敗嘗試、已解決的中間問題
- 4 輪以前的工具輸出（保留摘要即可）

## Rewind「Summarize up to here」工作流

Phase 切換點（例：VM Phase 間過渡、功能模塊完成）主動使用 Rewind Summarize：
- 保留當前 Phase 全文
- 壓縮前面 Phase 為摘要

`AUTOCOMPACT_PCT_OVERRIDE=80` 是被動 fallback；Rewind 是主動 surgical 操作，優先使用。

## 條件載入規則

`rules/` 目錄下的 frontmatter `paths:` 規則僅在編輯對應路徑檔案時載入，不要當常駐規則。
冷啟動時若使用者問「有什麼規則」，只回答 always-loaded 部分。

</context_hygiene>
