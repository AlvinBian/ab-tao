---
name: pr-watch
description: >
  全局 PR review 閉環：追蹤「你明確登記」的 PR（給連結或發含 PR 連結的 Slack 求 review 訊息），
  偵測新留言/新 commit/CI 變化，自動改碼修 nit 並 push、自動 re-review + re-approve、固定格式 Slack 回報。
  不做跨 repo 全域自我發現，只處理你主動交付的 PR。
  Use when: "/pr-watch", "追蹤 PR", "追蹤這個 PR", "盯 PR", "PR 閉環", "review 閉環", "/loop pr-watch",
  "停止監聽", "停止追蹤", "別盯了", "不用追了", "繼續追", "現在在追哪些 PR", "pr-watch 狀態"
argument-hint: "[--dry-run] [list|off|resume|pause <PR>|forget <PR>] [<PR連結或Slack訊息連結>]"
metadata:
  version: 2.2.0
---

# /pr-watch — 全局 PR Review 閉環（單輪執行）

> 設計依據：`~/.claude/plans/humming-mixing-parnas.md`。本檔是 `/loop 20m /pr-watch` 每輪呼叫的 actor body，
> 單次執行即結束（不含 loop 本身，喚醒由 `/loop` 原生指令負責）。
>
> **v2 修訂**：移除 v1 的跨 repo 自我發現（`gh search prs --author/--reviewed-by/--review-requested @me`）。
> 追蹤範圍改為**明確登記制**——只處理你給我連結、或我幫你發的求 review Slack 訊息裡的 PR，不主動掃描你所有 open PR。
> 理由：自我發現會撈進大量與本次意圖無關的陳年/掛名 PR（v1 實測撈出 19 個「待審但我可能根本不在乎」的 PR），
> 範圍不受控；登記制讓「要追蹤什麼」永遠對應你的一個明確動作。

## 執行前必讀（紅線，任何情況不可違反）

1. **⑥ head 對齊**：approve/re-approve **前**必重新核對「留言時的 commit sha == 當前 headRefOid」；head 一變舊評論作廢，須先對新 head 補留言完成 review 才能 approve。
2. **`gh pr merge` 永遠人工、無豁免**——閉環止於 approve，任何情況不自動 merge、不開 auto-merge。
3. **禁批次 approve**：單輪只 approve 當下明確走完 re-review 的那一個 PR，不可連續對多個 PR approve 而不逐一核對。
4. **Slack 分級 · 四階段固定格式**（單行、回原 `thread_ts`，皆＝review 產物免確認直發；階段表見 `docs/agent-review-workflow.md`）：
   - **S1 接手**（`#PR 👀 已接手，開始 review`）＝**人明確要求時才發**（登記新 PR / 對方 @ 你要求 re-review）；本 loop 自動偵測 `headChanged` 的自發 re-review **不發 S1**，直接走 S4。
   - **S2 阻塞**（`#PR ⚠️ 卡點，需 …`）＝approve 護欄退回人工、CI 失敗、CONFLICTING、`status:"escalated"` 時發一行，不悶著。
   - **S3 自動修 nit push**（`#PR 🔧 已修 N 項 nit 並 push <短 sha>`）＝**push 完立即發**，不等下一輪結論（對方需知道分支被動過，防 force-push 撞車）。
   - **S4 結論**（`#PR ✅ LGTM（已 approve）` / `💬 N findings` + 連結）＝PR 內評論貼出後發。
   - 任何自由文本彙總/總結＝結論性，須 **[Y]** 確認（唯一豁免＝使用者當前 turn 明講「直接發送」）。
5. **完成閘門**：凡對 PR 有動作 → PR 內至少留 1 條評論並取回連結；Slack 僅指向，不可用 Slack 取代 PR 評論。
6. **§15 loop 偵測**：同一 PR 同一動作連續 3 輪失敗 → 停止對該 PR 的自動動作，registry 標 `status:"escalated"`，摘要中列出卡點，不做第 4 次同向嘗試。
7. **同一時間只掛一個 `/pr-watch` loop**（操作紀律，機器擋不住）：Step 7 的「重讀 + `rev`」只能防止 registry 游標回捲，**擋不住兩個 session 在同一輪對同一 PR 各自完成對外動作**（重複貼評論／重複 push／重複發 Slack）——那些副作用在寫 registry **之前**就已經發生。掛 loop 前一律先 `CronList` 現查（見 Step 0）。
8. **「停」類意圖只由使用者發動**：任何情況下不得自行判斷「應該可以停了」而停輪詢或移除追蹤。系統自動煞車只能用 `dormant`/`escalated`/`waiting_on_others`。理由見 Step 0 分流原則 1。

