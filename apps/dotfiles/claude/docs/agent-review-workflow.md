# PR / Code Review 工作流 + Review 深淺分流 + Subagent 權限語法

> 本檔為 `claude-md/13-agent-orchestration.md` 的 reference 拆出檔（按需載入）。
> 觸發時機：執行 PR / code review、或配置 subagent 權限時。核心調度規則仍在 13-agent 常駐。

## Review 入口路由（5 條路徑，選對再開工）

看似都在 review，實則分工不同。**預設走 `/code-review`**，其餘按情境升級：

| 入口 | 機制 | 何時用 | 備註 |
|---|---|---|---|
| **`/code-review`** | 本地 diff 或 PR，**auto-tier**（quick/standard/deep，見下方分流規格）| **日常預設**——絕大多數 review 走這條 | ab-tao 主入口（290 行），`--effort` 覆寫 |
| `/code-review --effort=deep` | **強制 deep tier**：全專項 agent stack 不省略 | 要「不省略、跑滿專項 agent」的重點 PR | 原獨立命令 `/review-pr` 已併入 code-review（2026-07 整併，`--focus` 隨之退役）|
| `/santa-loop` | **對抗式雙模型收斂**（兩獨立 reviewer 皆須 approve 才 ship）| 高風險 / 要 ship gate 的關鍵改動 | 收斂 loop，非一次性 review |
| codex `stop-review-gate` | **stop 時自動**觸發的 review 門 | 想在收尾自動攔一道（被動）| 由 codex plugin 掛 Stop hook |
| `code-review:code-review`（plugin）| official plugin 的 PR review | — | **與 `/code-review` 功能重疊、較弱** → 建議忽略或停用該 plugin 以免混淆 |

> 一句話：日常 `/code-review` ｜ 要跑滿 `/code-review --effort=deep` ｜ 要 ship gate `/santa-loop` ｜ 自動兜底 codex gate。plugin 版可停用。

## PR / Code Review 工作流（降噪優先）

### 最高原則：Signal > Volume
評論是成本不是產出。每條評論先問「不發會怎樣」。能不發就不發、能合併就不散落、別人提過的絕不重提。

### 第零段：狀態偵測（review 前必跑）
讀 PR 既有 comments/reviews（入口 A 另讀 Slack thread 進度）→ 建「已覆蓋問題清單」→ 分流：
| 偵測到 | 模式 |
|---|---|
| 無評論 | 全新 review |
| 已有評論（含他人）| 增量：只補 net-new（**net-new 仍須貼進 PR，不得只發 Slack**），已覆蓋禁重提 |
| 多 reviewer 並行 | 補位：交叉驗證既有，只加沒人提的 |
| Slack thread 已討論 | 回應最新討論點，禁重發總結 |

### 第一段：入口（決定 needSlack 與產物契約）
- **PR 連結（直連）** → needSlack=false → 產物 = **僅 PR review（inline + summary），不發任何 Slack**
- **Slack 連結** → 讀 thread 抓 PR 連結（無則停下問，禁臆測）→ needSlack=true → **抓到 PR 連結後立刻回 S1 接手 Ack（見第三段階段表），再開始 review** → 產物 = PR review ＋ **在原 thread（thread_ts）回覆** Slack 總結

### 第二段：Review + 降噪閘門
1. `/code-review` 分析（tier 見下方 Review 深淺分流規格；`--effort` 覆寫）
2. 去重：每個 finding 比對「已覆蓋清單」→ 重複者丟棄（不發 / 不提 / 不附和）
3. 嚴重度閘門：P0/P1 → inline；P2/P3 → 彙整進 1 條 summary 末段「次要」清單；正確碼 → 不評論（禁 per-line LGTM 噪音）
4. 聚合：同類問題多處 → 1 條評論列點，不每處一條
5. 產出 = 最多 1 條 summary + N 條 P0/P1 inline（N 盡量小）

### 第三段：外發（2026-07-16 分級制，對齊 §05「按內容性質分級」）
- **Review 工作流產物 → 直接發送、免逐則確認**：PR 評論（inline / summary）、`gh pr review` 提交（approve 仍受 §05 六條件護欄）、下方固定格式 Slack 單行回報。發送後回報連結。
- **超出固定格式的自由文本 Slack 訊息**（review 衍生的總結回報、公告等）＝結論性 → 呈現完整草稿、待使用者親自確認 `[Y]` 才發；唯一豁免 = 使用者當前 turn 明確標示「直接發送」（§05）。
- **Slack review 回覆 = 單行極簡**（review-bot 慣例，**不套 `/slack` 四層區塊**），**回覆位置 = 原 thread（thread_ts），非頻道 top-level 新訊息**：
  - 無阻斷問題：`#<PR號> ✅ LGTM 👍 <PR連結>`
  - 有 finding：`#<PR號> 💬 N findings（一句 context，如「re-review：新 commit」）<PR連結>`
  - 含 P0/P1：於上行後**每項追加 1 行**極簡描述（僅 P0/P1；P2/P3 只進 PR summary，不上 Slack）
  - 具體問題 / 代碼細節 / 修法**一律只寫在 PR 評論**；Slack 禁展開細節、禁重述 PR 內容（PR 才是持久審查記錄）

