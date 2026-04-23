---
name: slack
description: >
  Slack 訊息助手：草稿生成 + 格式審查 + 指南。
  Use when: "幫我寫 Slack", "發 Slack", "Slack 訊息", "Slack 草稿", "通知頻道",
  "發我頻道", "DM 我", "告警", "部署通知", "PR review request",
  "incident", "postmortem", "release notes", "跨團隊協作",
  "Slack 格式", "mrkdwn 格式", "審查格式", "檢查 Slack",
  "給 PM 看", "PM 版本", "給市場", "白話一點", "跨部門",
  "給主管", "audience=", "rd 版本", "ops 格式", "技術版本".
metadata:
  version: 4.0.0
---

# Slack 助手

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
| **開發日常** | PR / Code Review | PR、review、審查、merge | PR 資訊 → 摘要 → 重點 → Reviewer |
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

### Step A1.5 — 四維度識別（強制）

識別以下 4 個維度，合併輸出統一 metadata（供 A2.5 和 A4.2 使用）：

**Dimension 1 — Audience**（判斷優先級高 → 低）：
1. 使用者明確指定：「給 PM」「用市場語言」「audience=rd」「白話一點」「給主管看」「跨部門」「rd 版本」「技術版本」
2. Channel 推斷：Read `~/.claude/docs/slack-audience-profiles.md` → channel mapping → 比對 channel name
3. Channel ID 前綴：`D` = DM → ask；`mpdm-` → mixed
4. 無法推斷 → ask（強制 A4.2）

**Dimension 2 — 目標頻道**（判斷優先級高 → 低）：
1. 使用者貼出 Channel ID（`CXXXXXXXX`）或連結（`<#CXXX|name>`）
2. 使用者提及 `#channel-name`
3. 動作語義：「發我頻道」「default」→ `$DEFAULT_CHANNEL`；「DM 我」「私訊」→ dm
4. 無指定 → ask

**Dimension 3 — 目標類型**（channel / DM / thread）：
1. Channel ID 前綴：`C`/`G` = channel；`D` = DM；`mpdm-` = 群組 DM
2. 動作詞：「私訊」「DM」→ DM；「回覆」「reply」「在 thread 裡」→ thread
3. 預設 → channel

**Dimension 4 — thread_ts**（是否 thread reply）：
1. 使用者訊息含 Slack permalink（`/archives/CXXX/pYYY`）→ 解析末段 17 位數字（前 10 位 + `.` + 後 6 位）
2. 使用者明確「回覆」+「上下文有 ts」→ 使用已知 ts
3. 否則 → 新訊息（無 thread_ts）

**信心分級**（決定 A4.2 行為）：
- **high**：4 維度均有顯式或強推斷 → A4.2 預設 `[y]`
- **medium**：1-2 維度為推斷 → A4.2 標 `⚠️ 推斷項` + 預設 `[n]`
- **low**：任一維度無依據或有矛盾 → A4.2 強制選擇

輸出統一 metadata（用於後續步驟）：
```
// audience: <id>（信心: high/medium/low｜來源: 顯式/channel推斷/ID前綴）
// channel: <ID or $DEFAULT_CHANNEL or dm or ask>
// type: channel / DM / thread
// thread_ts: <ts or —>
// overall_confidence: high / medium / low
```

禁止：未輸出 metadata 就進入 A2。

### Step A2 — 載入模板庫（**強制**，禁止跳過）

開始草擬前**必須**執行：

1. `Read ~/.claude/docs/slack-templates.md`（無例外）
2. 識別當前場景對應的模板編號（14 個場景之一 / 5 個簡化版 / 自訂）
3. 模板不存在 → 在草稿開頭補註 `⚠️ 自訂格式，無模板對照`

若 `~/.claude/docs/slack-templates.md` 不存在（plugin-only 安裝），請跑 `pnpm run d:setup` 取得完整模板庫。

禁止：未讀模板就開始起草、憑記憶套模板（模板字串可能過時）。

**核心原則**：結論先行 → 可掃描 → 層次分明 → 行動明確 → 長度適中（日常 4-10 行）

### Step A2.5 — 套用 Audience Profile（強制）

1. `Read ~/.claude/docs/slack-audience-profiles.md`（無例外，禁止憑記憶套）
2. 找到 A1.5 識別的 audience profile
3. 對 A2 載入的場景模板套用 transformation：
   - 完全保留：列出的段落原樣輸出
   - 壓縮為 1 句：列出的段落改寫成單句
   - 完全移除：列出的段落直接刪除
   - 強調點：用 `*bold*` 標出
4. 更新草稿 metadata 標註：
   ```
   // audience: <id>
   // template: <場景名稱>
   // transformations: 移除 N 段 / 壓縮 M 段
   ```