`--dry-run`：只印出「本輪會做什麼」，不執行任何 Edit / git push / gh review / Slack 發送 / registry 寫入 / CronDelete。用於驗證判斷邏輯。

## 開關介面 — 自動觸發（開，2026-07-22 拍板）

登記本身無對外副作用（只是寫本地 `registry.json`），Claude 應在對話中主動識別以下情境並**直接執行 Step 2 登記，不需使用者明確打 `/pr-watch <連結>`、也不需逐次確認**：

1. **我幫使用者發送了含 GitHub PR 連結的求 review Slack 訊息**（典型如 `agent-review-workflow.md`「發 Slack 求 review」流程、`/slack` 產出的訊息）→ 發送成功、取回連結後，緊接著執行本檔 Step 2。
2. **使用者在對話中提供 PR 連結並表達追蹤意圖**（「追蹤這個」「幫我盯著」「這個 PR 麻煩留意後續」等，不必是精確的 `/pr-watch` 語法）→ 直接執行 Step 2。

**登記完成後套用下方「掛 loop 冪等規則」**確保輪詢掛著。`/loop` 本身綁定當前 session 生命週期（session 結束即停），這點不受此自動化影響。

### 掛 loop 冪等規則（強制）

判斷「這個 session 掛過沒有」**一律以 `CronList` 現查為準，不得靠記憶或對話歷史**——使用者可能已用 Step 0-B 停過、按過 Esc、或 job 已 7 天過期，靠記憶會拒絕重掛而造成靜默失效。

- `CronList` 有 prompt 含 `/pr-watch` 的 job → 不重掛。
- 沒有 → `/loop 20m /pr-watch`。**一律用有間隔的形式**，不可用無間隔的 `/loop /pr-watch`（那會走 ScheduleWakeup 而非 cron，`CronList` 查不到，Step 0-B 就關不掉）。

**重掛必須明講**：若使用者先前執行過 Step 0-B，之後又發生自動登記而依本規則重新掛上輪詢 → 回覆中**必須明確寫出「已重新掛上輪詢」**並給一句立即再停的出口，禁止靜默重啟。

---

## Step 0 — 意圖分流（開 / 查 / 關）

**本步驟先於 Step 1 執行。命中 A–E 任一項 → 做完即結束本次呼叫，不進 Step 3–8。**

語法**自然語言優先**，`/pr-watch <子命令>` 只是同義別名，兩者走同一段邏輯（本檔是 prompt 不是 parser，「認得 `off`」和「認得『別盯了』」是同一個機制，兩種都收不增加任何成本）。

| 使用者說的話 ／ 等價別名 | 動作 |
|---|---|
| 貼 PR 連結、「追蹤這個」「幫我盯著」／ `/pr-watch <連結>` | **開** → Step 1、Step 2，再套「掛 loop 冪等規則」 |
| 「現在在追哪些 PR」「還在盯嗎」「pr-watch 狀態」／ `list` | **A. 列清單** |
| 「停止監聽」「別盯了」「先不用一直查」「關掉 pr-watch」（**未指名 PR**）／ `off` | **B. 停輪詢**（「停止監聽」的預設語義） |
| 「這個 PR 不用追了」「把 #1766 移掉」（**有指名 PR**）／ `forget <PR>` | **C. 移除單一 PR** |
| 「先別管這個 PR，之後再說」（有指名 PR **且**明講之後要續追）／ `pause <PR>` | **D. 暫停單一 PR** |
| 「重新開始盯」「繼續追」／ `resume` | **E. 恢復** |

**分流原則（三條，優先於上表的字面比對）**

