# Slack Audience Profiles

按需載入（`commands/slack.md` Step A1.5 + A2.5 使用）。

---

## 說明

audience 是「投影」——同一場景模板透過 profile transformation 輸出不同版本，不另建獨立模板。

禁止憑記憶套用 profile，必須每次 Read 本文件（內容可能更新）。

---

## Audience Profile 定義

### Audience: rd（開發 / 技術）

**對象**：RD、後端、前端、SRE、DevOps、InfraKit
**詳細度**：完整（不刪任何技術段落）

| 規則 | 適用段落 |
|---|---|
| 完全保留 | 技術細節、stack trace、SQL、commit hash、API endpoint、PR URL、migration 步驟 |
| 壓縮為 1 句 | — |
| 完全移除 | — |
| 強調點（*bold*） | 根因、修復方式、技術影響範圍 |

**寫法指引**：假設讀者能看懂 code；可用技術術語；不翻譯縮寫（P99、ETA、TTL、OOM 等）。

**範例（訂單系統 36 分鐘故障）**：

```
🔴 *[P1 Incident] order-service OOMKill — 已修復*
════════════════════════════
*持續*：14:12 ~ 14:48（36 分鐘）　*影響*：~8,500 筆結帳失敗
*根因*：`CartService.calculatePromotion()` 的遞迴呼叫在 combo 訂單 > 12 件時無終止條件，
heap 在 14:10 突破 512MB limit，k8s OOMKill x3 pod。
🔍 *修法*：加 `maxDepth=10` guard + 補 unit test（`cart.spec.ts:L89`）
🔗 <https://github.com/org/repo/pull/1234|PR #1234> · <https://jira.kkday.com/VM-9988|VM-9988>
🚀 已部署 🌐 prod 14:52｜PostMortem：明日 10:00
```

---

### Audience: pm（產品經理）

**對象**：PM、PO、Scrum Master
**詳細度**：中（技術細節壓縮，保留業務影響）

| 規則 | 適用段落 |
|---|---|
| 完全保留 | 影響用戶數、持續時間、修復狀態、優先級、決策需求、時間表 |
| 壓縮為 1 句 | 技術根因（「因 X 服務 Y 問題導致」）、修法摘要 |
| 完全移除 | commit hash、SQL 語句、stack trace、API endpoint 細節、pod/k8s 術語 |
| 強調點（*bold*） | 業務影響數字、修復狀態、需要 PM 決策的項目 |

**寫法指引**：聚焦「發生什麼 → 影響誰多少 → 現在怎麼了 → 需要你做什麼」。

**範例（同一事件）**：

```
🟠 *訂單結帳異常 — 已修復*（14:12 ~ 14:48，36 分鐘）
*影響*：*~8,500 筆*結帳失敗，目前已完全恢復。
> 技術問題導致訂單服務短暫中斷，工程師已於 14:52 完成修復並驗證。
📋 *後續*
  • 受影響訂單將在 2h 內自動重試通知
  • PostMortem 明日 10:00（不需 PM 出席，有結論再同步）
  • *是否需要對外發客服公告？請今日 16:00 前確認*
```

---

### Audience: mkt（市場 / 業務 / 客服）

**對象**：Marketing、Sales、Customer Service、Business
**詳細度**：白話（完全去除技術術語）

| 規則 | 適用段落 |
|---|---|
| 完全保留 | 時間區間、影響使用者數、目前狀態、對活動/轉換的影響 |
| 壓縮為 1 句 | — |
| 完全移除 | 所有技術術語（OOMKill、pod、k8s、commit、API、stack trace、SQL、DB、服務名稱縮寫）|
| 強調點（*bold*） | 使用者體驗、行銷活動衝擊、客訴建議話術 |

**寫法指引**：想像對非技術同事解釋。避免「服務」「系統」「端點」等術語。只說對使用者的影響。

**客訴話術段落**（如有客服需求，必加）：
```
💬 *客服建議話術*
  「您好，系統於 14:12 ~ 14:48 期間因技術故障導致結帳受影響，已於 14:52 恢復正常。
  如您的訂單未成功，請重新操作，如有疑問歡迎聯繫我們。」
```

