# @ab-tao/dotfiles

## 1.5.0

### Minor Changes

- feat(dotfiles): ccline → claude-hud 遷移 + 互動選單 UX 改進

  - 移除 CCometixLine（ccline）整合，改為 claude-hud plugin
  - 新增 claude-hud wrapper 腳本與配置（config.json、hud-wrapper.sh）
  - CLAUDE.md 安裝預設由 keep 改為 install
  - 所有互動選單 hint 欄位合併至 label（選擇前即可見完整說明）
  - 選項標題與說明之間的 「—」分隔符改為單一空格

### Patch Changes

- Updated dependencies
  - @ab-tao/commons@1.0.3

## 1.4.0

### Minor Changes

- v1.4.0 — Slack 規範庫符號學化重構 + Icon 體系強化

  ### Breaking Changes

  - **`slack-templates.md` 廢棄並改名為 `slack-principles.md`**：15 個硬編碼場景模板（T01~T15）全部移除，改為符號學式規範（Slack 語法紅線 + Icon 語義字典 + 4 層骨架），讓 Claude 自主組裝而非填空。若有外部工具硬編碼 `slack-templates.md` 路徑，需同步更新至 `slack-principles.md`。

  ### 新增

  - `slack-principles.md` Section 7 **視覺節奏**：`>` quote 與 code block 使用時機、5 層視覺強度層次、排版節奏硬規則
  - `slack-principles.md` Section 8 **場景 Icon 快查**：4 大類 11 個場景的 icon 組合起點（事件管理 / 開發日常 / 進度管理 / 架構與決策）
  - Icon 語義字典擴充 16 → 29 個（新增 🔍 ⚡ 🔐 📦 🗂️ 🏷️ ✨ 🧹 🌐 💥 🔑 📉 等）
  - 4 層骨架各層標題加對應 icon（📌 💡 📊 🔧）
  - Icon 使用密度原則：目標每條訊息 5-10 個 icon，明確首行 / 層標題 / 關鍵 bullet 三級規則

  ### 變更

  - `slack-audience-profiles.md` 重寫 v2.0.0：廢除 7 張「完全保留 / 壓縮 / 移除」表格，改為 reader mental model + 3 條決策原則，讓 Claude 自主判斷
  - `commands/slack.md` A2 / A2.5 指引更新（載入規範庫 → 自主組裝）
  - `audit-checklists.md` + `config-map.md` 同步更新

  ### 部署

  ```bash
  pnpm run d:setup
  ```

## 1.3.2

### Patch Changes

- Worklog 半自動化（draft + confirm + MCP submit）

  - SessionEnd hook 自動抓 session metadata 寫入 worklog-drafts.jsonl（≥60s session、解析 branch→ticketKey、收集 commits）
  - Console 新增 Worklog Drafts tab：列表 / 編輯 / 批次略過
  - `/worklog` slash command：per-draft [d]/[m]/[c:]/[t:]/[n]/[x] 確認 → MCP 批次提交至 Jira
  - `libs/core/worklog.mjs` 新增：JSONL reader/writer（readDrafts / dismissDrafts / updateDraft）
  - `paths.mjs` 新增 sessionState、worklogDrafts 兩個路徑 entry

## 1.3.1

### Patch Changes

- v1.3.1 — Slack 區塊化輸出 + 結構強化 + Description 深化

  ### 新增

  - Multi-audience 區塊化輸出：指定 ≥2 audience → 自動拼裝為單一訊息（每區塊各一 audience + 統一 TL;DR）
  - `ued` audience profile：UI/UX Designer 專用視角（UI 表現、fallback 設計、設計時程）
  - 統一發送目標確認：所有訊息呈現 [d]/[m]/[c:]/[t:] 4 選一，無預設
  - 結論先行強制：所有模板首行必為「結論行」+ status icon
  - 4 層通用結構：結論 → 原因 → 表現 → 方案
  - Icon Palette：嚴重度 / 狀態 / audience / 動作統一 icon
  - 8 強制規則 section（結論先行 / 4 層 / 區塊分隔 / 強調 / Icon / Mention / URL / 長度）
  - 5 個新場景模板（design review、tech debt、cross-team、dependency change、multi-audience incident）
  - 場景關鍵字 → 模板 ID 對照表（A1 場景判斷強制查）
  - Anti-Patterns section（常見錯誤示範）

  ### 變更

  - 移除 `exec` audience（使用者組織不存在）
  - Channel 推斷從「自動套用」降為「提示確認」（顯式 audience 永遠優先）
  - Audience-first 識別：context 推斷 > channel hint

  ### Description 深化

  - root `package.json` description 更新（提及 Slack / Hooks / Skills / AI 資源）
  - `apps/dotfiles/package.json` description 更新（提及 Slack audience 區塊化）
  - `packages/share/package.json` description 補完
  - `CLAUDE.md` 新增「v1.3.x 智能能力」section

  ### 部署

  ```bash
  pnpm run d:setup
  ```

