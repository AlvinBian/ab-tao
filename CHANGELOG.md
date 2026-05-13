# Changelog

本文件記錄所有重要變更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，版本遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [1.7.0] — 2026-05-13 — Context Cold-Start Optimization v2

### ✨ 三層載入架構（v1.7.0 核心）

- feat: CLAUDE.md 重構為三層架構 — 首錨定 / 高風險紅線 / 對話初始錨定 / 按需載入表
- feat: `rules/code-quality.md` 新增 — 版本管理 + 程式碼規範，.vue/.ts 編輯時條件注入
- feat: `rules/settings-edit.md` 新增 — 設定檔修改紅線，.claude/settings.json 編輯時條件注入
- feat: `rules/vue-nuxt.md` 補齊 quality_targets 區塊（從 06-quality-targets 合併）
- feat: `docs/state-system-details.md` 新增 — 資料夾命名 + Plan Frontmatter Convention（從 08 按需指向）
- chore: 刪除 `claude-md/06-quality-targets.md`（內容合入 rules/vue-nuxt.md）
- chore: 刪除 `claude-md/10-config-management.md`（內容移至 rules/settings-edit.md）
- refactor: `03-code-standards.md` 瘦身 — 版本管理 / 規範細節移至 rules/code-quality.md
- refactor: `08-state-system.md` 瘦身 — 資料夾組織 / Plan Frontmatter 細節移至 docs/state-system-details.md
- docs: `docs/config-map.md` 更新至 v1.7.0（12 個 claude-md，9 個 rules，12 個 docs）
- docs: `docs/audit-checklists.md` 更新計數（claude-md 14→12，rules 7→9，docs 9→12）

### ✨ 冷啟動優化 Phase 1（v1.6.1）

- feat: `docs/agent-dag-parallel.md` 新增 — DAG 並行執行細節（從 13 按需指向）
- feat: `docs/self-correction-details.md` 新增 — §5 目標錨定 + §7 半成品禁止（從 15 按需指向）
- refactor: `13-agent-orchestration.md` 瘦身 — DAG 完整內容移至 docs/agent-dag-parallel.md
- refactor: `15-self-correction.md` 精簡 9→5 節 — §2+§4 合併；§5+§7 移至 docs；移除 @import failure-patterns
- chore: CLAUDE.md 移除 4 個假按需 @import（docs/rtk / audit-checklists / config-map / local-tools）

### 📊 Context 效益

- 冷啟動從 ~975 行降至 ~277 行（-72%，估節省 ~13,960 tokens）
- always-on 載入：6 個核心 section（首錨定 3 + 高風險紅線 2 + 對話初始錨定 3 = 8 節）
- 條件注入：9 個 rules/ 規則（paths: frontmatter 觸發）
- 按需 Read：4 個 claude-md + 5 個 docs（LLM 依觸發詞自主載入）

## [1.6.0] — 2026-04-27 — Greenfield Release

### 🚀 M1 Foundation

- feat: commons-loader 讀 `_ab-tao-paths.json` manifest，動態解析各 source 安裝路徑（M1.2 P0）
- feat: `P.abTao` 子目錄命名空間正式化（`runtime/memory/corrections/metrics/logs/schemas`）
- chore: 殘留清理 — 刪除 3 個 deprecated skill dirs（`old-skills/`）、plugin 重分類（6 enabled → 4，2 改 on-demand）
- fix: `_ab-tao-paths.json` manifest 補上 gstack / bmad / ai-sdlc 三個 source 條目

### ✨ M2 Core Features

- feat: 10 source `SOURCES_CONFIG` — 加入 `curatedResources` 精選清單 + `installMode`（copy/plugin）欄位
- feat: 5 個新 CLI 指令
  - `d:profile <name>` — profile 快速切換（7 個 preset）
  - `c:plugin [--enable|--disable|--audit]` — plugin 狀態管理
  - `c:metrics [--summary|--export]` — 使用指標查看
  - `c:memory [--list|--list-federated|--decay-scan]` — 記憶體管理
  - `c:skills:curated [--from <source>]` — 精選 skills 查看與安裝
- feat: `state.json` 加入四個 sub-schema（ADR-001）
  - `federated` — 跨來源記憶索引
  - `failurePatterns` — append-only 失敗模式自我演進記錄
  - `intentCache` — `/ai` dispatcher intent 快取
  - `metricsSnapshot` — 使用指標快照
- feat: `FEATURE_REGISTRY` 功能登記表 + `d:uninstall --feature <name>` 精細移除
- feat: `settings.json` 新增 `_abTao` 區段（`voiceTrigger` / `costRouting` / `tddStrictMode` / `securityMode`）
- feat: failure-patterns session-end hook — append-only 自我演進，規則本體永不變

### 🤖 M3 AI Dispatcher & Chain Commands

- feat: `/ai` rule-based dispatcher — 30+ intent 映射，自動路由到對應命令 / agent
- feat: Chain commands
  - `/chain-product` — 完整產品流程（specify → architect → check → verify）
  - `/chain-tdd` — TDD 流程（specify → 測試骨架 → check --tdd-strict → verify）
- feat: federated memory `c:memory --list-federated` — 跨 source 記憶統一視圖
- feat: Console 17 view scaffold + 8 SSE channel（即時推送）
- feat: Profile / Metrics / AI Features view 強化（M3.3）

### 📚 M3 Docs & Polish

- docs: 14 個新文件（5 段式架構）— 完整 API reference + 架構指南
- docs: 3 個新 `claude-md` section（`16-ai-dispatcher.md` / `17-chain-commands.md` / `18-failure-patterns.md`）
- docs: README v1.6.0 完整重寫 — 5 段式 introduction + 能力矩陣表
- docs: 5 個 walkthrough 文件（`apps/dotfiles/docs/walkthroughs/`）
  - `product-flow.md` — 從需求到 ship 完整流程
  - `tdd-flow.md` — TDD 完整流程
  - `solo-founder.md` — 個人 / startup 使用情境
  - `enterprise-team.md` — 多人 / 合規場景
  - `ai-sources-setup.md` — AI sources 設定完整流程