1. **「停」類意圖只由使用者發動。** Claude 在任何情況下不得自行判斷「應該可以停了」而執行 B/C/D。這與「開」的自動觸發**刻意不對稱**：開只寫本地檔、看得見；關會讓使用者**以為還在盯著、實際沒盯**——靜默關閉是本機制最糟的失效模式。系統自動煞車一律只用既有的 `dormant`/`escalated`/`waiting_on_others`，**不得升級為停輪詢或移除**。
2. **句子裡沒有具體 PR/repo 指涉 → 一律走 B，不要反問「你是指哪一個」。** B 完全可逆、零游標損失，是所有「停」意圖的安全上界；先做 B 再在回覆裡告知怎麼進一步清單筆，比先彈窗問三選一更省事也更不會做錯（§14 的多值彈窗適用於「模型無法安全預設」的情境，此處存在安全預設）。
3. **只有明確指名某個 PR 才走 C/D；D 還額外要求使用者明講「之後還要追」，否則一律 C。**

**確認規則**：B 免確認（可逆、零損失）；C 免 `[Y/N]` 但**必須回收據**（見 C-3）；D/E 免確認。`--dry-run` 對 A–E 一律只印「會做什麼」，不實際呼叫 CronDelete、不寫 registry。

### A. 列清單

1. `Read ~/.claude/pr-watch/registry.json`（不存在或 `{}` → 回「目前沒有追蹤中的 PR」）。
2. `CronList` → 找 prompt 含 `/pr-watch` 的 job，據此判定輪詢是否掛著。
3. **本動作純讀本地檔 + 記憶體，不呼叫 `pr-watch-poll.sh`、不打 GitHub API**（狀態欄顯示的是上輪快照，非即時；要即時就直接跑一輪 `/pr-watch`）。

```
pr-watch 追蹤清單
輪詢：執行中（每 20m，本 session）  ← 或「未掛（registry 保留，但不會自動查）」
  1. kkday-it/kkday-b2c-web#1766    [author]   dormant   最後輪詢 07-22
關掉輪詢：說「停止監聽」｜移除單筆：說「#1766 不用追了」｜恢復：說「繼續追」
```

### B. 停輪詢 —— 「停止監聽」的預設語義

registry **一個位元組都不動**（游標、Slack ts、status 全部原樣），只拆掉喚醒器。日後「繼續追」原地接續，**不會把停掉期間累積的留言誤判成新的**——保留 registry 的全部價值就在這裡。

1. `CronList` → 取出所有 prompt 含 `/pr-watch` 的 job。輸出格式已實測（2026-08-06）：
   ```
   bab4890b — Every 20 minutes (recurring) [session-only]: /pr-watch
   ```
   `<id> — <cadence> (recurring) [session-only]: <prompt>`，**含 prompt 原文**，可直接字串比對；無 job 時回 `No scheduled jobs.`。
2. 逐一 `CronDelete{id}`（可能不只一個，例如誤掛兩次 → 全刪，並在回覆中說明刪了幾個）。
3. **查無命中不是錯誤**：代表本 session 沒掛輪詢（從未掛、已按過 Esc、或當初掛在別的 session——`/loop` 綁 session，那個 session 一結束就已經停了，這裡也刪不到、也不需要刪）。照樣回報「目前沒有執行中的輪詢」。
4. **禁止把 job id 寫進 registry.json 或任何檔案**：`CronCreate` 的 `durable` 參數在本版是 no-op（schema 明寫 "Has no effect — All jobs are session-only"），job 純記憶體、session 結束即消失，存下來的 id 下次一定是死的，只會製造「還掛著」的假象。**`CronList` 現查是唯一可靠來源。**
5. 若當初是無間隔的 `/loop /pr-watch`（dynamic mode，走 ScheduleWakeup 而非 cron），`CronList` 查不到 → 改用 `ScheduleWakeup{stop:true}` 並 `TaskStop` 掉對應 Monitor。（掛 loop 冪等規則已禁止產生這種形式，此條只為既有殘留兜底。）

回覆須明講：追蹤清單保留、游標未動、之後說「繼續追」會從停下來的地方接續。並附另外三個等價關法：兩輪之間按 **Esc**、關掉 session、cron **7 天自動過期**。

### C. 移除單一 PR

1. `Read registry.json`，用 `owner/repo#number` 定位。使用者只給 `#1766` 之類短號 → registry 中**唯一命中才直接採用；命中 0 筆或 ≥2 筆一律停下來問，禁止猜**。
2. 整檔讀出 → 刪掉該 key → 整檔覆寫（沿用 Step 7 讀寫模式）。
3. **回收據（取代 `[Y/N]` 確認）**：把刪掉的整筆 JSON 原樣印在回覆裡。這筆一刪，`lastSeenCommentId` / `slack.lastSeenTs` 就沒了；日後重新登記會**以當下為新基線**，中間累積的留言會被基線吃掉（不會誤觸發修復，但會**永遠看不到**）。收據讓這件事可原地復原。
4. 刪完 registry 變空 `{}` → 順手做一次 B（沒東西可追還留著輪詢只是空轉），並在回覆中說明。

