<security>
- 禁止 console.log 輸出 token / userId / 敏感欄位；env 統一 .env 分層（development / staging / production）
- API 授權方式依專案而定（JWT / httpOnly Cookie），未說明先問
- 敏感操作（刪除、支付、權限變更）必須二次確認 —— 確認交互協議（二值 [Y/N] / 多值 AskUserQuestion 彈窗、觸發清單、豁免邊界）統一見 §14 confirmation_protocol
- bypassPermissions：禁止主動建議開啟、禁止用於繞過安全 hook；適用邊界 → Read `~/.claude/docs/security-details.md`

## Git 操作紅線（強規則）

### `git commit` / `git push`（三豁免制）
❗ 嚴禁未經授權執行。授權任一即可：① 當前 turn 動作語義（「commit 這個」「push 出去」）② plan frontmatter `autoCommit: true` / CLAUDE.local.md 預先聲明 ③ 自動化迴圈（/loop、ralph-loop、CI agent runs）。
含糊指令（「處理一下」「弄好它」）、task 完成後自行判斷 = **非授權** → 呈現 diff 問「是否 commit / push？[Y/N]」。完整反例清單 → security-details.md。

### `gh pr merge`（硬禁，無豁免）
❌ 任何情境禁止 `gh pr merge` / 開啟 GitHub auto-merge（含 `autoCommit: true` 也不豁免）；merge 唯一方式 = GitHub UI 手動。

> commit / 發 PR / 開分支時 → Read `~/.claude/docs/git-pr-conventions.md`（Conventional Commits、PR title `[TICKET][SSR][PC][M]`、堆疊 PR、分支流程、Wave 串行）

### `gh pr review --approve`（嚴格護欄自動 approve）
6 條件**全部滿足**才自動執行（免二次確認），任一不符 → 退回人工 approve 並說明卡點（禁靜默略過）：

① **verdict = LGTM / SHIP**（無阻斷 finding）—— 僅採信**本輪由自己完成**的 review 結論；禁止以 GitHub `reviewDecision` 聚合值判斷（該值可能來自其他人類 reviewer，不代表自己已審過或已 approve）
② **0 個 P0 / P1**（P2/P3/nit 不算阻斷）
③ **非 deep-tier 敏感路徑**：PR 變更檔案路徑（大小寫不敏感、部分匹配）含以下關鍵字任一 → 一律退回人工，不論 verdict 多乾淨：
   `auth` / `payment` / `billing` / `migration` / `*.sql` / `crypto` / `permissions` / `.env` / `secrets`
④ PR `mergeable ≠ CONFLICTING`（查 `mergeable` / `mergeStateStatus`）
⑤ **CI / status checks 非失敗態**：必要 check 若為 failure/error → 退回人工；`mergeable` 乾淨不代表 CI 綠燈，兩者分開查
⑥ **完成閘門已過且對齊當前 head**：PR 內已留 review 評論並取回連結，且該評論對應的 commit = PR **當前** head sha；approve 前 PR 又 push 新 commit（head 變動）→ 舊評論作廢，須先對新 commit 補留言完成 review 才能 approve

**安全閥（任一觸發即退回人工，優先權高於上述 6 條件全過）**：
- 其他人類 reviewer 對現行 head（或未被後續 commit 明確覆蓋的版本）留有 `CHANGES_REQUESTED` 且未撤銷 → 不自動 approve
- **只 approve 不 merge**；禁止批次 approve（一次僅限當前明確 review 的單一 PR）

### Force push / `--no-verify`
❌ Force push 前必先 `git branch backup/<original>`，禁直接覆蓋上游（任何模式無豁免）
❌ `--no-verify` 僅限使用者明說 hotfix 緊急；自動化迴圈不豁免

## 外部通訊紅線（強規則）

- ❗ **Slack**：嚴禁未經明確指示呼叫任何 Slack 傳送工具。明確指示 = 當前 turn 動作語義（「發送這條 Slack」）或 CLAUDE.md / plan 預先聲明；「通知一下」「讓 XX 知道」「幫我起草」≠ 授權（起草 ≠ 發送）→ 呈現完整草稿問「是否發送至 Slack？[Y/N]」。逐條定義與反例 → security-details.md。
- ❗ **/feedback**：嚴禁主動執行（預設附帶 24h/7d session transcript，含 KKday 內部敏感資料，有外洩風險）。使用者要回報問題 → 先說明附帶內容 → 明確確認後才執行。細節 → security-details.md。
</security>
