---
"@ab-tao/dotfiles": patch
---

指針品質修正 + html-report 改指標載入 + config-map 校正

v1.20.0 把 `13` / `05` 的細節下放到 `docs/` 後，載入完全依賴指標觸發 —— 而指標失效是靜默的。本版是對該機制的驗證與補強。

**2 條劣質指針改為動詞開頭**

逐條檢查 14 條下放指標，2 條是名詞結尾的「詳見 X」型（沒有任何時刻會讓人想到要去讀它）：`RTK bash 輸出壓縮說明 →` 改為 `bash 輸出過長要壓縮 / 安裝設定 RTK →`；`bypassPermissions：…適用邊界 →` 改為 `…判斷某操作是否落在其適用範圍內時 →`。

**`rules/html-report.md` 由 `paths` 改為指標載入**

本檔 25,846 B（`rules/` 總量 40%），原 `paths: ["**/*.html"]` 無排除 —— 讀到 `node_modules`、build 產物、測試 fixture 裡的任何 HTML 都會整份注入。且它規範的是「產出報告」這個意圖性動作，不是「碰到 HTML 檔」這個附帶事件，`paths` 觸發與語義本就不合。

改用 `CLAUDE.md` 指標載入後實測確認：v1.20.0 新增的 config-lint R2 反向檢查會自動接管保護（刪掉指標行即報「永遠不會被載入」），順帶驗證該檢查是通用的、不是對原本兩個檔寫死。

**`docs/config-map.md` 全面校正**

結構參考的權威文件數字錯了比沒有更糟。實測比對後修正 claude-md 13→12 檔、commands 13→15（補 `pr-watch` 與 `verify`）、hooks 9→15 defs / 17 支 `.sh`、rules 觸發分佈 11+2→10+3，並移除已被 v1.20.0 解決的「R2 掃不到頂層 CLAUDE.md」警語。校對後 claude-md 12 / rules 13 / commands 15 / skills 22 / agents 7 全部與實際相符。