### D. 暫停單一 PR（保留游標）

只有使用者**明確表達「先擱著、之後還要追」**時才用，否則一律 C。作法：該筆 `status` 改 `"paused"`，**不新增任何欄位**，其餘欄位全不動。

Step 3/4 會跳過它 → 不被輪詢、也不會被自動改寫成 `dormant`；因為不輪詢就取不到 delta，所以它**不會**像 dormant 那樣被 delta 自動喚醒——這正是「使用者手動暫停」該有的黏性。

### E. 恢復監聽

1. registry 中 `status` 為 `"paused"` 或 `"escalated"` 的目標 → 改回 `"active"`，**清空 `attempts`**，游標原封不動。未指名則全部恢復。
2. 套「掛 loop 冪等規則」確保 loop 掛著。
3. 回報：現在追幾個、下一輪大約什麼時候。

---

## Step 1 — 讀 registry ＋ 正規化

`Read ~/.claude/pr-watch/registry.json`（檔案不存在則視為 `{}`）。記下每筆讀到的 `rev`（Step 7 比對用）。

### status 封閉值域（5 值 + 缺席，此表以外的值一律非法）

> **R1**：`status` 只描述 **watcher 接下來怎麼辦**，不描述 PR 的 GitHub 狀態。
> **R2**：凡是 poll 每輪都能重新推導的（`state`／`mergeable`／`ci.overall`／`reviewDecision`）**一律不持久化**。
> 舊值 `pending_review` 之所以會讓模型每輪自由造值（實測出現過 `approved`、`waiting_on_ci`），正是因為那個名字活在「PR 狀態」的命名空間裡，語義鄰居就是 approved/changes_requested/merged。改用 `active` 是為了換命名空間，不是換皮。

| 值 | 語義（watcher 視角） | 寫入者 |
|---|---|---|
| `active` | 正常追蹤，本輪照跑行動矩陣 | Step 2 登記／Step 4.5 解凍／Step 5 delta 到達 |
| `waiting_on_others` | 我方動作已完成，等對方（作者改碼／他人撤 CHANGES_REQUESTED／CI 跑完） | Step 5 |
| `dormant` | GitHub 端 >14 天無活動，**降頻但仍輪詢**，不做自動動作 | Step 4.5 |
| `escalated` | 同一動作連 3 次失敗，停自動動作 | Step 6 |
| `paused` | **使用者主動暫停**，保留游標，不輪詢不動作 | Step 0-D |
| *(entry 不存在)* | 終局：已 merge/close 或使用者移除 | Step 7／Step 0-C |

**沒有 `done`/`merged`**——Step 7 在同一輪內完成「摘要標註 → 移除」，**缺席即終態**。

### 正規化（機械化封閉，沒有這步值域還是會漂）

1. **status 正規化**：逐筆檢查，不在上表值域內者（含舊值 `pending_review`、`approved`、`waiting_on_ci`、`changes_requested`、`merged`）→ **一律正規化為 `active`**，摘要列「偵測到未定義狀態 `<值>`，已正規化」。
   統一映射 `active` 而非逐值細分的理由：`active` 是唯一不抑制任何行為的狀態，映射錯的代價只是多 poll 一輪；而 Step 5 是**由 delta 驅動、不是由 status 驅動**，游標對齊時 `active` 也不會產生動作。反之映射到 `dormant`/`escalated` 會靜默丟掉追蹤。**保守方向 = 偏向繼續追蹤。**
2. **缺欄位補齊**：`rev` 缺 → 補 `0`；`attempts` 缺 → 補 `{}`；舊欄位 `rounds` → 丟棄；舊欄位 `updatedAt` → 改名 `lastPolledAt`。
3. **壞基線偵測**：凡 `lastSeenCommentId == 0` 且本輪 poll 的 `commentsFetch.ok == true` 且 `reviewCommentCount > 0` → 視為「基線未建立」（違反 Step 2 的建基線鐵律），用當前 `maxCommentId` **重建基線**，摘要註記，且**本輪對該 PR 不觸發任何自動動作**。沒有這條，首輪就會對著它的全部歷史留言開火。

