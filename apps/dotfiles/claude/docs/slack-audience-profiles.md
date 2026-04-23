# Slack Audience Profiles v2.0.0

按需載入（`commands/slack.md` Step A1.5 + A2.5 使用）。

---

## 說明

Audience 是「投影」——同一訊息透過 profile 輸出不同版本。
Profile 定義了讀者 mental model，讓 Claude 自主判斷保留 / 壓縮 / 移除哪些段落。

禁止憑記憶套用 profile，必須每次 Read 本文件（內容可能更新）。

---

## 7 個 Profile 總覽

| ID | 對象 | 詳細度 |
|---|---|---|
| `rd` | RD / 技術人員 | 完整 |
| `pm` | PM / PO | 中（業務影響優先） |
| `mkt` | Marketing / CS / Sales | 白話（完全去除技術術語） |
| `qa` | QA / SDET | 聚焦可重現性 |
| `ops` | DevOps / SRE / OnCall | 聚焦運維操作 |
| `ued` | UI/UX Designer | 聚焦 UI 表現與設計修正 |
| `multi` | ≥2 個 audience 組合 | 區塊化合併 |

`mixed` 為 `multi` 的相容別名（跨部門頻道預設）。

---

## Audience Profile 定義

### Audience: rd

**Reader mental model**：正在看 PR / log / dashboard 的工程師，需要能立刻行動的技術細節——根因是什麼、怎麼修、誰負責、有什麼連結可以點進去。

**詳細度**：完整，不刪任何技術段落。

**決策原則**：
- 保留：根因、commit / PR / ticket URL、error rate / P99 等技術指標、stack trace 摘要、migration 步驟、操作命令
- 壓縮：（無，技術訊息不壓縮）
- 移除：客服話術、純商業數字（若與技術行動無關）

---

### Audience: pm

**Reader mental model**：關心業務影響和行動項的 PM，不需要知道為什麼 heap 爆掉，但必須知道多少用戶受影響、修好了沒、是否需要他決定什麼事、截止時間是什麼。

**詳細度**：中，業務影響優先，技術細節壓縮。

**決策原則**：
- 保留：影響用戶數、持續時間、修復狀態、優先級、需要 PM 決策的行動項、時間表
- 壓縮：技術根因（一句話帶過，如「因 X 服務 Y 問題導致」）、修法摘要
- 移除：commit hash、SQL 語句、stack trace、API endpoint 細節、pod / k8s / 容器術語

---

### Audience: mkt

**Reader mental model**：非技術背景的客服 / 市場同事，關心「對用戶說什麼」和「促銷活動是否受影響」，不懂 OOMKill，只需要知道影響時間、恢復狀態、客服話術。

**詳細度**：白話，完全去除技術術語。

**決策原則**：
- 保留：時間區間（幾點到幾點）、受影響用戶數（白話描述）、目前狀態（✅ 已恢復 / 處理中）、對活動 / 轉換的影響、建議客服話術
- 壓縮：（無，白話後段落本身已短）
- 移除：所有技術術語（OOMKill、pod、k8s、commit、API、stack trace、SQL、DB、服務縮寫、error rate）

**必含段落**（如有客服需求）：`💬 *客服建議話術*`

---

### Audience: qa

**Reader mental model**：需要驗收修復的 QA，第一個問題是「怎麼重現」，第二個是「該測哪些 case」，第三個是「現有測試為什麼沒攔截」。

**詳細度**：聚焦可重現性，商業數字不重要。

**決策原則**：
- 保留：Reproduce 步驟（操作流程、前置條件、版本號）、建議回歸測試項目、影響功能列表
- 壓縮：技術根因（一句話帶過）
- 移除：commit hash 細節（只保留 PR 連結）、k8s / pod 運維細節、商業影響數字

**必含段落**：
- `🔁 *Reproduce 步驟*`
- `🧪 *建議回歸測試*`
- `❓ *為何現有測試未攔截*`（如適用）

---

### Audience: ops

**Reader mental model**：OnCall 工程師在看 alert dashboard，需要的是「現在服務狀態如何、告警閾值在哪、要執行什麼命令、何時該升級為 incident」。

**詳細度**：聚焦運維操作，業務影響背景一句帶過。

