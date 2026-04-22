# Slack 訊息模板庫

按需載入（ab-slack 指令的 A2 視覺元素 + A3 場景模板 + C 指南）。

---

## 視覺元素庫

### 分隔線

```
════════════════════════════   ← 重要分節（事件/架構）
────────────────────────────   ← 一般分節（進度/PR）
```

### 狀態 Badge

```
🟢 正常   🔴 中斷   🟡 降級   🔵 維護中   ⚫ 取消
✅ 完成   🔄 進行中  ⏳ 待處理  ❌ 失敗    ⚠️ 風險
🚀 已部署  🔒 回滾中  🧪 測試中  📋 待 Review
```

### 嚴重度 / 優先度

```
🔴 P0 — 全站中斷，需立即響應
🟠 P1 — 核心功能異常，1h 內響應
🟡 P2 — 部分功能降級，當日響應
🟢 P3 — 輕微問題，正常排期
```

### 環境 Badge

```
🌐 prod   🧪 staging   🔧 dev
```

### 區塊模組（按需組合）

標題行（必用）：
```
{emoji} *{一句話結論或標題}*
```

背景/原因（選用）：
```
> {為什麼、背景脈絡}
```

數據對比（效能/結果用）：
```
📊 *數據*
  • Before：{X}　→　After：{Y}　（{改善幅度}）
```

結構化清單：
```
📌 *{分類標題}*
  • {要點 1}
  • {要點 2}
```

影響範圍表：
```
🎯 *影響範圍*
  | 服務/模組 | 影響程度 | 負責人 | ETA |
```

處理進度（事件用）：
```
🛠️ *處理進度*
  ✅ {已完成步驟}
  🔄 {進行中步驟}
  ⏳ {下一步}
```

行動呼籲：
```
*需要：* {具體要求}
*負責：* <@USERID>
*截止：* {日期時間}
```

連結組（選用）：
```
🔗 <url|{名稱}> · <url|{名稱}> · <url|{名稱}>
```

---

## 場景模板庫

### 【開發日常】技術改進 / 效能優化

```
⚡ *搜尋 API 延遲：2s → 200ms（-90%）*
────────────────────────────────
> Elasticsearch query 未命中 index，補 composite aggregation 後解決。

📊 *效能數據*
  • P50：1,800ms → 95ms
  • P99：3,200ms → 210ms
  • 壓測：staging 48h，穩定無 error

📌 *改動摘要*
  • 範圍：全站搜尋（Product / Article / Blog）
  • 修法：`search_service.rb:L234` 新增 `filter_cache: true`
  • Side effect：Redis 用量 +12MB（可接受）

🔗 <https://github.com/org/repo/pull/456|PR #456> · <https://jira.kkday.com/GT-5678|GT-5678>
🚀 已部署 🧪 staging｜預計明日 10:00 上 🌐 prod
```

### 【開發日常】PR / Code Review 請求

```
🔍 *PR Review 請求 — <https://github.com/org/repo/pull/456|[VM-1482] 新訂單明細頁 PR-2>*
────────────────────────────────
📋 *變更摘要*
  • 新增 `/order/:id` 路由 + Vue 頁面骨架
  • 接入 BFF `/api/v1/order/{id}` 端點
  • i18n key 前綴：`order.detail.*`（14 個 key）

⚠️ *重點審查項目*
  • `OrderDetailView.vue:L89` — SSR data-fetch，請確認 `useAsyncData` 用法正確
  • `order.ts:L45` — `OrderStatus` enum 需與後端 schema 對齊
  • `__tests__/order.test.ts` — 空訂單邊界條件覆蓋是否足夠

📌 *Stack PR 順序*
  ✅ PR-1：BFF base（已 merge）
  📋 PR-2：前端骨架（本 PR，待 review）
  ⏳ PR-3：業務邏輯（待 PR-2 merge）

👤 *Reviewer：* <@U12345678> <@U87654321>
⏰ *希望：* 今日 18:00 前
```

### 【開發日常】Bug 修復 / Hotfix 通報