## Step 2 — 登記（僅當帶了連結參數）

**觸發時機（兩種，皆為使用者的明確動作，不主動掃描）**：

1. **使用者直接給 PR 連結**（貼 GitHub PR URL、或說「追蹤這個」附連結）。
2. **我幫使用者發了含 PR 連結的求 review Slack 訊息之後**——這是既有 `agent-review-workflow.md`「發 Slack 求 review」流程的自然延伸：訊息一發出去，就已經同時拿到 PR 連結、Slack channel、以及這則訊息自己的 `ts`（即 thread parent），此刻就是登記的最佳時機，登記時 `slack.threadTs` = 剛發送訊息的 `ts`，`slack.lastSeenTs` 同值（往後只抓這之後的回覆）。

**解析邏輯**：
- 輸入是 `https://github.com/{owner}/{repo}/pull/{number}` 形式 → 直接取得 `owner/repo` + PR 號，`slack:null`。
- 輸入是 Slack 訊息連結（如 `https://<workspace>.slack.com/archives/<channel>/p<digits>`）→ 解析出 `channel_id` 與 `message_ts`（`p1234567890123456` → `1234567890.123456`，數字最後 6 碼前補一個小數點）→ `slack_read_thread(channel_id, message_ts)` 讀出該則訊息全文 → 從文字中擷取 GitHub PR URL（求 review 訊息慣例一定含 PR 連結，若擷取不到 → 停下問使用者，禁止臆測）→ `slack.channel = channel_id`、`slack.threadTs = message_ts`、`slack.lastSeenTs = message_ts`。

**角色判定**：`gh pr view <PR> --json author --jq .author.login` 與 `gh api user --jq .login`（目前登入帳號）比對——相符 → `role:"author"`；不符 → `role:"reviewer"`。**不再依「哪個 search 桶」判斷**（v1 的作法，已隨自我發現一併移除）。

**建基線快照，不追溯歷史留言**：呼叫 `bash ~/.claude/scripts/pr-watch-poll.sh <PR> --repo <owner/repo>`（不帶 `--prev-head`/`--prev-comment-id`）取得輸出中的 `pr.headRefOid` 與 `maxCommentId`，以此作為 `lastReviewedHeadSha`/`lastSeenCommentId` 的**初始基準**寫入 registry。**嚴禁**寫死 `null`/`0` 直接進入下一步——那會讓這個 PR 過去累積的所有歷史留言在下一輪被誤判為「新出現」，對可能早已處理過的舊留言觸發不必要的自動修復/回覆動作。首次登記只建基線，真正的「新」要等下一輪偵測到基線之後才出現的內容才算。

⚠️ **`maxCommentId: null` 不可當基線**：那代表 `commentsFetch.ok == false`（查詢失敗），不是「沒有留言」。此時**中止登記並告知使用者**，不要建一個假基線。只有 `commentsFetch.ok == true` 時的 `0` 才是合法的空基線。

⚠️ **基線必須晚於自己剛貼的評論**：若本次登記緊接在自己做完 review、貼完 PR 評論之後，基線要在**評論貼完後**才擷取，否則下一輪會把自己剛貼的評論當成 net-new delta。

新增 registry 項：

```json
{
  "role": "author|reviewer",
  "lastReviewedHeadSha": "<基線 head>",
  "lastSeenCommentId": "<基線 maxCommentId>",
  "lastSeenReviewThreadIds": [],
  "slack": "<解析出的物件或 null>",
  "status": "active",
  "attempts": {},
  "rev": 0,
  "registeredAt": "<現在>",
  "lastPolledAt": "<現在>",
  "prUpdatedAt": "<poll 的 pr.updatedAt>"
}
```

若給的 PR 已經在 registry 中 → 視為「更新登記」（例如補上先前沒有的 Slack thread 資訊），不重建基線，只補齊缺的欄位。

**無參數呼叫**（`/loop` 每輪呼叫的預設情況）→ 跳過本步驟，直接處理 registry 中既有項目。

## Step 3 — 排程決策（只看本地欄位，不碰 GitHub 資料）

