# Slack Templates

按需載入（`commands/slack.md` 的 A2 強制查場景關鍵字、A3 套用模板）。

---

## ⚠️ 強制規則（所有模板共用）

### 1. 結論先行（首行強制）
所有訊息第一行必為「結論行」+ status icon：
- 🔴 *[P1] {service} {一句話狀態}* — incident
- 🟢 *PR Review 請求：{title}* — PR
- 🚀 *Release {version} 已上線* — release
- 📊 *週報 {date range}* — 週報
- 🎨 *設計 review：{設計稿名稱}* — design review
- ⚠️ *{service} 預警：{指標} 超標* — warning

### 2. 4 層通用結構
所有 ≥3 行訊息必含（缺則警告）：
1. *結論* — 1 句，加 status icon
2. *原因* — 為什麼發生 / 為什麼做
3. *表現* — 影響 / 數字 / 觀察
4. *方案* — 修法 / 後續 / 行動項

### 3. 區塊分隔規則
- 4 層 section 之間：1 空行
- multi audience 區塊之間：`═══════════════════════` 分隔線 + 1 空行
- 行動項之間：1 空行（避免 wall of text）
- 段落內不要空行

### 4. 強調規則
- `*bold*` — 業務關鍵字、數字、時間（`*8,500 筆*`、`*14:12*`、`*3 分鐘*`）
- `` `code` `` — 技術術語、檔案路徑、命令、API endpoint（`` `getOrder` ``、`` `/api/v2/orders` ``）
- `> quote` — 引用客訴原文、根因摘要、stakeholder 原話
- ❌ 禁止 `_italic_`（mrkdwn 渲染不一致）
- ❌ 禁止 markdown table（mrkdwn 不支援，改用 `•` bullet）
- ❌ 禁止一段裡超過 3 個 bold（視覺噪音）

### 5. Icon Palette（嚴格沿用，不自創）

*嚴重度 / 狀態*：
- 🔴 P1 critical    🟠 P2 major    🟡 P3 minor    🟢 P4 / 已修復
- ✅ done / 成功     ⏳ in-progress  ❌ failed     🔄 retrying / rollback
- ⚠️ warning        💡 suggestion   📌 note       🚫 blocked

*Audience block icons*（multi 模式專用）：
- 📌 RD   🎯 PM   🐛 QA   🎨 UED   🛠️ Ops   📊 Data / 通用   📣 Mkt

*動作 / 內容類型*：
- 🚀 deploy / release    🔗 link    📡 monitor    💬 customer / 客訴
- 🔁 reproduce           🧪 test     📅 schedule   👤 owner    ⏰ deadline
- 📝 PR / doc            🎨 design   🔧 fix        📈 metric

### 6. Mention 規則
- `@here` — 僅 incident 類，發到特定頻道，需要在線人員立即注意
- `@channel` — 僅 P1 全員告警（謹慎）
- `<@U_USER_ID>` — 指名 owner / reviewer
- 一般通知不加 mention，靠頻道訂閱

### 7. URL 處理
- 必用 `<URL|短標題>` 格式，禁裸 URL
- PR 用：`<https://github.com/.../pull/1234|#1234 PR title>`
- 例：`<https://github.com/org/repo/pull/1234|#1234 加 maxDepth guard>`

### 8. 文字長度建議
- Incident < 300 字（含所有區塊）
- PR review < 200 字
- Release notes < 400 字
- 週報 < 600 字
- 跨工種 multi 模式 < 800 字（≥800 提示拆 2 條）

---

## 場景關鍵字 → 模板 ID 對照（A1 強制查）

以下任一關鍵字命中 → 直接套對應模板，跳過猜測：

• incident、故障、OOM、SLA breach、P1/P2、停機、服務不可用 → `T01-incident`
• PR review、code review、CR 請求、求審、review 這個 → `T02-pr-review`
• release、上線、deploy、發版、版本發布、hotfix 上線 → `T03-release`
• migration、DB migration、schema 變更、resql → `T04-migration`
• 週報、weekly、雙週報、月報、week review → `T05-weekly`
• 設計改版、UED review、UI 改版、設計稿 review、figma → `T06-design-review`
• tech debt、技術債、refactor 立案、重構提案 → `T07-tech-debt`
• 跨工種、跨團隊同步、cross-team、multi-audience → `T08-cross-team`
• 上下游、依賴變動、API change、breaking change 通知 → `T09-dependency-change`
• 客戶問題、客訴、CS escalation、user complaint → `T10-customer-issue`
• oncall handoff、值班交接、on-call → `T11-oncall-handoff`
• 預警、threshold breach、容量警告、alert → `T12-warning`
• RFC、設計提案、架構評估、proposal → `T13-rfc`
• 簡單通知、status update、update → `T14-simple-update`
• incident + 跨工種、多 audience incident → `T15-multi-audience-incident`

