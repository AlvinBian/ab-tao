---
name: slack
description: >
  Slack 訊息助手：草稿生成 + 區塊化輸出 + 目標確認。
  Use when: "幫我寫 Slack", "發 Slack", "Slack 訊息", "Slack 草稿", "通知頻道",
  "發我頻道", "DM 我", "告警", "部署通知", "PR review request",
  "incident", "postmortem", "release notes", "跨團隊協作",
  "Slack 格式", "mrkdwn 格式", "審查格式", "檢查 Slack",
  "給 PM 看", "PM 版本", "給市場", "白話一點", "跨部門",
  "給主管", "audience=", "rd 版本", "ops 格式", "技術版本",
  "pm + rd", "給 pm, qa, ued", "區塊化", "分區塊",
  "ued 看", "設計師看", "跨工種", "多身份", "各自區塊".
metadata:
  version: 4.2.0
---

# Slack 助手

## 零 — 全域格式鐵律（適用一切 Slack 輸出，不限本 skill 流程）

**任何寫入 Slack 的工具呼叫**依目的地分兩軌，**嚴禁 GitHub markdown**——即使使用者只說「放到編輯框」「起草」而未觸發本 skill 也適用（2026-07-15 實測定案）：

| 工具 | 渲染機制 | 格式規則 |
|---|---|---|
| `slack_send_message` / `slack_schedule_message`（直接發送） | 內建 **standard markdown → mrkdwn 轉換器**（實測：`**double**`→粗體、`[文字](url)`→連結、`<url|文字>` 原樣保留；⚠️ `*single*` 會被轉成**斜體**） | 用 **standard markdown**：粗體 `**雙星號**`、連結 `[文字](url)` 或 `<url|文字>`；**禁單星號** |
| `slack_send_message_draft`（編輯框草稿） | WYSIWYG **純文字**，任何標記皆不轉換（`**` 與 `*` 皆字面星號、`<url|text>` 字面尖括號，送出也原樣） | **禁一切標記符號**：無星號、無尖括號連結；連結用裸 URL 獨立一行；結構靠 icon＋縮排＋空行；要粗體請使用者框內手動加，或改用直發 |

- **轉換器已知 bug（2026-07-15/16 實測）**：`**…**` 緊鄰全形標點會解析失敗、輸出字面 `**`，且**觸發不穩定**——實測 `｜` 與 `（` 均中招，但同訊息另一處 `**…**（` 卻正常 → **一律視為會壞：`**` 前後只放半形字元**（`L1 **98%** / L2 **96%**`），或一行只放一組粗體；list 與下一段之間的空行可能被吞，重要分段前後多留一空行
- **發送後必回讀驗證**：`slack_read_thread` 讀回 stored mrkdwn，確認粗體已轉成單星號、無殘留字面 `**`；發現壞損 → 立即回報使用者（MCP 無編輯訊息工具，需人工修）
- 兩軌皆禁：`---`、`## 標題`、markdown table、`_italic_`
- 工具描述與實測不符時以實測為準；新 pattern 先發自己 DM（`U04B933M4G6`）試渲染再發正式頻道
- **授權層（§05 分級制，2026-07-16）**：本 skill 產出屬**結論性訊息**——一律呈現草稿、經使用者親自確認（A4.2 選定目標）後才發送；使用者當前 turn 明確標示「**直接發送**」且目標明確 → 可跳過 A4.2 逐字直發（lint 照跑、發送後仍回讀驗證）。review 工作流的固定格式單行回報不走本 skill（見 `docs/agent-review-workflow.md`）

## 模式判斷

| 用戶訴求 | 模式 | 流程 |
| --- | --- | --- |
| 寫訊息、草稿、公告、通知、告警、進度 | **A — 草稿** | 場景 → 組裝 → 格式檢查 → 確認發送 |
| 審查格式、格式對嗎、檢查訊息 | **B — 審查** | 逐條檢查 → 修正版 → 確認發送 |
| 詢問格式、語法、怎麼寫 | **C — 指南** | 速查 + Checklist |

