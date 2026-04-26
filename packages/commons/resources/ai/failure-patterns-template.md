# failure-patterns.md

> append-only 錯誤模式累積（M3.6.2）
> ADR-002 invariants：規則本體不變 / 僅 cron dedupe 整檔重寫 / lint hook 阻人工編輯 / 1MB archive 紅線
> 最後 dedupe：從未執行
> 模式數量：0

## 使用說明

本文件由 session-end hook 自動 append，**禁止手動編輯**。
每月 cron 執行 `pnpm run c:failure-patterns --dedupe` 進行去重統計。