> **為什麼不在這裡判新鮮度**：舊版 Step 3 用 `updatedAt` 判 >14 天，但它依賴的資料要到 Step 4 poll 才產生，只能退而求其次讀 registry 自己的 `updatedAt`——而那個值每輪都被 Step 7 刷新，**正常被輪詢的 PR 永遠不會超過 14 天，dormant 閘門永遠不會觸發**。實測落差：`kkday-b2c-web#1766` 的 GitHub `pr.updatedAt` 是 2026-03-19，registry 自己的 `updatedAt` 是 2026-07-22，差四個月。新鮮度判定已移到 Step 4.5（拿得到 `pr.updatedAt` 之後）。

本步驟只決定「這一輪要不要 poll 這筆」，輸入只有本地欄位（`status`、`lastPolledAt`）：

| status | 本輪是否 poll | Step 5 自動動作 | Step 8 摘要 |
|---|---|---|---|
| `active` | 每輪 | 是 | 有 delta 才列 |
| `waiting_on_others` | 每輪 | 否（只推游標、只偵測解除條件） | 有 delta／狀態變化才列 |
| `dormant` | **降頻**：`now - lastPolledAt > 3h` 才 poll（約每 9 輪一次） | 否 | 只計數 |
| `escalated` | 否 | 否 | 只計數 |
| `paused` | 否 | 否 | 只計數 |

**`dormant` 必須繼續被 poll（降頻）**，否則它是個無出口的吸收態——不 poll 就永遠取不到 delta，就永遠解不了凍，追蹤會靜默永久遺失。降頻同時滿足原設計的成本考量（不該每 20 分鐘對著沒變化的東西反覆判定）。

## Step 4 — 逐 PR 取 delta

對 Step 3 判定要 poll 的 PR（即 `status` 非 `"escalated"`/`"paused"`，且 `dormant` 已過降頻門檻）：

```bash
bash ~/.claude/scripts/pr-watch-poll.sh <PR> --repo <owner/repo> \
  --prev-head <registry[PR].lastReviewedHeadSha> \
  --prev-comment-id <registry[PR].lastSeenCommentId>
```

若 `registry[PR].slack.threadTs` 存在，額外用 `slack_read_thread(channel_id, message_ts=threadTs, oldest=registry[PR].slack.lastSeenTs)` 取 Slack 增量（無新訊息則回傳為空，略過）。

**poll 輸出的健康度判讀（先於任何行動判定）**：

- `queryOk == false` → 本輪對該 PR 不做任何動作，`attempts["poll.query"].failures += 1`，摘要列 `error`。
- `commentsFetch.ok == false` → `maxCommentId` 與 `newReviewComments` 皆為 `null`，代表**「不知道」而非「沒有」**。本輪**不得推進 `lastSeenCommentId`**（推了就會永久跳過這段期間的留言），`attempts["poll.fetch_comments"].failures += 1`。
- 上述兩者任一連續 3 輪 → Step 6 的 escalate 條件成立。否則持續的 rate limit 會讓這個 PR 每 20 分鐘失敗一次、永遠沒人知道。

## Step 4.5 — 新鮮度判定（拿到 poll 輸出後才做）

用 poll 回傳的 **`pr.updatedAt`**（GitHub 端的真實最後活動時間，非 registry 自己的欄位）：

- `pr.updatedAt` 距今 **> 14 天** → `status:"dormant"`，本輪跳過 Step 5 自動動作，Step 8 只計入彙總。
- `status == "dormant"` 但本輪 delta 非空（`headChanged == true` 或 `newReviewComments` 非空）→ **當輪即解凍回 `active`**，正常進入行動矩陣。

一律把 `pr.updatedAt` 寫回 registry 的 `prUpdatedAt`（供 Step 0-A 顯示與人工判讀）。

> `pr.updatedAt` 會被 bot 留言與 label 變更刷新 → 判定偏保守（該 dormant 的可能不 dormant）。**方向刻意如此：寧可多追蹤，不可漏追蹤。** 勿當 bug 修掉。

## Step 5 — 角色 × delta 行動判定

### role = author（我自己的 PR）