```
🐛 *[Hotfix] 訂單頁面空白 — 已修復*
════════════════════════════
*狀態：* ✅ 已修復｜*嚴重度：* 🟠 P1

📊 *問題摘要*
  • 現象：進入 `/order/:id` 頁面顯示空白
  • 影響：約 2,300 個活躍訂單頁（iOS 15 Safari 100%）
  • 發現：2026-04-22 09:15，持續 ~40 分鐘

🔍 *根因*
  > `useAsyncData` 在 iOS 15 的 `Promise.allSettled` polyfill 缺失，
  > 導致 hydration 失敗後 Vue 渲染靜默中斷。

🛠️ *修法*
  • 補 `core-js/proposals/promise-all-settled` polyfill
  • 加 `onErrorCaptured` 顯示 fallback UI

🔗 <https://github.com/org/repo/pull/789|PR #789（Hotfix）> · <https://jira.kkday.com/VM-9988|VM-9988>
🚀 已部署 🌐 prod｜驗證：✅ iOS 15 / 16 / 17 均正常
```

### 【開發日常】技術分享 / TIL

```
💡 *TIL：Vue `defineModel` 可雙向省掉 defineProps + defineEmits*
────────────────────────────────
> Vue 3.4+ 的 `defineModel()` 讓 v-model 元件寫法簡潔 50%。

📌 *Before vs After*
  _Before（4.3 以下）_
  ```ts
  const props = defineProps<{ modelValue: string }>();
  const emit = defineEmits<{ 'update:modelValue': [string] }>();
  ```
  _After（4.4+）_
  ```ts
  const model = defineModel<string>();
  ```

🎯 *適用場景*
  • 所有自定義 v-model 元件（表單、選擇器）
  • 多個 v-model binding（`defineModel('title')` / `defineModel('content')`）

⚠️ *注意*：`defineModel` 預設 `required: false`，需要必填請加 `{ required: true }`

🔗 <https://vuejs.org/api/sfc-script-setup.html#definemodel|官方文件>
```

### 【開發日常】請求協助 / Blocked

```
🆘 *Blocked：Adyen webhook 測試環境 403，需協助*
────────────────────────────────
> 已卡 2 天，影響 VM-1234 訂單支付模組進度。

📌 *問題描述*
  • 現象：`POST /api/payment/webhook` 在 staging 回 403
  • 已確認：API key 正確、IP whitelist 已加、Content-Type 正確
  • 疑點：Adyen sandbox 的 HMAC signature 驗證邏輯可能與 prod 不同

🔍 *已嘗試*
  ✅ 重新產生 sandbox API key
  ✅ 用 Postman 直打，同樣 403
  ❌ 查 Adyen 文件無法確認 sandbox/prod HMAC 差異

*需要：* 有 Adyen 整合經驗的人協助確認 HMAC 計算邏輯
*聯絡：* <@U12345678>（支付組）
*截止：* 明日 EOD（影響 sprint 交付）
```

### 【進度管理】Sprint 進度更新

```
📦 *Sprint 22 進度更新*
🗓️ 2026-04-14 ~ 2026-04-25（第 2 週）
════════════════════════════

✅ *已完成（本週）*
  • 訂單明細頁 PR-1 BFF base merge ✦ <https://jira.kkday.com/VM-1482|VM-1482>
  • 搜尋 API 效能優化上線（P99 -90%）
  • iOS 15 hydration hotfix

🔄 *進行中*
  • [75%] 訂單明細頁 PR-2 前端骨架 — 預計週五 EOD
  • [40%] 多語系 i18n 框架 — 等待設計稿最終版

⏳ *待開始 / 未開始*
  • 購物車重構 <https://jira.kkday.com/VM-1500|VM-1500> — 預計下週一

⚠️ *風險 / 阻塞*
  • ⚠️ 設計稿延遲可能影響 i18n 完工，PM 請確認 ETA
  • 🔴 Adyen webhook 測試卡 2 天（見上方 Blocked 訊息）

────────────────────────────────
📊 Sprint 完成率：5/9（56%）｜預計達標：7/9（78%）
```

### 【進度管理】阻塞升級 / Escalation

```
🚨 *[Escalation] VM-1234 已阻塞 5 天，需決策*
════════════════════════════
> 技術方向需 PM + Tech Lead 拍板，否則無法繼續開發。

📌 *阻塞事實*
  • 票號：<https://jira.kkday.com/VM-1234|VM-1234> 訂單退款流程
  • 阻塞原因：退款邏輯是否走「即時退款」vs「T+1 批次」尚未確認
  • 卡關時間：2026-04-17（5 天）
  • 阻塞方：前端 + 後端，共 3 人 idle

📊 *影響評估*
  • Sprint 22 本票佔 3 SP，若不決策本 sprint 必延
  • 下游依賴：退款通知 Email、對帳報表（各 2SP）

🎯 *需要決策*
  1. 退款模式：即時 vs T+1 批次？
  2. 例外處理：部分退款規則由誰定義？

*需要：* <@PM_UID> <@TechLead_UID> 今日 17:00 前給出決定
*若無回應：* 明日晨會升級至 EPD Lead
```

