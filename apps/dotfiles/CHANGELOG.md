# @ab-tao/dotfiles

## 1.11.1

### Patch Changes

- refactor(claude): 配置整合優化(2/n) — 刪過時 gitnexus-integration.md（GitNexus 廢棄+無引用）；修矛盾：08 MEMORY hot index ≤10→≤15 行對齊 config-map、audit-checklists API 格式/分頁改「依專案契約」消除與 api-and-data 衝突；config-map 同步 vue-nuxt paths(+css/scss)/docs 29→28/系統參考 9→8

## 1.11.0

### Minor Changes

- refactor(claude): 配置整合優化(1/n) — always-on 規則歸屬下沉條件載入：DS token/JSDoc/響應式/三態 從 03-code-standards 移至 rules/vue-nuxt+typescript（省常駐 context）；13-agent GitNexus+Understand-Anything 改寫為 code-review-graph（單一工具涵蓋符號依賴+業務流程，移除廢棄工具引用）；api-and-data Migration 段去重引用 migrations.md

## 1.10.7

### Patch Changes

- ci(release): pnpm run release 末段自動補 git tag + GitHub Release（post-release.mjs，private package changeset tag no-op 的補償；冪等 + execFileSync 防注入）

## 1.10.6

### Patch Changes

- docs(claude): config-map / audit-checklists 同步 rules 8→9（新增 php-codeigniter.md）+ typescript paths 補 .js

## 1.10.5

### Patch Changes

- fix(claude): 08-state-system 冷啟動讀 system-patterns.md 改條件式（檔不存在則跳過，勿視為錯誤）

## 1.10.4

### Patch Changes

- feat(claude): 規則內容統一下沉 rules/ — git-and-pr 補 commit 工作流/git 操作授權/push tracking/不標對齊；typescript 補 JSDoc-as-types Object 陷阱+boolean equality 並擴 paths 含 .js；新增 php-codeigniter.md；對應 memory 瘦身

## 1.10.3

### Patch Changes

- feat(claude): 新增巢狀 sub-agent 條件式優先編排規則（13-agent-orchestration 調度規則第 5 條）

## 1.10.2

### Patch Changes

- a99129c: feat(claude): 新增復用/分層/解耦工程原則規則 + 配置一致性修復

  - 新增 `rules/reuse-and-decoupling.md`（條件載入，編輯程式碼檔時注入）：復用優先搜尋鏈、DRY 分層抽取（Rule of Three + 職責去處表）、解耦原則（單一職責 / 依賴方向單向 / 元件薄 / 面向介面 / 副作用隔離 / 最小公開面）、反向氣味清單
  - `claude-md/03-code-standards.md`：新增「復用 · 分層 · 解耦」核心原則小節（always-on 高層心智模型）；修復失效的 `rules/code-quality.md` 斷鏈指標 → 改指向實際存在的 typescript / vue-nuxt / barrel-exports / reuse-and-decoupling
  - `commands/plan.md`：回填 runtime 較新版本（含 `EXECUTE_COMMAND:` 自動派發 + Mandatory Post-Execution Hooks + Done When）
  - docs 同步：`config-map.md` rules 7→8 檔、`audit-checklists.md` 審查清單同步；個人規則版本標記統一 v1.7.2

## 1.10.1

### Patch Changes

- fix(zsh): 修復模組重複載入 — symlink 清理 + module guard

  **問題根因**：舊版架構（`zsh/.zshrc.d/conf/` 實體檔）升級為 symlink 架構後，`d:setup` 多次執行導致 `conf/` 出現 ` 2.zsh` / ` 3.zsh` 重複 symlink，各模組被 source 三次，fnm `chpwd` hook 累積三份，換目錄時出現三行 `Using Node xxx`。

  **`install.sh`**：

  - 部署前清除 `<name> [0-9].zsh` 重複 symlink（空格 + 數字命名，由舊版 `ln` 行為產生）
  - 清除非 symlink 實體檔（舊版複製遺留），確保 `ln -sf` 等冪

  **zsh modules（4 個）加 module-level guard**，防重複 source：

  - `00-env.zsh`：避免重複 `eval fnm env`（fork 子進程）
  - `10-history.zsh`：避免重複呼叫 `_update_project_history`
  - `60-tools.zsh`：避免重複 `eval zoxide init`（fork 子進程）
  - `90-plugins.zsh`：避免重複 `eval starship init`（fork 子進程）

## 1.10.0

### Minor Changes

- 93ecb15: feat: d:setup 交易化安裝 — 快照+全量回滾防配置失效

  新增 `libs/install/transaction.mjs` 交易模組，讓 d:setup 在任何 mutation 前先快照
  mutable roots（~/.claude 配置目錄、zsh 模組、settings.json 等），全部成功才 commit，
  中途 crash 或取消則自動還原至安裝前狀態。

  **核心改動**

  - `transaction.mjs`：`beginTransaction / commitTransaction / rollbackTransaction` 狀態包裝 +
    `snapshotTargets / restoreFromSnapshot / removeCreated` 純函式（可注入 targets 供測試）
  - `backup.mjs` `cpDir`：新增 `opts.skipNames`（`Set<string>`），命中 basename 整支 subtree 跳過；
    解決 `sheldon/repos/**/.git/objects` 數千小檔觸發 macOS `ETIMEDOUT` 的問題
  - `DEFAULT_TARGETS`：`~/.zshrc.d` 由整 dir 改為 per-file（`conf/` + `.prefs.zsh` + `sheldon/plugins.toml`），
    sheldon repos git cache 完全排除於快照範圍
  - `setup.mjs`：`beginTransaction()` 包 `withSpinner`，消除 UI hang；8 個接線點覆蓋
    crash / 取消 / 核心缺檔詢問 / commit 全路徑
  - 17 個單元測試（含 skipNames、per-file zshrc.d、best-effort rollback）