| delta | 動作 |
|---|---|
| `newReviewComments` 含可執行的具體修改建議 | **自動修復鏈**：① Edit 對應檔案（`path`/`line` 已在 delta 中）② 跑該 repo 偵測到的 test/lint（現場偵測 `package.json` scripts，勿套語言慣例硬猜）③ `git commit`（Conventional Commits，繁中訊息）④ `git push`（受 `pre-tool-bash.sh` hook 既有保護；force-push 情境會被攔截要求先建 backup，照做）⑤ 對每條處理過的 comment 呼叫 `add_reply_to_pull_request_comment` 說明已修＋commit sha ⑥ 若 `registry[PR].slack.threadTs` 存在，發固定格式 Slack 單行到原 thread |
| `newReviewComments` 是開放式問題/需要設計判斷（非「加XX」「改YY」這種可直接執行的建議） | 起草回覆文字，**列入待確認清單**（不自動發送，自由文本＝結論性，§05）；純「已修」事實陳述不受此限 |
| `changesRequestedOpen == true` | 併入上面修復鏈；修完 push 後在對應 review thread 說明已 address（無法用 `gh pr review` 撤銷他人 CHANGES_REQUESTED，push 後對方需自行重新看） |
| `reviewsLatestPerAuthor` 顯示所有 reviewer 皆 `APPROVED` 且 `ci.overall == "success"` | 摘要中標「ready to merge（需你手動 merge，閉環不自動 merge）」 |
| `ci.overall == "failure"` | 摘要中標「CI failure」，附建議查 `get_step_log` |

> push 依 GitHub repo 設定可能使他人既有 approve 失效（dismiss stale approvals）——這正是「新提交已 approve 需觸發 re-approve」的自然來源：對方會在自己的 registry 項目（若對方也用這套機制追蹤這個 PR）偵測到 head 變動並觸發 reviewer 分支的 re-review；若對方沒用這套機制，你仍可手動把這個 PR 的連結交給我追蹤其 reviewer 動態。

### role = reviewer（別人的 PR，你明確登記要追蹤）

| delta | 動作 |
|---|---|
| `headChanged == true` | **本地深度 re-review**：① 若本地有對應 repo clone，`git fetch origin <PR分支>` ② `git rev-list <prevHead>..<newHead>` 找新增 commit（或 `git range-diff` 若懷疑有 rebase/force-push）③ 只 review 新增內容（net-new，registry 的 `lastSeenReviewThreadIds` 即已覆蓋清單，不重提）④ 貼 net-new inline/summary 評論 ⑤ 對**新 head** 呼叫 `bash ~/.claude/scripts/pr-auto-approve-check.sh <PR> --repo <owner/repo>` 取得 `{eligible,blockers}`（⚠️ 這支的 `eligible` ＝ 護欄全過，與 poll 的 `queryOk` ＝ 查詢成功**是兩回事**，勿混用）⑥ `eligible:true` 且本輪自查 verdict=LGTM 且 0 P0/P1 且已核對留言 commit==新 headRefOid（紅線①⑥）→ `gh pr review --approve`；否則 `--request-changes`/`--comment` 並在摘要說明卡點 ⑦ 固定格式 Slack 單行，context 註明「re-review：新 commit」 |
| 作者對我先前留下的 comment 有新回覆（`newReviewComments` 中 author != 自己且非新 nit，而是回覆既有 thread） | 判斷是否已 address：已解決 → 致謝/resolve；未解決 → 追一則具體說明 |
| `changesRequestedOpen == true` 且該筆非我自己留的 | **安全閥觸發**：不 approve，registry `status:"waiting_on_others"`，摘要列出等待中 |

> **CI 查詢時間競態（Wave 3 實測發現）**：push 後立即查詢，GitHub Actions 的 check run 可能尚未完整建立，`pr-watch-poll.sh` 的 `ci.overall` 此時可能顯示過於樂觀的快照（漏看幾秒後才出現的 failure check）。**`ci.overall` 僅供「本輪要不要通知 CI 轉態」的參考信號，approve 決策的 CI 判斷一律以「approve 前當下即時呼叫 `pr-auto-approve-check.sh`」為準**，不得用 poll 快照代替最終裁決。

## Step 6 — §15 loop 偵測

> 舊版用純量 `rounds` 判定，但一個 int **表達不了「同一動作連續 3 輪失敗」**——Step 6 寫得出來卻算不出來，等於 `escalated` 這條邊是死的，author 分支會無限重試 push。改用 per-action 計數：

```json
"attempts": { "<actionKey>": { "failures": 2, "lastError": "…", "lastAt": "2026-08-06T…Z" } }
```