#### Slack 通知階段（needSlack=true 才適用，共 4 階段；needSlack=false 一律全不發）

| 階段 | 觸發時機 | 固定格式（單行，發在原 thread_ts） |
|---|---|---|
| **S1 接手 Ack** | 判定 needSlack=true 且已抓到 PR 連結的**當下**，**先於任何 review 動作**（含開 agent / 拉分支） | `#<PR號> 👀 已接手，開始 review` |
| **S2 阻塞 / 需澄清** | thread 內找不到 PR 連結、`mergeable=CONFLICTING`、CI 失敗態、auto-approve 6 條件不符退回人工、PR 內容與需求矛盾需作者回答 | `#<PR號> ⚠️ <一句卡點>，需 <對方要做的動作>`（無 PR 號時省略 `#<PR號>`） |
| **S3 自動修 nit 並 push** | pr-watch 閉環自行改碼 push 到對方分支後（**push 完立即發**，不等下一輪 review 結論） | `#<PR號> 🔧 已修 N 項 nit 並 push <短 sha>` |
| **S4 review 結論** | 每輪 review（含 re-review）完成、**PR 內評論已貼出並取回連結**之後 | `#<PR號> ✅ LGTM（已 approve）` ／ `#<PR號> 💬 N findings（P2×3 / P3×1，非阻斷）＋連結` |

- **S1 每輪一次**：同一 thread **被人明確要求** re-review（對方 @ 你 / 說「再 re 一下」）＝新一輪，重發 S1；同一輪內禁重發。pr-watch 自動偵測 `headChanged` 而**無人開口**的自發 re-review → **不發 S1**（沒人在等回應，發了是噪音），直接走 S4。
- **S1 不等 review 跑完**：Ack 的價值是即時性，「先回再做」；若 review 極快（quick tier 已出結論）仍照發 S1 再發 S4，不合併成一則。
- **不開的階段（明確排除，避免洗版）**：review 中途進度回報、approve 單獨一則（approve 併入 S4 結論行的「（已 approve）」）。
- 四階段皆屬 **review 工作流固定格式產物 → 直接發送、免逐則確認**（§05）；任何超出上表格式的自由文本仍走草稿確認。

### 完成閘門（收尾必核，缺一不可標完成）
- **【強制 · 最高權重】凡執行 review PR → PR 內必須至少留 1 條你貼的評論（summary 或 inline）並取回 comment 連結。** 這是 review 的**唯一不可省產物**：
  - net-new / 增量 finding **一律先落 PR**；Slack thread 回覆僅為指向與總結，**嚴禁以 Slack 回覆取代 PR 內評論**（PR 才是持久審查記錄，Slack 會被洗掉）。
  - 即使他人已 review、即使只補一項觀察、即使結論是 LGTM/APPROVE → 仍須在 PR 內留下對應評論。
  - 唯一例外：使用者明確指示「只在 Slack / 只回報給我、不要動 PR」→ 才可略過，且須在回覆聲明「依指示未貼 PR」。
- needSlack=true → **S1 接手 Ack 已於開工前發出** ＋ **PR review（PR 內評論）＋ S4 結論回覆兩者皆已送出且取回連結**（期間若命中 S2 / S3 觸發條件，對應單行亦須已發）
- needSlack=false → **僅 PR review（PR 內評論）；禁止額外發 Slack**
- **自動 approve（嚴格護欄，完整 6 條件 + 安全閥見 §05）**：完成閘門過後，若 verdict=LGTM（本輪自審，非 GitHub reviewDecision 聚合值）＆ 0 P0/P1 ＆ 非 deep-tier 敏感路徑 ＆ `mergeable≠CONFLICTING` ＆ CI 非失敗態 ＆ 留言 commit 對齊當前 head → 自動 `gh pr review --approve`（免二次確認）；他人留有未撤銷 `CHANGES_REQUESTED` 或任一條件不符 → 退回人工並說明卡點。**只 approve、不 merge。**

### 專項工具（pipeline 按 tier 自動掛載 / 手動單呼）
| 工具 | 觸發 |
|---|---|
| `code-reviewer` agent | always / 第二意見 |
| `silent-failure-hunter` | diff 含 try / catch / `.catch(` / swallow |
| `type-design-analyzer` | diff 含 `.ts` / `.tsx` / `.d.ts` |
| `pr-test-analyzer` | prod code 改 ＆ test 未改 |
| `architect` agent | deep tier / 架構深度審查（5 維度評分）|

### 紅線（引用既有，不重述）
- PR：comment / inline 可；**approve = 嚴格護欄自動**（§05「`gh pr review --approve`」6 條件全滿足才自動，否則退人工）；**merge 硬禁**（§05 deny，無豁免）
- i18n 缺項：見 §04，不自創文案
- 外發：草稿先行（§05 + Preview > Apply）

## Review 深淺分流規格

### 自動判定 Tier