---

## ❌ Anti-Patterns（禁止寫法）

❌ `markdown table：| Col1 | Col2 |`
✅ `bullet list：• Col1：value1`

❌ `無結論行：直接從細節開始`
✅ `首行結論 + status icon`

❌ `裸 URL：https://github.com/...`
✅ `<https://github.com/...|#1234 PR title>`

❌ `wall of text：所有內容擠成一段，無空行分隔`
✅ `4 層分段，層間 1 空行`

❌ `_italic_：_重要內容_`
✅ `*bold*：*重要內容*`

❌ `全部加粗：*所有重要的*、*任何關鍵字*、*全段加粗*`
✅ `只加粗 1-3 個最重要的關鍵字 / 數字`

❌ `不標 audience 直接 multi 輸出`
✅ `先確認 audience list，再拼裝 multi 區塊`

---

## T01-incident：Incident 通報

```
🔴 *[P{level}] {service} — {一句話狀態}*

*原因*：{目前已知的觸發原因，未知則寫「調查中」}

*表現*：
• 影響範圍：{受影響功能 / 用戶 / 流量百分比}
• 開始時間：*{HH:MM}*，持續 *{N 分鐘}*
• 觀察：{error rate / log 摘要}

*方案*：
✅ {已完成動作}
🔄 {進行中動作}
⏳ {下一步}

👤 On-call：<@{U_ONCALL_ID}>
📡 狀態頁：<https://status.example.com|status.example.com>
⏰ 下次更新：*{N}* 分鐘後或有重大進展時
```

> 💡 多 audience 模式：指定 ≥2 audience（如「pm + rd + qa」）→ 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T02-pr-review：PR Review 請求

```
🟢 *PR Review 請求：<{pr_url}|{PR title}>*

*原因*：{本 PR 解決了什麼問題 / 屬於哪個功能}

*表現*：
• 變更摘要：{1-3 個核心改動點}
• 重點審查項：{需要 reviewer 特別注意的地方}

*方案*：
• Stack 順序：{PR-1 已 merge / 本 PR 為 PR-N}
• Reviewer：<@{U_REVIEWER_ID}>
• 希望完成：⏰ *{截止時間}*
```

> 💡 多 audience 模式：指定 ≥2 audience（如「pm + rd + qa」）→ 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T03-release：版本發布 Release Notes

```
🚀 *Release {version} 已上線 — {service}*

*原因*：{此版本解決的核心問題 / 業務目標}

*表現*：
• 亮點功能：{feature 1}、{feature 2}
• Breaking Changes：{若有，列具體變更；無則寫「無」}
• 相容性說明：{何時強制過期 / 需要 client 更新}

*方案*：
• Migration 步驟：{若有，列 1-2 個關鍵步驟；無則省略}
• 回滾條件：error rate > {N}% 或 P99 > {Ns}
• 部署人：<@{U_DEPLOYER_ID}>

🔗 <{github_release_url}|GitHub Release> · <{changelog_url}|Changelog>
```

> 💡 多 audience 模式：指定 ≥2 audience（如「pm + rd + qa」）→ 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T04-migration：DB Migration 通知

```
⚠️ *DB Migration 通知：{service} — {migration 名稱}*

*原因*：{為什麼需要這次 migration，schema 變更背景}

*表現*：
• 變更內容：{具體 schema 改動，含 before → after}
• 影響表格：{table / collection 名稱}
• 預計執行時間：*{HH:MM}*，預估耗時 *{N 分鐘}*

*方案*：
• 執行順序：{若有依賴，列 migration 順序}
• 停機需求：{需要 / 不需要停機；需要則列時間窗口}
• 回滾方案：{rollback migration 指令 / 步驟}
• Owner：<@{U_OWNER_ID}>

🔗 <{migration_pr_url}|Migration PR> · <{runbook_url}|Runbook>
```

> 💡 多 audience 模式：指定 ≥2 audience（如「pm + rd + qa」）→ 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T05-weekly：週報

```
📊 *週報 {YYYY-MM-DD} ~ {YYYY-MM-DD}*

*原因*：{本週聚焦方向 / Sprint 目標}

*表現*：
✅ 已完成：
• {項目 1} — <{jira_url}|{ticket}>
• {項目 2}

🔄 進行中：
• [{進度%}] {項目 3} — 預計 {日期} 完成
• [{進度%}] {項目 4} — {阻塞說明（若有）}

⏳ 下週計畫：
• {項目 5}
• {項目 6}

*方案*：
⚠️ 風險 / 阻塞：{說明，無則省略}
• Sprint 完成率：{N}/{M}（{%}）

```