### 【發布管理】部署通知

```
🚀 *[部署] member-service v2.3.1 → 🌐 prod*
════════════════════════════
*狀態：* 🔄 部署中｜*環境：* 🌐 prod｜*預計完成：* 14:30

📋 *本次變更（v2.3.1）*
  • [feat] 新增 Google 第三方登入 <https://github.com/org/repo/pull/501|PR #501>
  • [fix] 修復 session 在 Safari 16 過期問題 <https://github.com/org/repo/pull/498|PR #498>
  • [chore] 升級 devise-jwt 0.11 → 0.12（安全修補）

📌 *部署計畫*
  ✅ staging 驗證通過（14:00）
  🔄 prod k8s rolling update（14:15 開始，~15 分鐘）
  ⏳ 煙霧測試：登入流程 + JWT refresh
  ⏳ 監控觀察 30 分鐘

🔍 *回滾條件*：error rate > 0.5% 或 P99 > 3s
🔗 <https://grafana.internal/d/member|Grafana Dashboard> · <https://github.com/org/repo/releases/tag/v2.3.1|Release Notes>
👤 *部署人：* <@U12345678>｜*OnCall：* <@U87654321>
```

### 【發布管理】版本發布 Release Notes

```
🎉 *member-service v3.0.0 正式發布*
════════════════════════════
> 重大版本：Auth 架構全面遷移至 httpOnly Cookie，效能提升 40%。

✨ *亮點功能*
  🔐 Auth 升級：Token → httpOnly Cookie（OWASP Top 10 合規）
  ⚡ 登入 API 延遲：450ms → 120ms（-73%）
  🌐 新增 Google / Apple 第三方登入

💥 *Breaking Changes*
  • `Authorization: Bearer` header 不再支援（請改用 Cookie）
  • `GET /api/v1/me` 回傳欄位新增 `auth_provider`（非 nullable）
  • Session TTL 從 7 天改為 30 天（需清除舊 cookie）

🔧 *Migration 指南*
  1. 前端移除所有 `localStorage.getItem('token')` 呼叫
  2. API client 加上 `credentials: 'include'`
  3. 參考：<https://confluence.example.com/auth-v3-migration|Migration 文件>

📊 *相容性*：所有現有 session 在 2026-05-01 強制過期並導向重新登入

🔗 <https://github.com/org/repo/releases/tag/v3.0.0|GitHub Release> · <https://jira.kkday.com/changelogs/member|Changelog>
```

### 【發布管理】回滾通知

```
⏪ *[回滾] member-service v3.0.0 → v2.9.1*
════════════════════════════
*狀態：* 🔒 回滾中｜*開始：* 15:42｜*預計完成：* 15:55

⚠️ *回滾原因*
  > v3.0.0 上線後 10 分鐘，error rate 飆升至 8.3%（閾值 0.5%）。
  > 根因：k8s secret 中 JWT_SECRET 未更新，舊 token 驗證全失敗。

📊 *影響統計*
  • 影響時間：15:30 ~ 15:42（12 分鐘）
  • 影響用戶：~4,200 筆（需重新登入）
  • 主要現象：`401 Unauthorized` 全面出現

🛠️ *緊急動作*
  ✅ 回滾至 v2.9.1（Rolling restart）
  🔄 通知受影響用戶重新登入
  ⏳ 修復 secret 配置，預計 v3.0.1 明日重新上線

👤 *負責：* <@U12345678>　*PostMortem：* 明日 10:00 <#C08NJ2GL204|#incident>
🔗 <https://grafana.internal/d/member|Grafana Dashboard>
```

### 【事件管理】Incident 通報