---

## 模式 A — 草稿

### Step A1 — 場景判斷

根據用戶需求自動匹配，無需提問：

| 分類 | 場景 | 觸發詞 | 核心結構 |
| ---- | ---- | ------ | -------- |
| **開發日常** | 技術改進/效能 | 優化、效能、加速、降低 | 結論 → 數據 → 原因 → 後續 |
| **開發日常** | PR Review 請求 | PR、review、審查、merge | PR 資訊 → 摘要 → 重點 → Reviewer |
| **開發日常** | PR Review 結果回覆 | LGTM、findings、review 完、審查結果 | **單行**：`#PR號 ✅ LGTM 👍` / `#PR號 💬 N findings`＋PR 連結（細節全在 PR 評論；僅 P0/P1 各追加 1 行；**不套四層結構**）|
| **開發日常** | Bug 修復通報 | bug、修復、hotfix、fix | 問題 → 影響 → 修法 → 狀態 |
| **開發日常** | 技術分享 / TIL | 分享、學到、TIL、心得 | 主題 → 重點 → 示例 → 連結 |
| **開發日常** | 請求協助 / Blocked | 幫忙、blocked、請問 | 問題 → 已試 → 需要 → 截止 |
| **進度管理** | Sprint 進度 | sprint、進度、weekly | 期間 → 完成/進行/待辦 → 風險 |
| **進度管理** | 里程碑達成 | 完成、上線、milestone | 成果 → 數字 → 貢獻者 → 後續 |
| **進度管理** | 阻塞升級 / Escalation | escalate、升級、blocked N天 | 阻塞事實 → 影響 → 需要決策 |
| **發布管理** | 部署通知 | 部署、deploy、上線 | 版本 → 環境 → 變更 → 驗證 |
| **發布管理** | 版本發布 Release | release、v{N}、changelog | 版本 → 亮點 → 重大變更 → 連結 |
| **發布管理** | 回滾通知 | rollback、回滾、revert | 原因 → 回滾版本 → 影響 → ETA |
| **事件管理** | Incident 通報 | 故障、告警、P0、P1、down | 狀態 → 影響 → 發現 → 行動 |
| **事件管理** | Incident 更新 | 更新、進展、目前狀況 | 狀態變化 → 新發現 → 下步 |
| **事件管理** | Postmortem 摘要 | postmortem、事後分析、復盤 | 時間軸 → 根因 → 行動項 |
| **決策治理** | 架構決策 / ADR | 決定、ADR、架構、方案選型 | 決策 → 原因 → 影響範圍 → 行動 |
| **決策治理** | 需求確認 / 討論 | 確認、討論、需求、釐清 | 問題清單 → 當前理解 → 需要 |
| **決策治理** | 技術債 / 重構計畫 | 技術債、重構、cleanup | 現狀 → 痛點 → 方案 → 排期 |
| **跨團隊** | 跨團隊協作請求 | 跨團隊、需要XX配合、協調 | 背景 → 需要什麼 → 截止 → 聯絡人 |
| **跨團隊** | 安全漏洞通報 | 安全、漏洞、CVE、vulnerability | 嚴重度 → 影響 → 修補 → 時限 |
| **跨團隊** | 會議召集 | 開會、meeting、討論、sync | 目的 → 時間 → 議程 → 需要誰 |
| **文化氛圍** | 感謝 / 表揚 | 謝謝、感謝、kudos、讚 | 對象 → 具體貢獻 → 影響 |
| **文化氛圍** | 公告 / 提醒 | 公告、通知、提醒、FYI | 標題 → 內容 → 時間 → 行動 |
| **自由** | 自由格式 | 其他 | 按內容自行組裝 |

### Step A1.5 — Audience-first 識別（強制）