> 💡 多 audience 模式：指定 ≥2 audience（如「pm + rd + qa」）→ 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T06-design-review：設計稿 Review 請求

```
🎨 *設計 review 請求：{設計稿名稱}*

*原因*：{此設計稿對應的需求背景 / 用戶痛點}

*表現*：
• 待 review 點：
  • {設計修改點 1}
  • {設計修改點 2}
• 設計稿連結：<{figma_url}|{設計稿名稱}>

*方案*：
• 截止時間：📅 *{deadline}*
• Review 人：<@{U_DESIGNER_ID}>
• 反饋方式：{留 Figma comment / 回覆此 Slack thread}
```

> 💡 多 audience 模式：指定 ≥2 audience（如「pm + ued」）→ 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T07-tech-debt：Tech Debt 立案

```
⚠️ *Tech Debt 立案：{模組名稱} — {問題一句話}*

*原因*：{為什麼需要處理，包含 cost / risk，如：開發速度 -40%、無法單元測試}

*表現*：
• 現有問題：{具體症狀，如：God Object 1,200 行、N+1 查詢}
• 影響範圍：{哪些功能 / 服務受影響}
• 量化指標：{P99 延遲 / 測試覆蓋率 / Cyclomatic Complexity 現狀}

*方案*：
• Proposed fix：{解法概述}
• 預估工時：{工時} / {Sprint 數}
• 優先級：{P1/P2/P3}
• Owner：<@{U_OWNER_ID}>
• 排期：{預計 Sprint 或季度}

🔗 <{jira_epic_url}|技術債 Epic>
```

> 💡 多 audience 模式：指定 ≥2 audience → 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T08-cross-team：跨工種同步

```
📊 *跨工種同步：{主題}*

📊 *TL;DR*
> {1-2 句所有人都該知道的結論：發生了什麼、各方需要做什麼}

═══════════════════════
📌 *RD 區塊*
*結論*：{rd 視角一句話}
*原因*：{技術背景}
*表現*：{技術影響 / 觀察數據}
*方案*：{技術行動項，含 ETA}

═══════════════════════
🎯 *PM 區塊*
*結論*：{pm 視角一句話}
*原因*：{業務背景}
*表現*：{業務影響 / 用戶影響}
*方案*：{業務行動項，含 ETA}

（以此類推，按 rd → ops → qa → ued → pm → mkt 順序，僅列需要行動的 audience）
```

> 💡 此模板自動觸發 multi 模式，請在 A1.5 指定目標 audience 組合
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T09-dependency-change：API / 上下游依賴變動通知

```
⚠️ *API Change 通知：{service} {版本 / 端點}*

*原因*：{為什麼需要這次變更，技術 / 業務背景}

*表現*：
• 變更內容：{具體變更點，含 before → after}
• Breaking：{是 / 否}
• 預計生效時間：*{日期}*
• 上游服務：{受影響的 service list}

*方案*：
• {受影響方 1}：{需要做什麼}，截止 ⏰ *{deadline}*
• {受影響方 2}：{需要做什麼}，截止 ⏰ *{deadline}*
• Owner：<@{U_OWNER_ID}>

🔗 <{pr_or_doc_url}|變更文件 / PR>
```

> 💡 多 audience 模式：指定 ≥2 audience → 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T10-customer-issue：客訴 / CS Escalation

```
💬 *客訴 Escalation：{問題一句話}*

*原因*：{問題觸發的技術或業務根因，調查中則寫「調查中」}

*表現*：
• 客訴原文：> {客服轉來的原文或摘要}
• 影響用戶：*{N}* 筆 / {用戶特徵}
• 發現時間：*{HH:MM}*
• 復現路徑：🔁 {步驟 1} → {步驟 2}

*方案*：
• 緊急處理：{客服口徑 / 補償方案}
• 技術修復：{修法概述}，Owner：<@{U_DEV_ID}>，ETA：*{日期}*
• 對外說法：> {統一口徑，避免各自表述}

🔗 <{ticket_url}|CS Ticket> · <{jira_url}|Jira Issue>
```

> 💡 多 audience 模式：指定 ≥2 audience（如「pm + rd + ops」）→ 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T11-oncall-handoff：OnCall 值班交接

