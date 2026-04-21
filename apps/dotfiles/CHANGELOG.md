# @ab-tao/dotfiles

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