識別以下 4 個維度，合併輸出統一 metadata（供 A2.5 和 A4.2 使用）：

**Dimension 1 — Audience**（嚴格按順序）：
1. **顯式指定**（最優先）
   - 單一：「給 PM」「audience=rd」「白話一點」「技術版本」「rd 版本」「ued 看」「設計師」
   - 多 audience：「pm + rd」「給 pm, qa, ued」「rd 和 qa」「跨工種」「分區塊」「各自區塊」
   - 偵測到逗號 / 加號 / 「和」/「跟」分隔的 ≥2 個 audience → 切 multi 模式
   - 直接採用，跳過後續 audience 推斷
2. **隱式推斷**（次優先）
   - 從 user prompt 上下文推斷（剛剛在做 PR review → rd；正在問業務 KPI → pm；設計稿相關 → ued）
   - 命中 → 標 `// audience: <id>（推斷自上下文，信心 medium）`
3. **Channel hint**（最低優先，僅作建議）
   - 比對 channel name → 顯示建議：「根據 #channel-name 推測 [audience]，要套用嗎？[y/改]」
   - **不自動套用**，必須使用者確認後才進入 A2.5
4. **無依據** → audience = `ask`（強制 A4.2 詢問）

**Dimension 2 — 目標頻道**（判斷優先級高 → 低）：
1. 使用者貼出 Channel ID（`CXXXXXXXX`）或連結（`<#CXXX|name>`）
2. 使用者提及 `#channel-name`
3. 動作語義：「發我頻道」「default」→ `$DEFAULT_CHANNEL`；「DM 我」「私訊」→ dm
4. 無指定 → ask（A4.2 [d]/[m]/[c:]/[t:] 選一）

**Dimension 3 — 目標類型**（channel / DM / thread）：
1. Channel ID 前綴：`C`/`G` = channel；`D` = DM；`mpdm-` = 群組 DM
2. 動作詞：「私訊」「DM」→ DM；「回覆」「reply」「在 thread 裡」→ thread
3. 預設 → channel

**Dimension 4 — thread_ts**（是否 thread reply）：
1. 使用者訊息含 Slack permalink（`/archives/CXXX/pYYY`）→ 解析末段 17 位數字（前 10 位 + `.` + 後 6 位）
2. 使用者明確「回覆」+「上下文有 ts」→ 使用已知 ts
3. 否則 → 新訊息（無 thread_ts）

**信心分級**（決定 A4.2 行為）：
- **high**：audience 顯式指定，其他維度均有依據
- **medium**：audience 為隱式推斷，或 1-2 維度無依據
- **low**：任一維度無依據或有矛盾

輸出統一 metadata（用於後續步驟）：
```
// audiences: <id 或 id1,id2,...>（single/multi 模式｜信心: high/medium/low｜來源: 顯式/推斷/hint）
// channel: <ID or $DEFAULT_CHANNEL or dm or ask>
// type: channel / DM / thread
// thread_ts: <ts or —>
// overall_confidence: high / medium / low
```

禁止：未輸出 metadata 就進入 A2。

### Step A2 — 載入規範庫（**強制**，禁止跳過）

開始草擬前**必須**執行：

1. `Read ~/.claude/docs/slack-principles.md`（無例外）
2. 按 Slack 語法紅線 + Icon 語義字典 + 4 層骨架自主組裝訊息
3. 場景超出典型範圍 → 套 4 層骨架最小化版本，metadata 標 `// custom: 自訂場景`

若 `~/.claude/docs/slack-principles.md` 不存在（plugin-only 安裝），請跑 `pnpm run d:setup` 取得完整規範庫。

禁止：未讀規範就開始起草、憑記憶套用（規範可能更新）。

**核心原則**：結論先行 → 可掃描 → 層次分明 → 行動明確 → 長度適中（日常 4-10 行）

### Step A2.5 — 套用 Profile / 區塊化拼裝（強制）