```
🛠️ *OnCall 交接：{日期} {交接班次}*

*原因*：{值班時段說明，何時開始 / 結束}

*表現*：
• 當前狀態：{服務整體健康狀態 🟢 / 🟡 / 🔴}
• 進行中 incident：{若有，列 incident 名稱 + 目前狀態；無則寫「無」}
• 需持續觀察項：{異常指標 / 近期風險點}

*方案*：
• 待處理行動項：
  • {行動項 1}，優先級 {P1/P2}
  • {行動項 2}
• Runbook 連結：🔗 <{runbook_url}|{服務} Runbook>
• 接班人：<@{U_NEXT_ONCALL_ID}>
• 交班人：<@{U_PREV_ONCALL_ID}>

📡 監控：<{grafana_url}|Grafana Dashboard>
```

> 💡 多 audience 模式：指定 ≥2 audience → 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T12-warning：預警 / Threshold Breach

```
⚠️ *{service} 預警：{指標} 超標*

*原因*：{為什麼此指標超標，已知觸發原因或推測}

*表現*：
• 當前值：*{current_value}*（閾值：{threshold}）
• 超標時間：*{HH:MM}*，持續 *{N 分鐘}*
• 趨勢：{上升中 / 波動 / 持平}

*方案*：
• 短期：{立即可採取的緩解動作}
• 觀察：{需要持續盯的指標 / Dashboard}
• 升級條件：{若 {N} 分鐘內未改善 → 升 incident}
• On-call：<@{U_ONCALL_ID}>

📡 <{grafana_url}|Grafana Dashboard>
```

> 💡 多 audience 模式：指定 ≥2 audience → 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T13-rfc：RFC / 架構設計提案

```
📝 *RFC 提案：{ADR 編號} {提案標題}*

*原因*：{為什麼需要這個架構決策，現狀痛點或新需求}

*表現*：
• 現狀：{目前架構 / 方案}
• 問題：{現狀造成的具體問題}
• 方案 A（推薦）：{方案概述}
• 方案 B（替代）：{方案概述}
• 主要權衡：{各方案的 tradeoff}

*方案*：
• 推薦採用：{方案 A / B}，原因：{1 句話}
• 影響範圍：{受影響的 service / team}
• 決策截止：📅 *{deadline}*
• 需要：{各 team lead 請確認影響評估，回覆截止 {日期}}

🔗 <{adr_doc_url}|RFC 完整文件> · <{issue_url}|Issue>
```

> 💡 多 audience 模式：指定 ≥2 audience → 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T14-simple-update：簡單通知 / Status Update

```
{icon} *{標題 — 一句話結論}*

*原因*：{背景說明，1 句}

*表現*：
• {要點 1}
• {要點 2}

*方案*：
• {行動項，若有}
• 截止：{日期，若有}

cc <!here>
```

> 💡 多 audience 模式：指定 ≥2 audience → 自動切 multi 區塊化輸出
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）

---

## T15-multi-audience-incident：跨工種 Incident（rd + qa + ued + pm 四區塊）

```
🔴 *[P{level}] {service} — {一句話狀態}*

📊 *TL;DR*
> {1-2 句跨工種共通結論：什麼壞了、影響多少人、目前狀態}

═══════════════════════
📌 *RD 區塊*
*結論*：`{service}` {技術一句話}
*原因*：{技術根因}
*表現*：{技術觀察，含 error rate / log 摘要}
*方案*：{修法} + ETA *{HH:MM}*

═══════════════════════
🐛 *QA 區塊*
*結論*：{影響功能一句話}
*復現路徑*：
🔁 {步驟 1}
🔁 {步驟 2}
*已確認*：{已驗証的 bug}
*待驗証*：{尚未確認的邊界}

═══════════════════════
🎨 *UED 區塊*
*UI 表現*：{故障期間使用者看到什麼畫面 / 錯誤訊息}
*設計修正建議*：{需要補充的 fallback UI / error state}
*設計時程*：📅 {何時需要 review}

═══════════════════════
🎯 *PM 區塊*
*結論*：{業務影響一句話}
*影響*：*{受影響用戶數}* 筆 / *{訂單損失}*
*對外說法*：> {統一客服口徑}
*行動項*：
• {PM 行動 1}，截止 ⏰ *{deadline}*
• {PM 行動 2}
```

> 💡 此為 multi-audience incident 模板（rd + qa + ued + pm 四區塊）
> 💡 其他組合：在 A2.5 指定 audience list 重新拼裝
> 💡 單 audience 變體：套用 `~/.claude/docs/slack-audience-profiles.md` 對應 profile（rd / pm / mkt / qa / ops / ued / mixed）