`actionKey` 用行動矩陣的列名：`author.autofix_push`、`author.reply_comment`、`reviewer.approve`、`reviewer.post_review`、`poll.query`、`poll.fetch_comments`。

規則：

- 動作**成功** → `delete attempts[actionKey]`（歸零。「連續」的語義由此保證——中間成功一次就重新計數）
- 動作**失敗** → `failures += 1`，記 `lastError`/`lastAt`
- 任一 `failures >= 3` → `status:"escalated"`，摘要明確點名根因（`lastError`）與需要使用者提供的資訊，**不做第 4 次同向嘗試**
- 離開 `escalated` 只有一條路：使用者 `resume`（Step 0-E），同時清空整個 `attempts`

## Step 7 — 回寫 registry（`--dry-run` 時跳過）

**不可用 Step 1 讀進來的記憶體快照整檔覆寫**——兩個 session 各自掛 loop 是這個設計的預設結果（`:41` 的去重只在 session 內生效），覆寫會讓另一 session 剛推進的游標**回捲** = 已處理的留言重新變成「新的」= 重複自動改碼、重複 push、重複發 Slack。

**寫入程序**：

1. **重新 `Read` 一次 registry**（不是用 Step 1 的快照）。
2. 逐筆比對 `rev`：若某筆的 `rev` 已與 Step 1 讀到的不同 → **放棄本輪對該筆的游標推進**，該筆保持重讀到的值，摘要註記「偵測到並行寫入，本輪跳過游標更新」，下一輪自然重試。
3. `rev` 相同者 → 只 merge 本輪確實變更的欄位（`lastReviewedHeadSha`、`lastSeenCommentId`、`slack.lastSeenTs`、`status`、`attempts`、`prUpdatedAt`、`lastPolledAt`），並 `rev += 1`。**未處理的 PR 一律用重讀到的值**。
4. 整檔覆寫。

> 為何用 per-entry `rev` 而非檔案 mtime：mtime 是整檔粒度，任何一筆變更都讓所有筆看起來髒 → 併發時整份 registry 每輪都推不動（活鎖）。`rev` 精確到單筆，成本只有一個整數。
> 為何不加 mkdir 鎖：鎖只能包住本 Step 的 read-modify-write（不能包 Step 1→7，中間有 Edit/push/網路呼叫可能好幾分鐘，殭屍鎖門檻無法設定），而「重讀 + `rev`」已消掉唯一有害後果。**擋不住的殘餘風險見紅線 7**。

**移除條件**：`pr.state ∈ {MERGED, CLOSED}` → 本輪先在摘要標註，再從 registry 移除（缺席即終態，不寫 `merged` 之類的 status）。

## Step 8 — 輸出摘要

**防噪規則（強制）**：只列本輪**有新 delta 或狀態變化**的 PR；連續多輪停在同一 `waiting_on_others`/`escalated`/`dormant` 狀態且無新 delta → 不逐條重複列出，只在頂部彙總計數（如「3 個 PR 仍在等待對方回應，狀態未變」）。目的：避免每 20 分鐘機器人重複播報同一句「還在等」造成噪音。

```
pr-watch 本輪摘要
追蹤中：<author數> 個我的 PR、<reviewer數> 個我在追蹤的別人 PR
        （其中 <dormant數> 個已擱置 >14 天、<paused數> 個你手動暫停、<escalated數> 個已 escalate）

本輪動作（僅列有新 delta / 狀態變化者）：
  - <PR> [author] 已修 N 個 nit 並 push（commit <sha>），已回覆 thread
  - <PR> [reviewer] head 變動，re-review 後 approve
  - <PR> ready to merge（需你手動）
  - <PR> escalated：<根因>，需要 <缺什麼資訊>
  - <PR> 查詢失敗（commentsFetch/query），本輪未推游標，attempts=<N>/3

待你確認（自由文本回覆草稿，若有）：
  - <PR> reviewer <X> 問了開放式問題：<草稿內容> 👉 [Y] 發送？
```

**輪詢狀態必須每輪顯示**（防靜默失效）：摘要頂部一律帶一行輪詢是否掛著（`CronList` 現查）。session 關閉、Esc 誤按、cron 7 天過期、loop 掛在別的 session——這四種失效都不會主動通知，唯一的防線就是每次輸出都把真實狀態擺在眼前。

`--dry-run` 模式下，「本輪動作」改列「本輪會做的事（未執行）」，供人工核對判斷邏輯。
