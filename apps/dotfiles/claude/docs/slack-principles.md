# Slack Principles

按需載入（`commands/slack.md` Step A2 強制載入，每次草稿前必 Read）。

---

## 1. Slack 語法紅線

Slack mrkdwn ≠ markdown。以下為技術合法性規則，非風格選擇：

**必用語法**：
- 粗體：`*text*`（非 `**text**`）
- 行內程式碼：`` `code` ``
- 連結：`<url|短標題>`（禁裸 URL）
- 頻道引用：`<#CHANNELID|name>`（非 `#name`）
- 提及：`<@USERID>`、`<!here>`、`<!channel>`

**禁用語法**：
- ❌ markdown table `| col | col |` → ✅ `• bullet`
- ❌ `---` 分隔線 → ✅ 空行或 `════════════════`
- ❌ `## 標題` → ✅ `*標題*` 單獨一行
- ❌ `[text](url)` → ✅ `<url|text>`
- ❌ `**bold**` → ✅ `*bold*`
- ❌ `_italic_`（mrkdwn 渲染不一致，各 client 行為差異大）

**清單**：用 `•` 開頭（非 `-` / `*`）；縮排用兩個空格。

---

## 2. 結構骨架

**首行強制**：`{status icon} *{一句話結論}*`，讓讀者不讀完也知道發生了什麼。

**4 層骨架**（依場景可摺疊）：
1. 📌 *結論* — 發生了什麼 / 做了什麼（1 句）
2. 💡 *原因* — 為什麼發生 / 為什麼做
3. 📊 *表現* — 影響 / 數字 / 觀察 / 具體行為
4. 🔧 *方案* — 修法 / 後續 / 行動項

**Icon 使用密度**：每條訊息目標 5-10 個 icon。
- 首行：status icon 必加
- 各層標題：按上方對應 icon（可依場景替換更貼切的）
- 關鍵 bullet：加語義 icon（數字/指標 → 📈、連結 → 🔗、owner → 👤、deadline → ⏰、PR → 📝）
- 禁止：每行都加 icon（目的是強調，不是裝飾）

**摺疊規則**：
- 日常 update / 簡單通知 → 2-3 層即可（壓縮原因與表現為 1 句）
- Incident / 跨工種同步 → 必要 4 層
- 每層 1-3 個要點；層間 1 空行；層內不空行

**Multi 區塊結構**（≥ 2 audience 時）：
1. 首行：status icon + 1 句跨工種結論
2. `📊 *TL;DR*` → 1-2 句 quote，所有人都該知道的事
3. 各 audience 區塊以 `═══════════════════════` 分隔，每塊套 4 層骨架
4. 區塊順序：rd → ops → qa → ued → pm → mkt（技術 → 設計 → 業務）
5. 上限 4 個區塊；超出提示「建議拆 2 條訊息」

---

## 3. Icon 語義字典

一語義對應一 icon；禁止自創；不確定時挑最接近的，標 `⚠️ icon 語義待確認`。

**嚴重度 / 狀態**：
- 🔴 P1 critical　🟠 P2 major　🟡 P3 minor　🟢 P4 / 已修復
- ✅ done / 成功　⏳ in-progress　❌ failed　🔄 retrying / rollback
- ⚠️ warning　💡 insight / 原因　📌 結論 / note　🚫 blocked

**動作 / 內容類型**：
- 🚀 deploy / release　🔗 link　📡 monitor　💬 customer / 客訴
- 🔁 reproduce　🧪 test　📅 schedule　👤 owner　⏰ deadline
- 📝 PR / doc　🎨 design　🔧 fix / 方案　📊 data / 表現　📈 metric 上升　📉 metric 下降
- 🔍 investigation / 根因分析　📦 package / 套件　⚡ performance　🔐 security
- 🗂️ file / 檔案改動　🏷️ version　📬 notification　✨ new feature　🧹 cleanup / refactor
- 🌐 cross-team / 跨部門　🛑 stop / 緊急中止　💥 breaking change　🔑 key decision

**4 層標題對應**（可依語境替換更貼切的 icon）：
- 📌 *結論*　💡 *原因*　📊 *表現*　🔧 *方案*

**Audience 區塊**（multi 模式專用）：
- 📌 RD　🛠️ Ops　🐛 QA　🎨 UED　🎯 PM　📣 Mkt　📊 Data / 通用

---

## 4. 強調規則

視覺節制原則：單段最多 3 個 bold，否則一個都不突出。