1. `Read ~/.claude/docs/slack-audience-profiles.md`（無例外，禁止憑記憶套）
2. 分流：
   - **單 audience** → 找對應 profile，按 reader mental model + 3 條決策原則自主判斷：
     - 保留：符合讀者關注焦點的段落原樣輸出
     - 壓縮：技術 / 業務細節依讀者需求改寫成單句
     - 移除：讀者不需要 / 可能造成困惑的段落直接刪除
   - **多 audience（multi 模式）** → 區塊化拼裝：
     a. 生成 universal TL;DR（1-2 句跨工種共通結論）
     b. 依固定順序（rd → ops → qa → ued → pm → mkt）逐一拼接被指定的 audience 區塊
     c. 區塊間插 `═══════════════════════` 分隔線 + 1 空行
     d. 每區塊套對應 profile transformation，加 4 層結構（結論 → 原因 → 表現 → 方案）
     e. 首行加 status icon（🔴/🟠/🟡/🟢/✅）+ 1 句涵蓋所有 audience 的結論行
3. 強制檢查：
   - 首行含 status icon
   - 每區塊含 4 層結構（缺則在草稿末警告）
   - 區塊數 ≤ 4（超出提示「建議拆 2 條訊息」）
4. 更新草稿 metadata 標註：
   ```
   // mode: single / multi
   // audiences: <list>
   // template: <場景 ID>
   // blocks: N（<list>）
   // structure: 結論 ✓ 原因 ✓ 表現 ✓ 方案 ✓
   ```

特殊情況：
- `mixed` audience → 相容舊行為：輸出兩段：①主訊息（業務白話，≤5 行）② thread reply 草稿（技術詳細，標 `[thread]`）
- `ask` audience → 跳過此步，先用 rd 詳細度起草，等 A4.2 詢問後重套 profile

禁止：audience = ask 時直接套任何 profile；audience 確定後憑記憶改寫；multi 模式跳過 TL;DR。

### Step A3 — 格式檢查（⚠️ 依發送軌分流，判準見「零」節；預設 = 直發軌）

**直發軌（`slack_send_message`，經 MCP 轉換器）— standard markdown**：

<slack_format_rules_direct priority="must">
  <bold>使用 **text**（禁單星號——轉換器會轉成斜體）；`**` 前後只放半形字元</bold>
  <italic>禁用斜體（各 client 渲染不一致）</italic>
  <link>使用 [text](url) 或 &lt;url|text&gt;（兩者皆可）</link>
  <list>使用 • 而非 - 或 *</list>
  <code_inline>使用 `text` 反引號</code_inline>
  <code_block>使用三重反引號 ```...```</code_block>
  <emoji>使用 :emoji_name: 而非 unicode</emoji>
  <forbidden>禁用 markdown table、`---`、`## 標題`</forbidden>
</slack_format_rules_direct>

**手貼軌（產出給使用者手動貼上 / Slack API 直呼）— mrkdwn**：

<slack_format_rules_manual priority="must">
  <bold>使用 *text* 而非 **text**；`*文字*` 前後無空白</bold>
  <italic>禁用斜體（`_italic_` 各 client 渲染不一致，見 principles §1）</italic>
  <link>使用 &lt;url|text&gt; 而非 [text](url)</link>
  <list>使用 • 而非 - 或 *</list>
  <code_inline>使用 `text` 反引號</code_inline>
  <code_block>使用三重反引號 ```...```</code_block>
  <emoji>使用 :emoji_name: 而非 unicode</emoji>
  <forbidden>禁用 markdown table（替代：bullet list 或 code block）</forbidden>
</slack_format_rules_manual>

其他規範（兩軌通用）：
- [ ] 頻道用 `<#CHANNELID|name>`（不是 `#name`）
- [ ] 沒有 `---` 分隔線（用 `════` / `────` 或空行）
- [ ] 沒有 `## 標題`（用 `*標題*` 或 `**標題**` 單獨一行，按軌選）
- [ ] 提及用 `<@USERID>`、`<!here>` 或 `<!channel>`
- [ ] 第一行就是結論/重點
- [ ] 縮排用兩個空格