```
🔴 *[P0 Incident] 付款服務中斷*
════════════════════════════
*狀態：* 🔴 發生中　*開始：* 2026-04-22 14:30 UTC+8　*持續：* ~8 分鐘

📊 *影響範圍*
  • 🌐 全區域：無法完成結帳（影響 ~15% 流量）
  • 受影響：Checkout API、Adyen webhook、Order write

🔍 *目前發現*
  • Adyen webhook P99 > 45s（正常 < 3s）
  • DB connection pool 耗盡（active=100/100）
  • Error log：`ECONNREFUSED` 大量出現於 payment-service

🛠️ *已採取行動*
  ✅ 重啟 payment-service pod（x3）
  🔄 調高 DB pool 上限：100 → 200
  🔄 聯繫 Adyen support（ticket #98765，10 分鐘前送出）
  ⏳ 評估啟用備援支付 gateway

👤 *On-call：* <@U12345678>
📡 *狀態頁：* <https://status.kkday.com|status.kkday.com>
🔗 <https://grafana.internal/d/payment|Grafana Dashboard>
⏰ *下次更新：* 15 分鐘後或有重大進展時
```

### 【事件管理】Incident 更新

```
🟡 *[P0 → P1 降級] 付款服務更新 #3*
────────────────────────────────
*狀態：* 🟡 部分恢復　*更新時間：* 15:02

📈 *進展*
  ✅ Adyen webhook P99 降回 2.8s（正常範圍）
  ✅ DB connection pool 壓力解除（active=45/200）
  🔄 仍有約 2% 錯誤率，持續監控中

🔍 *新發現*
  > Adyen 端確認：其 webhook queue 在 14:28 有 ~4 分鐘積壓，
  > 原因是 Adyen SG region 機房網路抖動（非我方問題）。

⏳ *下一步*
  • 繼續觀察 30 分鐘確認穩定
  • 補發失敗的 webhook（預估 ~230 筆）
  • 用戶影響評估完成後發客服通知

👤 *On-call：* <@U12345678>　⏰ *下次更新：* 30 分鐘後
```

### 【事件管理】Postmortem 摘要

```
📋 *Postmortem：付款服務中斷（2026-04-22）*
════════════════════════════
*嚴重度：* 🟠 P1（降級後）　*持續：* 14:30 ~ 15:10（40 分鐘）
*影響用戶：* ~8,500 筆結帳失敗

⏱️ *事件時間軸*
  14:28　Adyen SG 機房網路抖動開始
  14:30　payment-service error rate 突破 5%，告警觸發
  14:35　On-call 上線，確認影響範圍
  14:42　重啟 pod + 調高 DB pool
  14:55　Adyen 確認其端問題，webhook 開始清空
  15:10　error rate 回歸 0.1%，宣告恢復

🔍 *根因分析*
  > Adyen SG 機房短暫抖動 → webhook 積壓 → DB connection 耗盡 →
  > payment-service 級聯超時。 根本問題：缺乏 webhook 積壓時的 circuit breaker。

✅ *改善行動項*
  | # | 行動 | 負責人 | ETA |
  | 1 | 新增 Adyen webhook 積壓監控告警 | <@U_DevOps> | 2026-04-25 |
  | 2 | 實作 circuit breaker（payment-service） | <@U_Backend> | 2026-05-02 |
  | 3 | 建立備援支付 gateway 切換 runbook | <@U_TechLead> | 2026-04-30 |
  | 4 | DB pool 動態擴容策略 | <@U_DBA> | 2026-05-09 |

🔗 <https://confluence.example.com/postmortem/2026-04-22|完整 Postmortem 文件>
```

### 【決策治理】架構決策 / ADR

```
🏗️ *[ADR-042] Auth 遷移至 httpOnly Cookie — 決策通知*
════════════════════════════
> 原 localStorage JWT 不符合新安全合規，決定自 *2026-05-01* 起全面遷移。

📐 *決策內容*
  • 廢棄：`Authorization: Bearer <token>` header 模式
  • 採用：`Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Strict`
  • 過渡期：雙模式並存 2026-05-01 ~ 2026-06-01

🎯 *影響範圍與排期*
  | 服務 | 影響程度 | 負責人 | ETA |
  | Member API | 🔴 高 | <@U_Backend> | 2026-05-05 |
  | Order API  | 🟡 中 | <@U_Order>   | 2026-05-12 |
  | Admin UI   | 🟢 低 | <@U_Frontend> | 2026-05-20 |
  | Mobile App | 🟡 中 | <@U_Mobile>  | 2026-05-19 |

⚠️ *注意事項*
  • CORS 需加 `Access-Control-Allow-Credentials: true`
  • React Native / WebView 需特別處理 cookie jar

🔗 <https://confluence.example.com/adr-042|ADR-042 完整文件> · <https://github.com/org/repo/issues/789|Issue #789>
cc <!here> 各 team lead 請確認影響評估，回覆截止 *2026-04-25*
```