- `*bold*` — 關鍵數字、時間、業務決策點（`*8,500 筆*`、`*14:12*`）
- `` `code` `` — 程式實體：函式名、檔名、API、commit hash、指令
- `> quote` — 客訴原文、根因摘要、stakeholder 原話（強調「這是引述」）

---

## 5. Mention / URL / 長度

**Mention**：
- `<!here>` — 僅 incident 類，需要在線人員立即注意
- `<!channel>` — 僅 P1 全員告警（謹慎使用）
- `<@USERID>` — 指名 owner / reviewer
- 一般通知不加 mention，靠頻道訂閱

**URL**：強制 `<URL|短標題>` 格式，禁裸 URL。
例：`<https://github.com/org/repo/pull/1234|#1234 加 maxDepth guard>`

**建議字數上限**：
- Incident < 300 字
- PR review < 200 字
- Release notes < 400 字
- 週報 < 600 字
- 跨工種 multi < 800 字（≥ 800 提示拆 2 條）

---

## 6. Anti-patterns

❌ markdown table → ✅ bullet list
❌ 無結論行，直接從細節開始 → ✅ 首行結論 + status icon
❌ 裸 URL → ✅ `<url|title>`
❌ wall of text（所有內容擠一段）→ ✅ 4 層分段，層間 1 空行
❌ 全段加粗（`*所有重要的*`）→ ✅ 只加粗 1-3 個最關鍵的數字 / 名詞
❌ 訊息全無 icon（純文字）→ ✅ 至少首行 + 各層標題加 icon（目標 5-10 個）
❌ icon 用過頭（每 bullet 都加）→ ✅ 只在關鍵 bullet 加，保持視覺節制

---

## 7. 視覺節奏

**`> quote` 適用時機**（強調「這是引述或關鍵數據」）：
- 根因摘要、stakeholder 原話、客訴原文
- 單行關鍵數字（讓數字視覺突出）
- 不用於正文段落（失去引述語義）

**` ``` ` code block 適用時機**：
- 操作命令（2 行以上）；diff / error log 摘要；config 片段
- 單行命令用行內 `` `code` `` 即可

**視覺層次（由強到弱）**：
1. status icon + `*bold*` → 最強，首行結論專用
2. 層標題 icon + `*bold*` → 各層起點
3. bullet icon + 正文 → 關鍵 bullet
4. `` `code` `` / `> quote` → 功能性強調
5. 純 bullet 正文 → 次要細節

**排版節奏硬規則**：
- 層間：1 空行
- 同層 bullet 間：不空行
- `>` quote 前後各 1 空行
- code block 前後各 1 空行

---

## 8. 場景 Icon 快查

不是模板——各場景的 icon 組合起點，依實際內容增減。

**事件管理**
- Incident 通報：🔴/🟠 首行 · 🔍 原因層 · 📡 表現層（監控指標）· 🔧 方案層
- Incident 更新：⏳/✅ 首行 · 📊 表現層（進度數字）· 🔧 方案層（下步）
- Postmortem：📋 首行 · 🔍 根因 · 📅 時間軸 · 🔑 行動項

**開發日常**
- Deploy / Release：🚀 首行 · 🏷️ 版本 · 📝 PR 連結 · ✅/❌ 結果
- PR Review 請求：📝 首行 · 💡 重點說明 · 🧪 測試覆蓋 · 👤 reviewer
- Bug 修復通報：🔧 首行 · 🔍 根因 · 📊 影響範圍 · ✅ 修復狀態
- 效能優化：⚡ 首行 · 📉 指標改善 · 💡 根因 · 🔧 做法

**進度管理**
- Sprint / Weekly：📅 首行 · ✅ 完成項 · ⏳ 進行中 · 🚫 阻塞項
- 里程碑達成：✅ 首行 · 📊 成果數字 · 👤 貢獻者 · 🚀 後續規劃

**架構與決策**
- ADR / 技術決策：🔑 首行 · 💡 原因 · 📊 影響範圍 · 📝 文件連結
- Breaking Change：💥 首行 · ⚠️ 影響範圍 · 🔧 遷移步驟 · ⏰ 時限
- 技術債 / 重構：🧹 首行 · 💡 痛點 · 📊 現狀數字 · 📅 排期

**跨團隊**
- 跨部門協作請求：🌐 首行 · 📊 背景 · 👤 對接人 · ⏰ 截止
- 安全漏洞通報：🔐 首行 · 🔴/🟠 嚴重度 · 🔧 修補方式 · ⏰ 時限
