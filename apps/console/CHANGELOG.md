# @ab-tao/console

## 0.3.2

### Patch Changes

- 32ded3f: 移除 iCloud 偏好同步功能 + Claude 設定 backport（個人規則 v1.15.0）

  - **移除 iCloud 同步全套**：`ab-async` / `d:prefs-sync` / `--from-icloud` / console SyncView / `sync99Local` 偏好下線；user-private 偏好改由 git-based 同步處理（見 `ab-config-sync`）。
  - **settings.template.json backport**：新增 `chrome-devtools` / `context7` / `anysearch` MCP server；補破壞性命令 deny（git `checkout --`/`clean`/`stash drop`、`terraform`/`pulumi`/`cdk destroy`、docker `compose down -v`/`system prune`/`volume rm`）；新增 `warp` plugin；`attribution.sessionUrl=false`。
  - **新增 UserPromptSubmit hook**：偵測 Jira ticket / Confluence URL / 破壞性命令關鍵字並注入相關 context（kill-switch `CLAUDE_PROMPT_ENRICH=0`）。hook defs 由 8 → 9。
  - **claude-md / docs**：新增 `/config` 快速設定章節（10-config-management）與 `Tool(param:value)` 權限語法章節（13-agent-orchestration）；local-tools 新增 anysearch 安裝指引；STRUCTURE / config-map 版號與計數校正（skills 31、hooks 9）。
  - **fix(console)**：el-text `type` 由無效值 `secondary` 改為 `info`。

## 0.3.1

### Patch Changes

- Worklog 半自動化（draft + confirm + MCP submit）

  - SessionEnd hook 自動抓 session metadata 寫入 worklog-drafts.jsonl（≥60s session、解析 branch→ticketKey、收集 commits）
  - Console 新增 Worklog Drafts tab：列表 / 編輯 / 批次略過
  - `/worklog` slash command：per-draft [d]/[m]/[c:]/[t:]/[n]/[x] 確認 → MCP 批次提交至 Jira
  - `libs/core/worklog.mjs` 新增：JSONL reader/writer（readDrafts / dismissDrafts / updateDraft）
  - `paths.mjs` 新增 sessionState、worklogDrafts 兩個路徑 entry

## 0.3.0

### Minor Changes

- Console Wave 1–7 全面升級 + SSE 穩定化

  **UI 修復（Wave 1）**

  - SettingRow grid layout 修正 + Preferences 寬度撐滿

  **Resources 補強（Wave 2）**

  - 表格新增說明欄（frontmatter description 解析 + 搜尋）

  **Repos（Wave 3）**

  - 掃描/開啟修復（open API + 掃描跳轉 Actions/Scan + 預填提示）

  **Hooks UI（Wave 4）**

  - toggle 啟停 / 新增 / 刪除 / redeploy 按鈕

  **Actions（Wave 5）**

  - SSE 還原、dryRun 全面實作、TTY fallback

  **ECharts（Wave 6）**

  - 子流程節點補強 + 移除 docs/flows 目錄

  **About 頁（Wave 7）**

  - 6 大區塊全面補強

  **基礎建設**

  - SSE 重構：server-sent events 穩定化
  - Actions server routes 穩定化
  - About 保護策略展開

## 0.2.0

### Minor Changes

- e5b603c: feat(console): Vue 3 + Element Plus + ECharts 後台控制台 v0.1.0

  Wave 0–5 完整實作：

  - Wave 0：Vite 6 + Vue 3.5 + TypeScript 嚴格模式 腳手架
  - Wave 1：8 個唯讀 Dashboard 視圖（Overview、Hooks、State、Memory、MCP、Repos、TechStacks、Environment）
  - Wave 2：Resources CRUD（Skills / Commands / Agents / Rules enable/disable）
  - Wave 3：Config 開關中心（Permissions、AI Model、Hooks、Plugins、Preferences）
  - Wave 4：SSE 長任務整合（d:setup、d:scan、iCloud sync）
  - Wave 5：ECharts 進階圖表（Calendar Heatmap、Bar、Sunburst、Scatter）

  啟動：`pnpm run cs:dev`

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