### Step A3.5 — 草稿 Lint（強制，按軌二選一）

呈現給使用者前，自我檢查：

**直發軌（預設）**：
- [ ] 無 `*單星*` 粗體意圖（會被轉成斜體；粗體應為 `**雙星**`）
- [ ] 每組 `**` 前後皆為半形字元（緊鄰全形標點會輸出字面 `**`）
- [ ] 無 `| col | col |` table 列、無 `---`、無 `## 標題`
- [ ] 無 `- ` 開頭 bullet（應為 `• `）

**手貼軌**：
- [ ] 無 `**bold**`（應為 `*bold*`）
- [ ] 無 `[text](url)`（應為 `<url|text>`）
- [ ] 無 `| col | col |` table 列
- [ ] 無 `- ` 開頭 bullet（應為 `• `）

結果回報格式：
`Lint: [PASS]` 或 `Lint: [FAIL] — 違規項：<list>`

FAIL → 必須修復後重 lint，禁止帶 FAIL 進入 A4。

### Step A4.0 — 信心分級閘門（強制）

依 A1.5 的 `overall_confidence` 決定 A4.2 預設行為：

| 信心 | A4.2 行為 |
|---|---|
| **high** | 顯示 metadata + 草稿，呈現 [d]/[m]/[c:]/[t:] 4 選一 |
| **medium** | 顯示 metadata + 草稿 + `⚠️ 推斷項` 警示，呈現 [d]/[m]/[c:]/[t:] 4 選一 |
| **low** | 顯示 metadata + 草稿 + 推斷警示，呈現 [d]/[m]/[c:]/[t:] 4 選一，強制明確選擇 |

任何信心等級均無 `[y]` 預設。禁止跳過 A4.2，符合 `claude-md/05-security.md` 安全紅線。

### Step A4 — 確認發送（**必做**，禁止跳過）

草稿完成 + Lint PASS 後執行。禁止直接呼叫 Slack 工具。

#### A4.1 解析目標頻道（強制優先級）

1. **強制讀取**：先 `Read ~/.claude/settings.json`，取得 `env.SLACK_NOTIFY_CHANNEL`（記為 `$DEFAULT_CHANNEL`）
2. **使用者語意 → 頻道 mapping**（禁止顛倒）：

| 使用者說 | 解析為 | 目標 |
|---|---|---|
| 「發我頻道」「我頻道」「default」「主頻道」「平常那個」 | **default** | `$DEFAULT_CHANNEL`（**不是 DM**）|
| 「DM 我」「私訊」「PM」「私發」 | **dm** | Slack MCP 自動解析使用者 |
| 貼 Channel Link / `<#CXXX>` / `CXXXXXXXX` | **explicit** | 該 Channel ID |
| 「發 #channel-name」（無 ID）| **lookup** | 用 `slack_search_channels` 查 ID 後再發 |
| 未指定 | **ask** | 走 A4.2 確認流程 |

3. **禁止行為**：
   - ❌ 把「我」解讀為 user → DM（除非明確有「DM」「私訊」字樣）
   - ❌ `$DEFAULT_CHANNEL` 已設且使用者語意 = default 時，仍二次詢問
   - ❌ `$DEFAULT_CHANNEL = "dm"` sentinel 時，default 才走 DM

#### A4.2 確認流程（**必做**，禁止跳過，無預設）

```
草稿（信心: $L｜模式: $MODE｜audiences: $A｜結構: 4 層 ✓）：
```<草稿全文>```

⚠️ 推斷項（medium / low 才顯示）：
  - {列出各維度推斷依據}

📤 發送目標（請選一，無預設）：
  [d]                                    發送到默認頻道（$DEFAULT_CHANNEL）
  [m]                                    DM 給我（$MY_USER_ID）
  [c:#name|ID]                           指定頻道（貼 channel name 或 ID）
  [t:URL]                                回覆 thread（貼 Slack permalink）
  [a:rd|pm|mkt|qa|ops|ued|multi:list]    改 audience 重生成
  [n]                                    不發送
```

