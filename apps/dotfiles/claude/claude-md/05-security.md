<security>
- 禁止 console.log 輸出 token / userId / 敏感欄位（完整例舉見 `docs/security-details.md`）；env 統一 .env 分層
- API 授權方式依專案而定（JWT / httpOnly Cookie），未說明先問
- 敏感操作（刪除、支付、權限變更）必須二次確認 —— 確認交互協議見 §14
- **禁止主動修改**：`~/.claude/memory/`、`projects/`（使用者私有資料）、`settings.json`（ab-tao d:setup 管理）、`.ab-tao/state.json`。禁改意圖＝禁止重整/刪除既有記憶樹，正常記憶寫入不在此限；已有 `pre-tool-edit.sh` 路徑攔截 backstop
- bypassPermissions：禁止主動建議開啟、禁止用於繞過安全 hook；適用邊界 → Read `~/.claude/docs/security-details.md`

## Git 操作紅線（強規則）

### `git commit` / `git push`（三豁免制）
❗ 嚴禁未經授權執行。授權任一即可：① 當前 turn 動作語義（「commit 這個」「push 出去」）② plan frontmatter `autoCommit: true` / CLAUDE.local.md 預先聲明 ③ 自動化迴圈（/loop、ralph-loop、CI agent runs）。
含糊指令（「處理一下」「弄好它」）、task 完成後自行判斷 = **非授權** → 呈現 diff 問「是否 commit / push？[Y/N]」。完整反例清單 → security-details.md。

### `gh pr merge`（硬禁，無豁免）
❌ 任何情境禁止 `gh pr merge` / 開啟 GitHub auto-merge（含 `autoCommit: true` 也不豁免）；merge 唯一方式 = GitHub UI 手動。

### GitHub 存取：讀寫分離閉環
**讀**（查檔 / 搜尋 / 看 PR）→ 走 **GitHub MCP，server 必須帶 `--read-only`**（寫入工具根本不出現在 tool list，比逐條 deny 可靠）。token 用 `gh auth token` 產生，**不另開 PAT**。
**寫**（開 PR / push / commit）→ 走 **`gh` CLI**，受上方三豁免制 + `pre-tool-bash.sh` 管。
❗ `gh api -X|--method PUT/POST/DELETE/PATCH` 已由 hook 硬擋（GraphQL 走 POST 故設例外）；`gh repo delete` 一併硬擋。
> 為何不逐條 deny、flag 優先級的完整論證 → 調整 GitHub MCP 設定時 Read `~/.claude/docs/security-details.md`。

### `gh pr review --approve`（嚴格護欄自動 approve）
先跑 `scripts/pr-auto-approve-check.sh <PR>` 取 `{eligible, blockers}`——false 直接退回人工。**6 條件全部滿足**才自動執行（免二次確認），任一不符 → 退回人工並說明卡點（禁靜默略過）：

① verdict = LGTM / SHIP，且**僅採信本輪由自己完成**的 review 結論（禁用 GitHub `reviewDecision` 聚合值判斷）
② 0 個 P0 / P1
③ **非敏感路徑**：變更檔案路徑（大小寫不敏感、部分匹配）含以下任一 → 一律退回人工，不論 verdict 多乾淨：
   `auth` / `payment` / `billing` / `migration` / `*.sql` / `crypto` / `permissions` / `.env` / `secrets`
④ `mergeable ≠ CONFLICTING`
⑤ CI / status checks 非失敗態（與 `mergeable` 分開查）
⑥ PR 內已留 review 評論，且該評論對應的 commit = PR **當前** head sha

**安全閥（優先權高於上述 6 條件全過）**：其他人類 reviewer 對現行 head 留有未撤銷的 `CHANGES_REQUESTED` → 不自動 approve；**只 approve 不 merge**；禁止批次 approve。

### Force push / `--no-verify`
❌ Force push 前必先 `git branch backup/<original>`，禁直接覆蓋上游；`--no-verify` 僅限使用者明說 hotfix 緊急，自動化迴圈不豁免。
> `rm -rf` / force push / `--no-verify` 已由 `hooks/pre-tool-bash.sh` 確定性攔截；deny 僅鎖字面量 `rm -rf /` 與 `rm -rf ~`，廣義防護靠 hook 正則、可被改寫繞過，非強保證。

## 外部通訊紅線（強規則）

❗ **Slack / 任何對外發送——按內容性質分級**：

- **結論性／總結性訊息**（進度回報、結果總結、公告、任何自行組織的自由文本對外訊息）→ **發送前一律呈現完整草稿、由使用者親自確認（[Y]）後才可發送**；「發送這條 Slack」「給出總結」等動作語義只授權進入草稿流程，**不豁免草稿確認**。**唯一豁免 = 當前 turn 明確標示「直接發送」** → 逐字照稿直發＋事後回讀驗證。
- **Review 工作流產物** → **可直接發送、免逐則確認**：GitHub PR review 評論、`gh pr review` 提交（auto-approve 仍受上方 6 條件護欄）、review 對應 Slack thread 的**四階段固定格式單行回報**（S1 接手 `👀` ／ S2 阻塞 `⚠️` ／ S3 自動修 nit `🔧` ／ S4 結論 `✅`｜`💬`）。❗ **S1 時效最高**：收到 Slack review 請求、抓到 PR 連結後**立即發**，先於任何 review 動作。
- 分類拿不準 → **一律當結論性處理**。「通知一下」「讓 XX 知道」「幫我起草」≠ 授權（起草 ≠ 發送）。
> 四階段完整格式字串、逐條定義與反例 → 執行 PR review 並需回報 Slack 時 Read `~/.claude/docs/agent-review-workflow.md` 與 `docs/security-details.md`。

❗ **/feedback**：嚴禁主動執行（預設附帶 24h/7d session transcript，含 KKday 內部敏感資料）。使用者要回報問題 → 先說明附帶內容 → 明確確認後才執行。

> `settings.json` `permissions.deny` 另有 infra-destroy／publish 類規則（`terraform/pulumi/cdk destroy`、`docker compose down -v`、`npm/pnpm publish` 等），完整清單直接讀 `settings.json`；deny 為 union 合併，移除須雙邊手動。
</security>