特殊情況：
- `mixed` audience → 輸出兩段：①主訊息（業務白話，≤5 行）② thread reply 草稿（技術詳細，標 `[thread]`）
- `ask` audience → 跳過此步，先用 rd 詳細度起草，等 A4.2 詢問後重套 profile

禁止：audience = ask 時直接套任何 profile；audience 確定後憑記憶改寫。

### Step A3 — 格式檢查

<slack_format_rules priority="must">
  <bold>使用 *text* 而非 **text**</bold>
  <italic>使用 _text_ 而非 *text*</italic>
  <link>使用 &lt;url|text&gt; 而非 [text](url)</link>
  <list>使用 • 而非 - 或 *</list>
  <code_inline>使用 `text` 反引號</code_inline>
  <code_block>使用三重反引號 ```...```</code_block>
  <emoji>使用 :emoji_name: 而非 unicode</emoji>
  <forbidden>禁用 markdown table（替代：bullet list 或 code block）</forbidden>
</slack_format_rules>

其他規範：
- [ ] 頻道用 `<#CHANNELID|name>`（不是 `#name`）
- [ ] 沒有 `---` 分隔線（用 `════` / `────` 或空行）
- [ ] 沒有 `## 標題`（用 `*標題*` 單獨一行）
- [ ] `*文字*` 前後無空白
- [ ] 提及用 `<@USERID>`、`<!here>` 或 `<!channel>`
- [ ] 第一行就是結論/重點
- [ ] 縮排用兩個空格

### Step A3.5 — 草稿 Lint（強制）

呈現給使用者前，自我檢查：
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
| **high** | 顯示 metadata + 草稿，預設 `[y]`，使用者可直接 enter 發送 |
| **medium** | 顯示 metadata + 草稿 + `⚠️ 推斷項` 警示，預設 `[n]`，必須手動確認 |
| **low** | 顯示 metadata + 草稿，不預設任何選項，強制使用者明確選擇 |

禁止跳過 A4.2（即使 high confidence），符合 `claude-md/05-security.md` 安全紅線。

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

#### A4.2 確認流程（**必做**，禁止跳過）

```
草稿（信心: $LEVEL｜audience: $A｜channel: $C｜type: $T｜thread: $TS）：
```<草稿全文>```

⚠️ 推斷項（medium / low 才顯示）：
  - audience：依 channel name `#xxx` 推斷為 $A
  - thread_ts：上下文未明確，預設新訊息

  [y]                              依上述設定發送  ← high confidence 預設
  [t]                              切換為 thread reply
  [c:#name|ID]                     改頻道（貼 channel name 或 ID）
  [a:rd|pm|mkt|qa|ops|exec|mixed]  改 audience 重新 generate
  [n]                              不發送  ← medium / low confidence 預設
```

選 `a:<new>` → 跳回 A2.5 重套 profile → 重新呈現 A4.2。

#### A4.3 發送 + 回報

呼叫 `mcp__claude_ai_Slack__slack_send_message` 後回報：`✅ 已發送到 <#CXXX|name>`。

若 `$DEFAULT_CHANNEL` 未設定且使用者語意 = default → 回退到 A4.2 詢問。

---

## 模式 B — 格式審查

### Step B1 — 取得訊息

若用戶未貼上，請他提供訊息全文。

### Step B2 — 逐條審查

| 項目 | 錯誤 | 正確 |
| --- | --- | --- |
| 粗體 | `**文字**` | `*文字*` |
| 連結 | `[文字](url)` | `<url\|文字>` |
| 分隔線 | `---` | 空行或 `────────` |
| 標題 | `## 標題` | `*標題*` 單獨一行 |
| 斜體 | `*文字*` | `_文字_` |
| 刪除線 | `~~文字~~` | `~文字~` |
| 符號空白 | `* 文字 *` | `*文字*` |
| 頻道引用 | `#channel` | `<#CHANNELID\|name>` |
| 提及 | `@名字` | `<@USERID>` |

其他規範：清單用 `•` 或 `-`；引言 `>` 只支援單層；程式碼區塊內 mrkdwn 失效；超過 500 字考慮 Canvas。

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

> 若 `~/.claude/docs/slack-templates.md` 不存在（plugin-only 安裝），請跑 `pnpm run d:setup`。

精簡速查模板 + Emoji 對照 → Read `~/.claude/docs/slack-templates.md`

### 發送前 Checklist

- [ ] 粗體 `*文字*`，連結 `<url|文字>`，頻道 `<#CHANNELID|name>`
- [ ] 無 `---`、無 `## 標題`
- [ ] 提及用 `<@USERID>`，全員 `<!channel>`（謹慎），在線 `<!here>`
- [ ] 段落之間有空行，縮排用兩格空白
- [ ] 格式符號前後無空白（`* 文字 *` 不會生效）
- [ ] 程式碼區塊內 mrkdwn 失效
- [ ] 超過 500 字考慮用 Canvas 或分段發送
- [ ] Emoji 語義對照正確