**決策原則**：
- 保留：監控指標（P99 / error rate / QPS）、告警閾值、回滾 / 操作命令、SLA 狀態、Runbook 連結、後續監控建議
- 壓縮：業務影響（一句話）、根因摘要（一句話）
- 移除：商業數字細節、程式碼邏輯（非必要）

**必含段落**：
- `📡 *監控指標*`
- `🛠️ *操作命令*`（如有執行動作）
- `📋 *後續監控建議*`

---

### Audience: ued

**Reader mental model**：UI/UX 設計師關心「故障期間用戶實際看到什麼畫面」和「需要補什麼 fallback UI / error state / 引導文案」，以及設計時程。

**詳細度**：聚焦「使用者實際看到什麼 + 需要設計什麼」。

**決策原則**：
- 保留：故障期間 UI 表現（空白頁 / 無限 loading / 錯誤訊息原文）、fallback 設計建議、usability 影響、設計稿連結、設計時程
- 壓縮：技術根因（一句話）
- 移除：code、stack trace、k8s / pod 術語、SQL、API endpoint

**必含段落**：
- `🎨 *UI 表現*`（故障期間使用者看到什麼）
- `💡 *設計修正建議*`（需補 / 改的 UI，標 `` `需補設計` ``）
- `📅 *設計時程*`（何時需要 review / deliver）

---

### Audience: multi（區塊化合併輸出）

**觸發條件**：使用者明確指定 ≥2 audience（如「給 pm + rd + qa」、「rd 和 qa」）。
`mixed` 為相容別名，等同 multi 選取 rd + pm 預設組合。

#### 格式規則（嚴格按此拼裝）

```
{status icon} *{結論行 — 1 句涵蓋所有 audience}*

📊 *TL;DR*
> {1-2 句概括，不分工種}

═══════════════════════
{audience_block_icon} *{AUDIENCE 名稱} 區塊*
{該 audience 內容，套 4 層骨架：結論 → 原因 → 表現 → 方案}

═══════════════════════
{下一個 audience block}
...
```

#### Audience Block Icon 對應

| Audience | Icon |
|---|---|
| RD | 📌 |
| Ops | 🛠️ |
| QA | 🐛 |
| UED | 🎨 |
| PM | 🎯 |
| Mkt | 📣 |

#### 區塊順序與上限

**固定順序**：rd → ops → qa → ued → pm → mkt（technical → design → business）
**上限**：≤ 4 個 audience 區塊。≥ 5 個時提示「建議拆 2 條訊息」。

---

## Channel → Audience 推斷規則

### 推斷邏輯（僅建議，使用者確認後才套用）

1. 使用者明確指定 audience → 直接套用，不詢問
2. 使用者未指定 → 依 channel name 推測，顯示提示讓使用者確認：
   > 「根據 #channel-name 推測 [audience]，要套用嗎？[y/改]」
3. 無法推測（DM / 無規律名稱）→ 強制進入 A4.2 audience 選單

### Channel 名稱推測對照

```
#dev-* / #eng-* / #backend / #frontend / #sre / #infra / #architecture   → rd
#pm-* / #product-* / #roadmap / #planning                                → pm
#marketing / #mkt-* / #growth / #sales / #cs / #customer-service          → mkt
#qa / #test / #qa-* / #testing                                            → qa
#oncall / #alerts / #incidents / #monitoring / #ops-*                     → ops
#design / #ued / #ux / #ui-* / #product-design                           → ued
#cross-team / #release-notes / #weekly / #general / #announce              → multi（rd + pm 預設組合）
DM / 私訊 / 其他無前綴                                                     → ask（強制 A4.2）
```

---

## Channel ID 前綴 → 目標類型

| 前綴 | 類型 | 預設 audience |
|---|---|---|
| `C` | Public channel | 依 channel name 推測後確認 |
| `G` | Private channel | 同 C |
| `D` | DM（1:1）| `ask`（無法從 ID 推斷角色）|
| `mpdm-` | Multi-party DM | `multi` |

---

## Thread Permalink 解析

格式：`https://kkday.slack.com/archives/CXXXXXXXX/p1776915424017499`

解析：末段 17 位數字 → 前 10 位 + `.` + 後 6 位 = `thread_ts`

例：`p1776915424017499` → `thread_ts: "1776915424.017499"`

⚠️ 發送 thread reply 前須在 A4.2 標註：
```
模式：thread reply（thread_ts: 1776915424.017499）→ 僅 thread 內可見，不出現頻道列表
```