**範例（同一事件）**：

```
⚠️ *網站結帳功能短暫異常通知*
時間：今日 14:12 ~ 14:48（約 36 分鐘）
*影響*：期間約有 8,500 位用戶的結帳操作受影響
*目前狀態*：✅ 已完全恢復，新訂單可正常成立

📋 *對促銷活動影響*
  • 春季特賣活動：預估損失約 XXX 筆訂單（待數據確認）
  • 受影響用戶已排程 Email 通知，EDM 組請確認是否需要補發優惠碼

💬 *客服話術*（如有客訴）
  「您好，今日 14:12 ~ 14:48 網站技術問題已修復，如訂單未成立請重新嘗試。」
```

---

### Audience: qa（測試 / QA）

**對象**：QA Engineer、Testing、SDET
**詳細度**：聚焦可重現性

| 規則 | 適用段落 |
|---|---|
| 完全保留 | Reproduce 步驟、測試 case 描述、影響範圍（功能列表）、版本號 |
| 壓縮為 1 句 | 技術根因 |
| 完全移除 | commit hash 細節、k8s/pod 運維細節、商業影響數字 |
| 強調點（*bold*） | 如何複現、為何漏測、回歸測試建議 |

**必包含段落**：
- `🔁 *Reproduce 步驟*`
- `🧪 *建議回歸測試項目*`
- `❓ *為何現有測試未攔截*`（如果適用）

**範例（同一事件）**：

```
🐛 *[已修復] 訂單結帳 OOM — QA 回歸通知*
*版本*：v2.3.1（含修復）已部署 prod

🔁 *Reproduce 步驟*（v2.3.0 可重現）
  1. 建立含 ≥13 件商品的 combo 訂單
  2. 進入結帳頁 → 點「確認訂單」
  3. 預期：正常結帳；實際：頁面 loading 後顯示「系統繁忙」

🧪 *建議回歸測試*
  • ✅ combo 訂單 1/5/10/12/13/20 件邊界值測試
  • ✅ `CartService.calculatePromotion()` 遞迴深度 guard（unit test PR #1234）
  • ✅ OOM 後 fallback UI 是否正確顯示

❓ *為何現有測試未攔截*
  > 現有 test suite 最大 combo 件數為 10，未覆蓋 ≥12 的邊界條件。
  > 建議將 boundary 提升至 20。
```

---

### Audience: ops（維運 / OnCall）

**對象**：DevOps、SRE、OnCall Engineer、Infra
**詳細度**：聚焦運維操作

| 規則 | 適用段落 |
|---|---|
| 完全保留 | 監控指標（P99/error rate/QPS）、告警閾值、回滾命令、SLA 達標狀態、Runbook 連結 |
| 壓縮為 1 句 | 業務影響、根因摘要 |
| 完全移除 | 程式碼邏輯細節（非必要）、商業數字細節 |
| 強調點（*bold*） | 告警觸發條件、回滾命令、未來監控改善 |

**必包含段落**：
- `📡 *監控指標*`
- `🛠️ *操作命令*`（如有執行動作）
- `📋 *後續監控建議*`

**範例（同一事件）**：

```
🔴 *[P1 OnCall] order-service OOMKill — 已恢復*
*告警觸發*：14:10 heap > 512MB → k8s OOMKill → error rate 飆至 42%
*恢復時間*：14:52（36 分鐘 SLA breach）

📡 *指標快照*
  • 14:10　heap 512MB（limit hit）→ OOMKill x3
  • 14:48　pod restart 後穩定，error rate 0.1%
  • 目前：🟢 正常　P99 < 800ms　error rate 0.05%

🛠️ *已執行操作*
  ```bash
  kubectl rollout restart deployment/order-service -n prod
  kubectl set resources deployment/order-service --limits=memory=1Gi
  ```

📋 *後續監控建議*
  • 新增告警：`order-service heap > 400MB`（提前預警）
  • Runbook 補充 combo 訂單 OOM 的快速診斷步驟
  • 本次 SLA breach 需在 48h 內提交 incident report
```

---

### Audience: exec（C-level / 主管）

**對象**：CEO、CTO、VP、Director、主管
**詳細度**：1-2 句高層次