選 `a:<new>` → 跳回 A2.5 重套 profile → 重新呈現 A4.2。
選 `a:multi:pm,rd,qa` → 切換 multi 模式，audiences = pm, rd, qa → 跳回 A2.5 區塊化拼裝。

無 `[y]` 預設，必須手動選 [d]/[m]/[c:]/[t:] 之一。

#### A4.3 發送 + 回報

呼叫 Slack MCP 的 `slack_send_message`（工具前綴依當前連接的 MCP server 而定，**勿寫死前綴**）：

1. 發送 → 取回訊息連結
2. **回讀驗證（強制）**：`slack_read_thread` 讀回 stored mrkdwn，確認粗體已轉單星號、無殘留字面 `**`、分段未被吞
3. 回報：`✅ 已發送到 <#CXXX|name>`＋訊息連結；驗證發現壞損 → 指出壞損行＋修正建議（MCP 無編輯工具，需使用者人工修）

若 `$DEFAULT_CHANNEL` 未設定且使用者語意 = default → 回退到 A4.2 詢問。

---

## 模式 B — 格式審查

### Step B1 — 取得訊息

若用戶未貼上，請他提供訊息全文。

### Step B2 — 逐條審查

先確認目的地軌（B1 追問「這則要直發還是手貼？」）；下表為**手貼軌 mrkdwn** 判準，**直發軌**判準改用「零」節（粗體 `**雙星**`、禁單星、`**` 前後半形）：

| 項目 | 錯誤 | 正確 |
| --- | --- | --- |
| 粗體 | `**文字**` | `*文字*` |
| 連結 | `[文字](url)` | `<url\|文字>` |
| 分隔線 | `---` | 空行或 `────────` |
| 標題 | `## 標題` | `*標題*` 單獨一行 |
| 斜體 | `_文字_` / `*文字*` 作斜體用 | 禁用斜體（各 client 渲染不一致）|
| 刪除線 | `~~文字~~` | `~文字~` |
| 符號空白 | `* 文字 *` | `*文字*` |
| 頻道引用 | `#channel` | `<#CHANNELID\|name>` |
| 提及 | `@名字` | `<@USERID>` |

其他規範：清單用 `•`；引言 `>` 只支援單層；程式碼區塊內 mrkdwn 失效；超過 500 字考慮 Canvas。

### Step B3 — 輸出結果

```
審查結果：發現 N 個問題

1. [問題類型] 第 X 行
   原文：`有問題的內容`
   修正：`正確內容`

修正版本：
（完整修正後訊息，可直接複製）
```

若完全合規：`✅ 格式審查通過，可直接發送。`

### Step B4 — 確認發送

流程同 Step A4。

---

## 模式 C — 指南

> 若 `~/.claude/docs/slack-principles.md` 不存在（plugin-only 安裝），請跑 `pnpm run d:setup`。

Slack 規範速查 + Icon 語義字典 → Read `~/.claude/docs/slack-principles.md`

### 發送前 Checklist

- [ ] 粗體 `*文字*`，連結 `<url|文字>`，頻道 `<#CHANNELID|name>`
- [ ] 無 `---`、無 `## 標題`
- [ ] 提及用 `<@USERID>`，全員 `<!channel>`（謹慎），在線 `<!here>`
- [ ] 段落之間有空行，縮排用兩格空白
- [ ] 格式符號前後無空白（`* 文字 *` 不會生效）
- [ ] 程式碼區塊內 mrkdwn 失效
- [ ] 超過 500 字考慮用 Canvas 或分段發送
- [ ] Emoji 語義對照正確
