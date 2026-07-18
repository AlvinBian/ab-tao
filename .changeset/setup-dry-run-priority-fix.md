---
'@ab-tao/dotfiles': patch
---

修復 d:setup --dry-run 非 TTY 下被自動 Quick 降級掛死 + 清除 2 個空氣開關

**setup.mjs（bug fix）**
- 根因：非 TTY 環境自動降級 flagQuick=true 後，Quick 分支仍呼叫 `runLegacyCheckIfNeeded()`→`runUpgrade()` 跳出互動 `p.select`（無 dry-run/TTY 保護），非 TTY 下 stdin 立即 EOF 形同掛死；衝突警告也誤把「自動降級」當「使用者明確衝突」，印出誤導訊息
- 修法：拆 `explicitQuick`（使用者是否真的打了 `--quick`）與 `flagQuick`（含自動降級）；dry-run 時 `runLegacyCheckIfNeeded()` 只回報偵測結果、不進互動 select；衝突警告改判 `explicitQuick && flagDryRun`
- 新增 `setup-dry-run.test.mjs`：子行程 timeout 迴歸測試，涵蓋非 TTY dry-run 不掛死 + 明確衝突仍警告

**settings 清理**
- `_abTao` 移除 `voiceTrigger`/`skillCreatorEnabled`（config-lint R5 確認全倉庫零消費者，非保留待決）