### 【決策治理】技術債 / 重構計畫

```
🧹 *技術債清理計畫：訂單模組重構*
────────────────────────────────
> 訂單模組累積 18 個月技術債，影響開發速度 -40%，計畫 Q2 集中清理。

📊 *現狀痛點*
  • 1,200 行 God Object（`OrderService`），無法單元測試
  • 巢狀回調深度 5 層，業務邏輯難以追蹤
  • 資料庫 N+1 查詢，`GET /orders` P99 > 2s
  • 0% 測試覆蓋率（遺留代碼）

🎯 *重構目標*
  | 指標 | 現狀 | 目標 |
  | 單一檔案行數 | 1,200 行 | < 200 行 |
  | 測試覆蓋率 | 0% | ≥ 80% |
  | `GET /orders` P99 | 2,100ms | < 500ms |
  | Cyclomatic Complexity | 45 | < 10 |

📋 *排期（4 Sprint）*
  • S23：拆分 OrderService → 4 個 domain service
  • S24：補單元測試 + 解 N+1
  • S25：API 層重構 + E2E 測試
  • S26：效能驗證 + 文件補齊

*需要：* Tech Lead 批准排期，<@U_TechLead> 請於週五前確認
🔗 <https://jira.kkday.com/TECH-DEBT-ORDER|技術債 Epic>
```

### 【跨團隊】跨團隊協作請求

```
🤝 *[協作請求] 需要 Data 團隊支援 API 新增欄位*
────────────────────────────────
> 訂單明細頁需展示用戶購買歷史分析，需 Data 提供新端點。

📌 *需求說明*
  • 需要：`GET /api/data/user/{id}/purchase-summary`
  • 回傳欄位：`total_orders`、`total_spent`、`avg_order_value`、`favorite_category`
  • 效能要求：P99 < 300ms（前端直接呼叫）

📊 *背景 / 優先度*
  • 所屬 Sprint：S22（截止 2026-04-25）
  • 業務影響：新版訂單頁 Q2 OKR 指標
  • Jira：<https://jira.kkday.com/VM-1482|VM-1482>（下游依賴此 API）

*需要：* Data 團隊確認可行性 + 預計交付時間
*聯絡我：* <@U_Frontend>（前端負責人）
*截止確認：* 2026-04-23 12:00（否則需調整 scope）

cc <@Data_Lead> <@Data_Backend>
```

### 【跨團隊】安全漏洞通報

```
🔐 *[安全通報] CVE-2025-12345 影響 devise-jwt < 0.12*
════════════════════════════
*嚴重度：* 🔴 高（CVSS 8.1）　*修補截止：* 2026-04-25（72h 內）

⚠️ *漏洞描述*
  > JWT refresh token 驗證邏輯缺陷，攻擊者可偽造 refresh token
  > 以低權限帳號取得高權限 token（需已有效 session）。

🎯 *影響範圍*
  | 服務 | 現用版本 | 狀態 |
  | member-service | devise-jwt 0.11.0 | 🔴 受影響 |
  | admin-service  | devise-jwt 0.10.2 | 🔴 受影響 |
  | order-service  | devise-jwt 0.12.1 | ✅ 安全   |

🛠️ *修補方式*
  ```
  # Gemfile
  gem 'devise-jwt', '>= 0.12.1'
  ```
  升級後需重新產生所有 JWT secret（見 migration 文件）

📋 *行動項*
  | 動作 | 負責人 | 截止 |
  | member-service 升級 + 測試 | <@U_Backend> | 2026-04-24 EOD |
  | admin-service 升級 + 測試  | <@U_Admin>   | 2026-04-24 EOD |
  | 生產環境部署                | <@U_DevOps>  | 2026-04-25 10:00 |

🔗 <https://nvd.nist.gov/vuln/detail/CVE-2025-12345|CVE 詳情> · <https://confluence.example.com/security/cve-2025-12345|內部處理文件>
cc <!channel> 安全相關，所有 team lead 必讀
```

### 【跨團隊】會議召集