## 1.9.0

### Minor Changes

- feat(d:setup): preferences 持久化系統 + BACK Symbol 全鏈路修補

  **preferences-store（新模組）**

  - 新增 `libs/core/preferences-store.mjs`：`~/.claude/.ab-tao/preferences.json` 永久偏好存儲
  - 支援 17 個 promptId，覆蓋 9 個接線檔（scan / features / zsh / plugins / claude-base / repos / project-install / slack / tech-select）
  - 原子寫入（tmp→rename）+ 獨立 preferences.lock 防並發損壞
  - `prefsRead / prefsWrite / prefsPatch / prefsGet / prefsRecordChoice / prefsReset / prefsMigrateFromSession`
  - 隱私聲明：含 Slack Channel ID + 私有 repo 名稱，user-private，不參與 iCloud 同步

  **BACK Symbol 全鏈路修補**

  - `libs/pipeline/tech-select-ui.mjs`：補 BACK import + 2 處 BACK 短路（首輪審查遺漏的接線檔）
  - `libs/phases/phase-adjust.mjs`：`adjustGlobalSettings` 補 `if (slackEnv === BACK) return`
  - `libs/features/claude-base.mjs`：`configure` 補 `if (slackEnv === BACK) return BACK`
  - 確保 ESC 不因 try/catch 靜默吞噬或 truthy 比較推進錯誤分支

  **測試基礎建設**

  - 新增 `__tests__/preferences-store.test.mjs`（7 個測試）
  - 新增 `__tests__/prompts-wrappers.test.mjs`（4 個 wrapper × 多情境）
  - 12 個既有測試檔：`from 'vitest'` → `from 'node:test'`（零修改通過）
  - `rules-whitelist.test.mjs` whitelist 更新為 7 個規則檔（含 barrel-exports）

  **文件同步**

  - `claude/docs/config-map.md`：.ab-tao/ 樹狀圖補 preferences.json + preferences.lock（⚠️ user-private）
  - `docs/sync-setup.md`：.chezmoiignore 補隱私說明，注意事項補 preferences.json 禁止 sync 規則
  - `libs/core/preferences-store.mjs` / `libs/external/ab-async.mjs`：頭部文件完整化

## 1.7.2

### Patch Changes

- feat(zsh): gitnexus aliases 搬移至 30-aliases.zsh 並補齊全套指令

  - 將 gitnexus alias 從 `60-tools.zsh` 搬至語義正確的 `30-aliases.zsh`
  - 原有 6 個 alias 擴充為 23 個，覆蓋所有 gitnexus CLI 指令
  - 新增：`gnidx` `gnrm` `gndr` `gnui` `gnmcp` `gnq` `gnctx` `gnimp` `gncy` `gndc` `gnpub` `gngrp` `gngrpl` `gngrps` `gngrpi` `gngrpq` `gnsetup`

## 1.6.0

### Minor Changes

- feat: v1.6.0 Greenfield Release — AI Dispatcher、Chain Commands、Federated Memory

  **M1 Foundation**

  - commons-loader 讀 `_ab-tao-paths.json` manifest，動態解析各 source 安裝路徑
  - `P.abTao` 子目錄命名空間正式化（runtime/memory/corrections/metrics/logs/schemas）
  - 殘留清理：deprecated skill dirs、plugin 重分類（6 → 4 enabled，2 改 on-demand）

  **M2 Core Features**

  - 9 source `SOURCES_CONFIG` 加入 `curatedResources` 精選清單 + `installMode`（copy/plugin）欄位
  - 5 個新 CLI：`d:profile` / `c:plugin` / `c:metrics` / `c:memory` / `c:skills:curated`
  - `state.json` 加入 4 個 sub-schema：federated / failurePatterns / intentCache / metricsSnapshot
  - `FEATURE_REGISTRY` + `d:uninstall --feature` 精細移除
  - `settings.json._abTao` 區段（voiceTrigger / costRouting / tddStrictMode / securityMode）

  **M3 AI Dispatcher & Chain Commands**

  - `/ai` rule-based dispatcher — 39 條 intent 映射，自動路由到對應命令 / agent
  - `/chain-product` / `/chain-tdd` Chain commands
  - Federated memory CLI 三件套
  - Console 17 view scaffold + 8 SSE channel（即時推送）
  - M3.6：session-end failure-collect hook、voice-trigger hook、cost-aware routing hook

  **Bug Fixes（AI sources sync）**

  - `ai-source-select` needSync 改用 .versions.json sha 判斷，spinner 顯示真實計數
  - `sync-sources` 移除 skills-mp，git clone 錯誤改串接 stderr
  - 新增 `source-meta.mjs` 集中管理 icon/label map（消除三處重複）
  - `prune-orphans` KNOWN_SOURCES 改從 SOURCES_CONFIG 自動派生

### Patch Changes

- Updated dependencies
  - @ab-tao/commons@1.1.0
- feat(claude/rules): `claude-md/04-verification.md` 新增 Figma MCP 規格擷取強制規則 — 禁止單靠 `get_screenshot` 實作；`get_design_context` 為主要工具

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