## 1.3.0

### Minor Changes

- v1.3.0 — Slack audience-aware 輸出 + claude-md 精簡 + Slack 全鏈路加固

  新增：

  - Slack audience-aware 輸出：根據對象（rd / pm / mkt / qa / ops / exec / mixed）動態調整訊息詳細度、用詞、強調點
  - Slack 自主判斷四維度：audience / channel / type / thread_ts 自動推斷 + 信心分級（high/medium/low）
  - Thread reply 自動識別：使用者貼 Slack permalink → 自動切 thread reply 模式
  - 新增 `docs/slack-audience-profiles.md`（7 profile + channel mapping + Channel ID 前綴對照）
  - 新增 `claude-md/15-self-correction.md`（8 條自我糾正規則）
  - commands/slack.md Step A1.5（4 維度識別）+ A2.5（套用 profile）+ A4.0（信心閘門）+ 升級 A4.2 UI
  - docs/slack-templates.md 25 個模板各加 audience 變體 footer

  修改：

  - claude-md 03/07/09/10/13 精簡（去除冗餘，保留核心紅線）
  - 04-verification：新增「何時不需要 web search」
  - 05-security：新增 bypassPermissions 風險揭露
  - commands/slack.md：廢棄 ab-slack，新命名 v4.0.0 + Step A2 強制 Read
  - docs/audit-checklists.md：補全 Slack / docs / claude-md 16 個 section 等檢查項；4 → 5 個 docs；G+H 系列 audience 檢查項
  - docs/config-map.md：更新至 v1.3.0 結構
  - scripts/build-claude-dev-plugin.sh：新增 docs/\* glob 部署
  - mcp.yml：新增 @modelcontextprotocol/server-slack

  移除：

  - docs/pua-opt-in.md（Pua plugin 殘留）
  - docs/project-tags.md（Pua 殘留）

## 1.2.1

### Patch Changes

- 4f94926: **v1.2.1 — 3 個 HIGH 問題修復**

  ### 修復

  - **state.mjs lock silent write**：`stateWrite` 在鎖逾時（`_lockGloballyFailed`）時現在正確跳過寫入，避免多 session 競態（先前 fast-fail flag 有設但寫入路徑沒檢查）
  - **docs-freshness 測試誤報**：移除將 `d:doctor` 標記為過時命令的黑名單條目（d:doctor 已是 v1.2.0 正式命令）
  - **agents/ 補 ab- prefix**：`architect.md` → `ab-architect.md`、`debugger.md` → `ab-debugger.md`，兌現 v1.2.0 release notes「all ab-tao resources standardized with ab- prefix」承諾；同步更新 `13-agent-routing.md`、`14-dag-parallel-execution.md`、`config-map.md`、`config-classifier.mjs`、`auto-plan.mjs`

  ### 升級提示

  安裝 v1.2.1 後需手動清除舊 agent 檔案，否則 `~/.claude/agents/` 會同時存在舊版（`architect.md`、`debugger.md`）與新版：

  ```bash
  rm -f ~/.claude/agents/architect.md ~/.claude/agents/debugger.md
  pnpm run d:setup
  ```

## 1.2.0

### Minor Changes