```
📅 *[會議召集] 訂單重構技術討論 — 需確認出席*
────────────────────────────────
📌 *會議目的*
  確認訂單模組重構範圍、分工、排期，此決定影響 Q2 後三個 Sprint。

🗓️ *時間*：2026-04-24（週四）14:00 ~ 15:00 UTC+8
📍 *地點*：Google Meet <https://meet.google.com/xxx|join link> / 台北辦公室 3F 會議室

📋 *議程（60 分鐘）*
  1. [15 min] 現狀分析：技術債量化數據
  2. [20 min] 方案討論：漸進式 vs Big Bang 重構
  3. [15 min] 分工與排期確認
  4. [10 min] Q&A + 行動項確認

👥 *必要出席*
  • <@U_TechLead>（拍板）
  • <@U_Backend>（訂單服務 owner）
  • <@U_Frontend>（前端影響評估）

👥 *選擇出席*（有相關性歡迎旁聽）
  • <@U_PM>、<@U_QA>

*請於 2026-04-23 17:00 前確認出席（:white_check_mark: 或 :x:）*
```

### 【文化氛圍】感謝 / 表揚

```
🌟 *感謝 <@U12345678> — 深夜緊急救場*
────────────────────────────────
> 昨晚 23:30 付款服務告警，<@U12345678> 立刻上線，
> 在 40 分鐘內定位根因並完成回滾，避免了更大範圍的用戶影響。

🎯 *具體貢獻*
  • 快速縮小範圍：5 分鐘確認是 Adyen 端問題
  • 決策果斷：主動決定回滾而非繼續嘗試修復
  • 溝通清晰：全程在頻道同步進度，讓 PM 和 CS 即時掌握

💪 這種對系統的熟悉度和在壓力下的冷靜判斷力，值得大家學習！

cc <@Manager_UID> 紀錄一下這次的出色表現 :clap:
```

### 【文化氛圍】公告 / 重要提醒

```
📣 *[公告] Code Freeze — 2026-04-25 18:00 起*
════════════════════════════
> Mobile 團隊 2026-04-27 切 release branch，凍結期間請勿 merge 至 `main`。

📌 *凍結規則*
  • 凍結範圍：`main` / `release/*` branch
  • 凍結期間：2026-04-25 18:00 ~ 2026-04-28 10:00
  • 例外：P0/P1 hotfix 需 Tech Lead 審核後才可 merge

📋 *凍結前 Checklist（請於今日 17:00 前完成）*
  ☐ 確認所有 in-progress PR 已 merge 或標記為下 sprint
  ☐ `npm audit` / `bundle audit` 無高危漏洞
  ☐ staging 環境最新版本驗證通過
  ☐ 告知 QA 當前待測範圍

⏰ *時間軸*
  今日 17:00　PR merge 截止
  今日 18:00　Code freeze 開始
  2026-04-28 10:00　解凍

cc <!channel> 所有工程師請注意
```

---

## 指南速查模板

### 技術公告（精簡）

```
🔔 *【標題】*
════════════════════════════
> 背景說明

📌 *要點*
  • 要點 1
  • 要點 2

*截止：* {日期}　cc <!here>
```

### Sprint 進度（精簡）

```
📦 *本週進度*

✅ 已完成：{清單}
🔄 進行中：{清單}
⏳ 待開始：{清單}
⚠️ 風險：{說明}
```

### Incident 通報（精簡）

```
🔴 *[P{N}] {標題}*
*狀態：* 發生中　*開始：* {時間}
*影響：* {描述}
*處理：* <@USERID>
*更新：* N 分鐘後
```

### PR Review（精簡）

```
🔍 *PR Review — <url|{PR 標題}>*
📋 {一句摘要}
⚠️ 重點：{要特別注意的}
👤 <@REVIEWER>　⏰ {截止}
```

### 感謝（精簡）

```
🌟 感謝 <@UID>！
{具體事蹟一句話}
cc <@Manager>
```

---

## Emoji 語義對照

| Emoji | 語義 |
|-------|------|
| 🔴 / 🟠 / 🟡 / 🟢 | 嚴重度 P0/P1/P2/P3 |
| ✅ 🔄 ⏳ ❌ | 完成 / 進行中 / 待處理 / 失敗 |
| 🚀 🔒 🧪 | 已部署 / 回滾中 / 測試中 |
| ⚡ 🐛 🔐 🧹 | 效能 / Bug / 安全 / 清理 |
| 📦 📋 🔍 💡 | 進度 / 清單 / 審查 / 分享 |
| 🏗️ 🎯 📐 | 架構 / 目標 / 設計 |
| 🤝 🚨 📅 📣 | 協作 / 升級 / 會議 / 公告 |
| 🌟 🎉 💪 | 表揚 / 發布 / 鼓勵 |