| 規則 | 適用段落 |
|---|---|
| 完全保留 | 商業影響金額（如可估算）、受影響用戶數、修復狀態、是否需主管決策 |
| 壓縮為 1 句 | — |
| 完全移除 | 所有技術內容（OOM、k8s、commit、API、程式碼）|
| 強調點（*bold*） | KPI 影響、需要主管做的事 |

**格式**：總長 ≤ 5 行。若無需決策，結尾加 `不需主管行動，僅通報。`

**範例（同一事件）**：

```
📊 *結帳服務中斷通報*（今日 14:12 ~ 14:48，已恢復）
*影響*：~8,500 筆結帳受阻，預估損失約 NT$XXX 萬（待確認）
*目前狀態*：✅ 完全恢復，工程已上線修復版本
*後續*：改善監控預防重複發生，PostMortem 明日完成
不需主管行動，僅通報。
```

---

### Audience: mixed（跨部門混合）

**對象**：跨部門頻道、全員頻道、週報頻道
**詳細度**：兩段式分層輸出

| 規則 | 說明 |
|---|---|
| 主訊息（業務白話）| 3-5 行，任何角色都能看懂，無技術術語 |
| Thread reply 技術段 | 標 `[thread]`，技術細節完整，供 RD / Ops 參考 |

**格式**：
```
[主訊息]
{業務白話段落}

→ 技術細節請見 thread 👇

[thread]
{技術完整段落（rd 詳細度）}
```

**範例（同一事件）**：

```
[主訊息]
⚠️ *今日下午結帳服務短暫異常，已完全恢復*
時間：14:12 ~ 14:48（36 分鐘）
約 8,500 位用戶受影響，系統已於 14:52 恢復並驗證正常。
後續改善措施已安排，詳情見 thread。

→ 技術細節請見 thread 👇

[thread]
🔴 *[P1] order-service OOMKill — 技術細節*
根因：`CartService.calculatePromotion()` 遞迴無終止條件（combo > 12 件）
修法：加 maxDepth guard + unit test。PR #1234 已部署 prod 14:52
監控：已新增 heap > 400MB 告警，PostMortem 明日 10:00
```

---

## Channel → Audience 推斷對照

```
#dev-* / #eng-* / #backend / #frontend / #sre / #infra / #architecture   → rd
#pm-* / #product-* / #roadmap / #planning                                → pm
#marketing / #mkt-* / #growth / #sales / #cs / #customer-service          → mkt
#qa / #test / #qa-* / #testing                                            → qa
#oncall / #alerts / #incidents / #monitoring / #ops-*                     → ops（incident 場景優先）
#all-hands / #leadership / #exec / #c-level / #vip                       → exec
#cross-team / #release-notes / #weekly / #general / #announce              → mixed
DM（D 開頭 channel ID）/ 私訊 / 其他無前綴                                 → ask（強制 A4.2）
```

---

## Channel ID 前綴 → 目標類型

| 前綴 | 類型 | 預設 audience | 說明 |
|---|---|---|---|
| `C` | Public channel | 依 channel name（見上方對照）| 標準頻道 |
| `G` | Private channel | 依 channel name | 私有頻道，同 C 邏輯 |
| `D` | DM（1:1）| `ask`（無法從 ID 推斷角色）| 收件人角色未知 |
| `mpdm-` | Multi-party DM | `mixed`（多人，語言需通用）| 群組私訊 |

---

## Thread Permalink 解析

Slack thread URL 格式：`https://kkday.slack.com/archives/CXXXXXXXX/p1776915424017499`

解析規則：
- URL 末段 17 位數字 `1776915424017499`
- 轉換為 `thread_ts`：前 10 位 + `.` + 後 6 位 = `1776915424.017499`
- 用於 `mcp__claude_ai_Slack__slack_send_message` 的 `thread_ts` 參數

範例：`p1776915424017499` → `thread_ts: "1776915424.017499"`

⚠️ 發送 thread reply 前必在 A4.2 標註：
```
模式：thread reply（thread_ts: 1776915424.017499）→ 僅 thread 內可見，不會出現在頻道列表
```