- v1.2.0：Setup UX 全面修復 + Doctor CLI + Memory Index

  **Setup 互動流程修復**

  - Slack 通知設定移至 configure() 階段，在 spinner 啟動前完成詢問，修復 UX 倒序問題
  - 移除 Slack User ID 配置（DM 發送改由 Slack MCP 自動獲取使用者）
  - 修復 d:setup lock spam（80+ 鎖逾時警告）：updateStateJson 改批次寫入 + fast-fail flag
  - 修復 d:doctor 未在 root package.json 註冊（ERR_PNPM_NO_SCRIPT）
  - 修復 pua plugin 安裝名稱錯誤（marketplace: pua vs installName: pua-skills）

  **Doctor CLI**

  - `pnpm run d:doctor`：ghost entries / drift SHA / dead sync paths 診斷
  - `--fix` 旗標：自動清除 state.json ghost 條目與失效 sync 路徑

  **Memory Index**

  - memory-index.mjs 部署至 ~/.claude/.ab-tao/bin/
  - SessionStart hook 自動重建 MEMORY.md 索引

  **Plan 歸位**

  - SessionEnd hook 自動將 plan 依 frontmatter ticket/topic 歸位至正確路徑

  **資源命名標準化**

  - 所有 ab-tao 自管資源統一加上 ab- 前綴（commands/agents/rules/skills）
  - ab-slack command：分離模板庫至 slack-templates.md + 強制發送確認流程

### Patch Changes

- Updated dependencies
  - @ab-tao/commons@1.0.2

## 1.1.0

### Minor Changes

- 73bb9e6: ab-async 升級（E1-E4）：iCloud 雙向同步新增安全驗證、支援 `setup:from-icloud` 指令、preferences 偏好同步優化、`sync:push/pull/status` 子指令補齊
- v1.1.0：Console 全方位升級 + Dotfiles Hotfix

  ## @ab-tao/console — 重大功能升級

  **Batch A（資料層修復）**

  - Resources 來源 source-classifier 分類（ab-tao/ecc/anthropic/custom）
  - MCP 多源整合（servers + plugins）
  - settings.mjs hooks/permissions/settings PATCH/PUT 端點
  - ai-usage API（metrics.jsonl）

  **Batch B（IA 重整）**

  - 21 路由整合為 6 大區（Dashboard/Resources/Integrations/Configuration/Actions/About）
  - SectionTabs 組件統一 tab 切換 + URL ?tab= 深鏈
  - ConsoleLayout flat sidebar 6 項

  **Batch C（深度功能）**

  - ReposView role 分組折疊（main/temp/archived）
  - 所有圖表規範化：320px + autoresize + 四態（loading/error/empty/data）
  - 新增 AiUsageMultiBar / RepoTechStackHeatmap / HooksHealthRadar / McpServerTimeline
  - Actions dry-run toggle + retry 狀態機 + traceId

  **Bug Fixes**

  - /api/repos 資料源修正（改讀 last-report-data.json）
  - MemoryView 新增全局+專案聚合統計列
  - biome auto-fix 誤 rename template 綁定變數修復

  ## @ab-tao/dotfiles — Hotfix

  **F-1**：Slack 訊息傳送強制確認規則（05-security.md）
  **F-2+F-3**：permissions.allow preserve / deny union 非對稱策略，移除 extraKnownMarketplaces
  **F-4**：ccline 偵測改用 pnpm list -g，修復 chmod idempotency
  **F-5**：d:setup 後配置 drift 寫 marker，由 SessionStart hook 一次性消費
  **E-4**：SetupWizard dark mode / 響應式 / 節點 id 衝突修復
  **E-6**：d:setup 啟動時寫 state.lock + exit 清理
  **D（Batch D）**：\_abTao 加入 preserve-policy 白名單

- 73bb9e6: 修復 source-sync.mjs 覆寫 hooks.json 導致 ab-tao hook 全部失效的根本原因；修復 hook-handler.sh 佇列競態、install-claude.sh manifest python3 依賴、uninstall.mjs 刪除非 ab-tao hooks 等 P0 安全問題

### Patch Changes

- 2c8440d: 移除 phase-complete 的 mempalace 偵測與安裝邏輯，ENHANCERS 只保留 RTK
- Updated dependencies [2c8440d]
  - @ab-tao/commons@1.0.1
