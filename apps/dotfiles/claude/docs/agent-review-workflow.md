# PR / Code Review 工作流 + Review 深淺分流 + Subagent 權限語法

> 本檔為 `claude-md/13-agent-orchestration.md` 的 reference 拆出檔（按需載入）。
> 觸發時機：執行 PR / code review、或配置 subagent 權限時。核心調度規則仍在 13-agent 常駐。

## Review 入口路由（5 條路徑，選對再開工）

看似都在 review，實則分工不同。**預設走 `/code-review`**，其餘按情境升級：

| 入口 | 機制 | 何時用 | 備註 |
|---|---|---|---|
| **`/code-review`** | 本地 diff 或 PR，**auto-tier**（quick/standard/deep，見下方分流規格）| **日常預設**——絕大多數 review 走這條 | ab-tao 主入口（290 行），`--effort` 覆寫 |
| `/review-pr` | **強制全 agent stack**（不 tier），`--focus=comments\|tests\|errors\|types\|code` | 要「不省略、跑滿專項 agent」的重點 PR | ≈ `code-review --effort=deep` + `comment-analyzer`；含 `--focus` 過濾 |
| `/santa-loop` | **對抗式雙模型收斂**（兩獨立 reviewer 皆須 approve 才 ship）| 高風險 / 要 ship gate 的關鍵改動 | 收斂 loop，非一次性 review |
| codex `stop-review-gate` | **stop 時自動**觸發的 review 門 | 想在收尾自動攔一道（被動）| 由 codex plugin 掛 Stop hook |
| `code-review:code-review`（plugin）| official plugin 的 PR review | — | **與 `/code-review` 功能重疊、較弱** → 建議忽略或停用該 plugin 以免混淆 |

> 一句話：日常 `/code-review` ｜ 要跑滿 `/review-pr` ｜ 要 ship gate `/santa-loop` ｜ 自動兜底 codex gate。plugin 版可停用。

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
- **Slack 連結** → 讀 thread 抓 PR 連結（無則停下問，禁臆測）→ needSlack=true → 產物 = PR review ＋ **在原 thread（thread_ts）回覆** Slack 總結

### 第二段：Review + 降噪閘門
1. `/code-review` 分析（tier 見下方 Review 深淺分流規格；`--effort` 覆寫）
2. 去重：每個 finding 比對「已覆蓋清單」→ 重複者丟棄（不發 / 不提 / 不附和）
3. 嚴重度閘門：P0/P1 → inline；P2/P3 → 彙整進 1 條 summary 末段「次要」清單；正確碼 → 不評論（禁 per-line LGTM 噪音）
4. 聚合：同類問題多處 → 1 條評論列點，不每處一條
5. 產出 = 最多 1 條 summary + N 條 P0/P1 inline（N 盡量小）

### 第三段：外發（全部草稿先行）
- PR 評論草稿 +（needSlack 時）Slack 草稿一併呈現 → 確認 → 才發
  - 例外：使用者當前 turn 帶明確動作語義（「發送」「commit」，§05）→ 免二次確認直接發
- **Slack review 回覆 = 單行極簡**（review-bot 慣例，**不套 `/slack` 四層區塊**），**回覆位置 = 原 thread（thread_ts），非頻道 top-level 新訊息**：
  - 無阻斷問題：`#<PR號> ✅ LGTM 👍 <PR連結>`
  - 有 finding：`#<PR號> 💬 N findings（一句 context，如「re-review：新 commit」）<PR連結>`
  - 含 P0/P1：於上行後**每項追加 1 行**極簡描述（僅 P0/P1；P2/P3 只進 PR summary，不上 Slack）
  - 具體問題 / 代碼細節 / 修法**一律只寫在 PR 評論**；Slack 禁展開細節、禁重述 PR 內容（PR 才是持久審查記錄）

### 完成閘門（收尾必核，缺一不可標完成）
- **【強制 · 最高權重】凡執行 review PR → PR 內必須至少留 1 條你貼的評論（summary 或 inline）並取回 comment 連結。** 這是 review 的**唯一不可省產物**：
  - net-new / 增量 finding **一律先落 PR**；Slack thread 回覆僅為指向與總結，**嚴禁以 Slack 回覆取代 PR 內評論**（PR 才是持久審查記錄，Slack 會被洗掉）。
  - 即使他人已 review、即使只補一項觀察、即使結論是 LGTM/APPROVE → 仍須在 PR 內留下對應評論。
  - 唯一例外：使用者明確指示「只在 Slack / 只回報給我、不要動 PR」→ 才可略過，且須在回覆聲明「依指示未貼 PR」。
- needSlack=true → **PR review（PR 內評論）＋ Slack thread 回覆兩者皆已送出且取回連結**
- needSlack=false → **僅 PR review（PR 內評論）；禁止額外發 Slack**
- **自動 approve（嚴格護欄，完整 6 條件 + 安全閥見 §05）**：完成閘門過後，若 verdict=LGTM（本輪自審，非 GitHub reviewDecision 聚合值）＆ 0 P0/P1 ＆ 非 deep-tier 敏感路徑 ＆ `mergeable≠CONFLICTING` ＆ CI 非失敗態 ＆ 留言 commit 對齊當前 head → 自動 `gh pr review --approve`（免二次確認）；他人留有未撤銷 `CHANGES_REQUESTED` 或任一條件不符 → 退回人工並說明卡點。**只 approve、不 merge。**

### 專項工具（pipeline 按 tier 自動掛載 / 手動單呼）
| 工具 | 觸發 |
|---|---|
| `reviewer` agent | always / 第二意見 |
| `silent-failure-hunter` | diff 含 try / catch / `.catch(` / swallow |
| `type-design-analyzer` | diff 含 `.ts` / `.tsx` / `.d.ts` |
| `pr-test-analyzer` | prod code 改 ＆ test 未改 |
| `architect` agent | deep tier / 架構深度審查（5 維度評分）|

### 紅線（引用既有，不重述）
- PR：comment / inline 可；**approve = 嚴格護欄自動**（§05「`gh pr review --approve`」5 條件全滿足才自動，否則退人工）；**merge 硬禁**（§05 deny，無豁免）
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
| `reviewer` agent | always |
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
- **與 `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` 互補**：env 設**預設值**（可被 prompt 顯式覆寫），`Agent(model:opus)` 設**硬封鎖**（擋死顯式升 opus）；env 已讓「未指定 model」走 sonnet，deny 補上「禁止顯式升級」這一缺口。
- **陷阱**：`command` / `file_path` / `path` / `url` 等已有 canonicalizing 規則的參數**不能**用此語法，誤寫會被忽略並觸發 startup warning。
- 落地於 `settings.template.json` `permissions.deny`（union 合併，跨機一致）。