| 層級 | 觸發條件 | 耗時 |
|---|---|---|
| **quick** | 行數 ≤ 80（stacked +50%）＆ 檔案 ≤ 3 ＆ 無強制升級訊號 | < 90s |
| **standard** | 80–300 行 / 4–10 檔 / 命中 standard 升級訊號 | ~5 min |
| **deep** | > 300 行 / > 10 檔 / 命中 deep 升級訊號 | ~8 min |

**stacked PR**：偵測 git-spice stack（base ≠ main）時，quick 上限 +50%（≤ 120 行）。

### 強制升級訊號

**→ deep**（path allowlist）：
`**/migrations/**` / `**/schema.prisma` / `**/*.sql` / `**/middleware/auth*` / `**/guards/**` / `**/policies/**` / `**/permissions/**` / `**/payment/**` / `**/billing/**` / `**/charge*` / `**/.env*` / `**/config/secrets*` / `**/crypto*` / `**/hash*`

**→ standard**（path allowlist）：
`**/cron*` / `**/scheduler*` / `**/queue*` / `**/cors*` / `**/csp*` / `**/cookie*` / `package.json` dependencies|scripts 段

**→ standard**（risk keyword scan）：
`SECRET` / `SALT` / `PRIVATE_KEY` / `DROP TABLE` / 動態程式碼求值 / React raw HTML 注入屬性 / `child_process` / `bcrypt` / `jwt.sign` / `Math.random`（安全 context）/ diff 含 `^- *if ` 開頭位於 auth 路徑

**→ standard**（diff 形狀）：純刪除 PR `+0/-N` / `.env.example` 改動 / featureFlag default 翻轉

**行數計算排除**：`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `*.snap` / `dist/**` / `*.generated.*` / `*.min.*`

**優先級**：allowlist > keyword > shape > 行數。降級需 4 條全清。

### Quick 模式能力組合

| 能力 | 觸發條件 |
|---|---|
| Diff 正確性檢視 | always |
| typecheck | always |
| lint | always |
| `code-reviewer` agent | always |
| `silent-failure-hunter` | diff 含 try / catch / `.catch(` / swallow |
| `type-design-analyzer` | diff 含 `.ts` / `.tsx` / `.d.ts` |
| `pr-test-analyzer` lite | prod code 改 ＆ test 未改 |

**覆寫**：`--effort=quick|standard|deep`；`--effort=quick --force` 需附 justification。

## Subagent 成本控制：Tool(param:value) 權限語法（CC 2.1.178+）

**僅 deny / ask rules 支援** `Tool(param:value)` match 工具 input 參數（含 `*` wildcard）；**allow 不支援**此語法（allow 續用各工具自有 specifier，如 `Bash(npm run *)`）。可在不關閉整個工具的前提下精準封鎖特定參數值。

| 目的 | deny 寫法 |
|---|---|
| 封鎖 Opus subagent（控 token 成本） | `"Agent(model:opus)"` |
| 封鎖 worktree 隔離 subagent | `"Agent(isolation:worktree)"` |
| 封鎖背景 Bash | `"Bash(run_in_background:true)"` |

- **匹配規則**：值為精確匹配（`model:opus` 匹配別名 `opus`，不匹配完整 model ID）；`*` wildcard 如 `Agent(model:*)` 匹配「任何**顯式**指定 model 的呼叫」，但**不匹配省略 model 的呼叫**。每條規則只能限制一個 parameter（要同時擋 model + isolation 寫兩條）。
- **`CLAUDE_CODE_SUBAGENT_MODEL` 已於 2026-07-28 移除**（原設 `sonnet`）。移除理由是實測推翻了原本「env 只是預設值、可被 prompt 顯式覆寫」的假設：✅ 三個 subagent 的 transcript（`projects/*/subagents/agent-*.jsonl` 的 `.message.model`）證實，帶 `model:"fable"`、帶 `model:"haiku"`、與完全不帶 model 參數三種呼叫**全部被壓成 `claude-sonnet-5`**——env 是**硬鎖**，Agent 工具的 model 參數在其存在時完全失效。這使 2.1.218 起改走背景 subagent 的 `/code-review` 品質上限被鎖死且無從突破。
- **現行慣例（取代 env）**：subagent 預設**繼承 session model**；成本由呼叫端顯式調節——搜尋密集 / 大量 I/O 的 Explore、general-purpose 一律顯式帶 `model: "sonnet"`（或 `haiku`）；深度 review、done-gate critic、架構判斷則不指定，讓它繼承。`Agent(model:opus)` deny 保留為顯式升級的硬封鎖（繼承而來的 model 不受 deny 影響）。
- **陷阱**：`command` / `file_path` / `path` / `url` 等已有 canonicalizing 規則的參數**不能**用此語法，誤寫會被忽略並觸發 startup warning。
- 已落地：`Agent(model:opus)`（settings.template.json + 本地 settings.json，deny union 合併跨機一致）。`Agent(isolation:worktree)`／`Bash(run_in_background:true)` 為文件選項**未啟用**（會破壞 Workflow worktree 隔離與背景任務）。