### 🔗 M3.5 Chain Commands & Federated Memory

- feat: `/chain-product` — 3 步產品流程（specify → reviewer agent → verify），metrics 追蹤
- feat: `/chain-tdd` — 4 步 TDD 流程（specify → architect agent → check --tdd-strict → verify）
- feat: federated memory CLI 三件套（`c:memory --list-federated` / `--register-federated` / `--federate`）
- feat: 8 個 recipe 文件（5 段式，含 PR review / TDD flow / profile switch / federated memory 等）
- feat: Console AiSection 新增 Chains tab（流程圖展示）+ AI Sources tab（精選清單）

### 🌿 M3.6 Greenfield 收編

- feat: `/ai` dispatcher — 39 條 rule-based intent 映射，未命中寫入 `unmatched-intents.jsonl`（v1.7+ trigger）
- feat: `session-end-failure-collect.sh` — 偵測糾正信號（不對/重來/應該是...），append-only `failure-patterns.md`
- feat: `15-self-correction.md` 末行加入 `@.ab-tao/corrections/failure-patterns.md`（永不再改，ADR-002）
- feat: Console MetricsSection — 3 tabs（即時指標 SSE / 升級觸發條件 / Failure Patterns SSE）
- feat: 3 個 SSE route（`/api/sse/metrics` / `/api/sse/failure-patterns` / `/api/sse/install-progress`）
- feat: gstack guard patterns — `pre-tool-bash.sh` 8 條高風險 pattern（publish、force-with-lease 等）
- feat: gstack guard — `pre-tool-bash.sh` 新增 8 條高風險 pattern（npm/yarn/pnpm publish、force-with-lease 等）
- feat: plugin install-fallback helper（`install-fallback.mjs`）— plugin 失敗自動降級 copy + 狀態記錄
- feat: `commons-loader.mjs` 加入 `getSourceInstallMode()` + `pluginMode` 欄位（installMode:plugin 感知）
- feat: Console demo-data — 5 個 fake project（kkday-email / vue-spa / nuxt-prod / monorepo / solo-spike）
- docs: `metrics-fields.md` — 9 個 metrics 事件類型 + v1.7+ 升級觸發閾值完整說明

### Breaking Changes

- 本版本為 greenfield 首次正式發布，不維護 v1.5 相容性
- `state.json` schema 加入 4 個新 sub-schema，舊格式需重新初始化
- `plugins.yml` 中 6 個 plugin 改 `enabled: false`（改為 on-demand 模式）
- `bin/profile.mjs` 新 CLI，`d:profile` 取代直接修改 `profiles/active.json`

詳細升級指引見 [MIGRATION-v1.6.md](MIGRATION-v1.6.md)

### 🔧 Bug Fixes

- fix: `d:setup [6/7]` manifest array reader 漂移 — `sync-sources.mjs::countResources()` 和 `source-sync.mjs::loadFromCache()` 補齊 Array.isArray pattern
- fix: AI sources 同步狀態分裂 — `ai-source-select` needSync 改用 `.versions.json` sha 判斷，spinner 顯示真實計數，失敗 source 從回傳值過濾
- fix: `sync-sources.mjs` 移除 skills-mp（repo URL 異常），git clone 失敗改串接 stderr，加 `validatedAny` 守護
- fix: `validate-structure.mjs` EXPECTED_STRUCTURES 補齊 9 個 source（gstack/spec-kit/ai-sdlc/bmad）
- refactor: `source-meta.mjs` 集中 icon/label map（消除 plan-view / phase-complete / phase-plan 三處重複）
- refactor: `prune-orphans.mjs` KNOWN_SOURCES 改從 SOURCES_CONFIG 自動派生
- docs: README 三語（zh-TW/zh-CN/en）補 gstack/spec-kit/ai-sdlc/bmad sources 表格

### 📐 M4 Code Standards — Barrel Export Rules

- feat: 新增 `rules/barrel-exports.md` 條件載入規則 — 7 條 barrel export 規範（統一導出 3 + 統一引入 2 + 適用範圍 1 + 遷移策略 1）
- feat: `claude-md/03-code-standards.md` 程式碼規範加第 7 條 pointer 指向 barrel-exports 規則，確保冷啟動可發現
- docs: `docs/config-map.md` rules 樹更新（5 → 6 個條件規則）
- docs: `docs/audit-checklists.md` 【審查設定】checklist 計數 5 → 6 + 加 barrel-exports sub-rule 完整性檢查
- chore: 全域配置版本號 `CLAUDE.md` + `config-map.md` 升至 `v1.6.0`

> 規則本體 language-agnostic，不綁副檔名；paths 覆蓋所有 JS-family（`.vue .ts .tsx .js .jsx .mjs .cjs`）；實際入口檔語言由當前專案技術棧決定。

### 🔍 M5 Verification Rules — Figma MCP 規格擷取

- feat: `claude-md/04-verification.md` 新增 Figma MCP 規格擷取強制規則
  - 禁止單靠 `mcp__claude_ai_Figma__get_screenshot` 實作 Figma 設計（截圖只回圖片，拿不到 layer 名 / 尺寸 / 字體 / 顏色 hex / design tokens / Code Connect 對映）
  - 主要工具明確為 `get_design_context`（回傳 React+Tailwind 結構 + 設計 hints + tokens）
  - `get_screenshot` 降為視覺輔助：可與 `get_design_context` 並用，禁止單獨作為實作依據
