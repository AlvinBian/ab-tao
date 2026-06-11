# `~/.claude/` 配置架構說明

> **版本**：v1.8.0 ｜ **最後更新**：2026-06-11
>
> 本文件說明 `~/.claude/` 各目錄與檔案的職責，以及整體設計邏輯。

## 1. 核心定位

`~/.claude/` 是 Claude Code 的個人客製化配置目錄，設計遵循三個原則：

🧩 **模組化**：每個規則拆成獨立 `.md` 檔，職責單一，修改不會污染其他模組。

⚙️ **條件載入**：`rules/` 下的規則只在編輯特定路徑的檔案時才注入上下文，避免無謂 token 消耗。

🔔 **事件驅動**：`hooks/` 在 session 生命週期事件（啟動、工具呼叫前後、結束）自動執行腳本，零 context cost。

**三層配置邊界**

| 層級 | 路徑 | 說明 |
|---|---|---|
| 全域 | `~/.claude/` | 所有專案共用的規則、工具、記憶 |
| 專案 | `<repo>/.claude/` | 各 repo 各自的 `CLAUDE.md` 與 `settings.json` |
| 機器 | `~/.claude/settings.local.json` | 本機獨立設定，不加入版本控制（目前未建立）|

優先級：企業設定 ＞ 全域 `settings.json` ＞ 專案 `.claude/` ＞ plugin 預設。

## 2. 頂層目錄樹

```
~/.claude/
│
├── CLAUDE.md                  ✅ 全域規則入口（純 @import 索引，≤80 行）
├── settings.json              ✅ 主配置（hooks + mcpServers + permissions + env）
├── hooks.json                 📦 舊版 hooks 備份（已遷入 settings.json，勿手動編輯）
├── history.jsonl              📦 對話歷史快取（Claude Code 原生）
├── mcp-needs-auth-cache.json  📦 MCP 授權狀態快取
├── .plans-relocated           📦 plans 目錄搬遷標記
│
├── claude-md/                 ✅ 規則模組（14 個 .md，透過 @import 常駐載入）
├── rules/                     ⚙️ 條件規則（paths: frontmatter 觸發，9 個 .md）
├── docs/                      📖 參考文件（按需 @import 或手動查閱，28 個 .md）
├── agents/                    🤖 子代理定義（9 個，Task tool 呼叫時啟用）
├── commands/                  ⌨️ 斜線命令（17 個，/command 語法觸發）
├── skills/                    🛠️ 技能模組（38 個，pattern 匹配或 Skill tool 呼叫）
│
├── hooks/                     🔔 事件驅動腳本（8 個 def + .sh）
│   ├── defs/                  ⚙️ Hook 定義（source of truth，已合併進 settings.json）
│   └── *.sh                   📦 Hook 執行腳本
│
├── projects/                  🔒 專案隔離記憶與計畫（10 個 <encoded> 子目錄）
├── plans/                     📦 Claude Code 原生 plansDirectory（Feb 2026+）
├── tasks/                     📦 Claude Code 原生 tasks（Jan 2025+）
│
├── sessions/                  📦 Session 對話快照（Claude Code 原生）
├── session-env/               📦 Session 環境變數快照
├── shell-snapshots/           📦 Shell 工作目錄 + git 狀態快照
├── file-history/              📦 檔案修改歷史追蹤
├── image-cache/               📦 貼入圖片快取
├── paste-cache/               📦 剪貼板大段內容快取
├── cache/ / .cache/           📦 Claude Code 一般快取
│
├── backups/                   📦 設定檔備份
├── ide/                       📦 IDE 整合配置
├── claude-hud/                📦 HUD plugin 資料夾
├── plugins/                   📦 Plugin 定義（enabled 清單見 settings.json）
│
└── .ab-tao/                   📦 工具鏈運行時資料（metrics / corrections / profiles）
```

圖示說明：✅ always-loaded ⚙️ 條件載入 📦 運行時資料 🔒 使用者私有

## 3. CLAUDE.md 與 @import 載入鏈

`CLAUDE.md` 設計為「純索引」，自身不含任何規則，只做 `@import` 串接。Claude Code 啟動時讀取這份索引並依序注入所有被引用檔案的內容。

**載入順序與分組（共 17 個 @import）**

```
# 首錨定（最先載入，定義身份與輸出風格）
@claude-md/00-identity.md          → 資深全棧工程師身份
@claude-md/01-language.md          → 繁體中文輸出規範
@claude-md/02-response-format.md   → 依問題類型自動選擇輸出結構

# 技術與品質（業務邏輯核心）
@claude-md/03-code-standards.md    → 技術棧傾向、版本管理、程式碼規範
@claude-md/04-verification.md      → API 查證、Figma MCP、i18n 缺項
@claude-md/05-security.md          → 安全紅線（Git/Slack/env 操作）
@claude-md/06-quality-targets.md   → Core Web Vitals、bundle 上限、兼容性

# 降噪與配置（context 管理）
@claude-md/07-context-hygiene.md   → /compact 壓縮策略、條件載入規則
@claude-md/08-state-system.md      → Tasks/Plans/Memory 三工具邊界
@claude-md/10-config-management.md → 設定檔修改紅線

# 邊界與審查
@claude-md/11-audit-system.md      → 四種審查模式總綱
@claude-md/12-exceptions.md        → 偏離規則的合法情境

# 尾錨定（最後載入，最高覆蓋權重）
@claude-md/13-agent-orchestration.md → agent 路由、DAG 並行執行規則
@claude-md/15-self-correction.md     → 9 條自我糾正（loop 偵測、假設顯式化等）

# 參考文件（按需查閱）
@docs/rtk.md              → 輸出壓縮工具（-89% token）
@docs/audit-checklists.md → 四模式 checklist 完整版
@docs/config-map.md       → 目錄結構全圖
@docs/local-tools.md      → 本地工具安裝指引
```

**首尾錨定設計意義**：最先載入的 00-02 確立基礎身份與輸出風格；最後載入的 13、15 賦予最高覆蓋權重，確保 agent 調度與自我糾正邏輯不被中段規則覆蓋。

## 4. `claude-md/` 規則模組

14 個編號檔案，全部透過 `CLAUDE.md` 常駐載入。編號缺 09（已合併入 08）與 14（已合併入 13）。

| 編號 | 檔名 | 職責 | 核心概念 |
|---|---|---|---|
| 00 | identity.md | 首錨定：身份 | Vue/Nuxt/TS/PHP 資深全棧工程師 |
| 01 | language.md | 輸出語言 | 繁體中文；術語保留英文 |
| 02 | response-format.md | 輸出結構 | 單點查詢直答；架構設計四段式 |
| 03 | code-standards.md | 技術規範 | 版本管理、Simplicity First、barrel exports |
| 04 | verification.md | 查證規則 | web search 觸發條件；Figma MCP 工作流 |
| 05 | security.md | 安全紅線 | Git commit/push 三豁免；Slack 發送嚴禁 |
| 06 | quality-targets.md | 品質目標 | LCP/CLS/INP；bundle < 200KB |
| 07 | context-hygiene.md | 降噪 | /compact 保留 vs 可犧牲清單 |
| 08 | state-system.md | 狀態工具 | Tasks/Plans/Memory 三溫層邊界 |
| 10 | config-management.md | 設定紅線 | 哪些檔案 Claude 禁止主動修改 |
| 11 | audit-system.md | 審查模式 | 設定/UI/代碼/PR 四種模式 + 結束標誌 |
| 12 | exceptions.md | 豁免情境 | 快速草稿/忽略型別/歷史兼容三種 |
| 13 | agent-orchestration.md | 尾錨定：調度 | 資源速查表；並行優先；DAG 切 Wave |
| 15 | self-correction.md | 尾錨定：糾正 | 9 條自我糾正（loop 偵測/假設顯式化等）|

**拆 14 個檔而非一個大檔的原因**：各規則可獨立修改、Claude Code 壓縮時可精準保留或犧牲特定區段、每個檔案職責清晰不互相污染。

## 5. `rules/` 條件載入規則

9 個規則檔只在 Claude Code 偵測到正在編輯符合 `paths:` glob 的檔案時才注入上下文。設計目的是讓與 Vue 無關的任務不載入 Vue SSR 規則，避免污染 context。

| 規則檔 | 觸發 paths | 核心內容 |
|---|---|---|
| `api-and-data.md` | `src/api/**`, `routes/**`, `*.sql`, `migrations/**` | API 錯誤格式、Schema 設計、offset 分頁、可觀測性（Node/Prisma 範本）|
| `barrel-exports.md` | `*.vue`, `*.ts`, `*.tsx`, `*.js`, `*.mjs`, `*.cjs` | barrel re-export 規範、禁止 deep import |
| `git-and-pr.md` | `.github/**`, `CHANGELOG*`, `COMMIT_EDITMSG` | commit 工作流、stacked PR、force push、`gh pr merge` 禁令、git 操作授權 |
| `migrations.md` | `migrations/**`, `prisma/**`, `drizzle/**`, `knex/**` | 不停機變更策略、回滾設計、Expand-Contract 模式 |
| `php-codeigniter.md` | `application/**/*.php`, `src/**/*.php` | PHP controller PHPDoc、internal API 搬移規範 |
| `reuse-and-decoupling.md` | `*.vue`, `*.ts`, `*.js`, `composables/**`, `stores/**` | 復用優先、Rule of Three、分層抽取、解耦原則 |
| `testing.md` | `*.test.*`, `*.spec.*`, `__tests__/**` | 測試命名、mock 原則、覆蓋率目標 |
| `typescript.md` | `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs` | 嚴格模式、禁用 any、JSDoc 撰寫 + as-types 陷阱、boolean equality |
| `vue-nuxt.md` | `*.vue`, `*.css`, `*.scss`, `composables/**`, `pages/**` | SSR/Hydration、三態、DS token、響應式參數設計 |

每個規則檔頂部有 frontmatter：

```yaml
---
name: vue-nuxt
description: Vue/Nuxt SSR 與 Hydration 安全規則
paths:
  - "*.vue"
  - "nuxt.config.*"
  - "composables/**"
  - "pages/**"
---
```

## 6. 三層工具：agents / commands / skills

**邊界定義**

| 工具類型 | 啟動方式 | Context | 典型用途 |
|---|---|---|---|
| **agents** | `Agent` tool 呼叫 | 獨立子 context | 深度探索、獨立審查、並行執行 |
| **commands** | `/command` 斜線語法 | 主對話 context | 多步驟流程 orchestration |
| **skills** | `Skill` tool 或 pattern 自動觸發 | 主對話 context | 特定 pattern 的標準化執行流程 |

**8 個 Agents（`agents/`）**

| Agent | 模型/權限 | 職責 |
|---|---|---|
| `architect` | inherit, 唯讀 | ADR 產出、5 維度評分、架構債識別 |
| `debugger` | inherit, **可寫** | 根因定位 + 最小 diff 修復 |
| `planner` | opus, 唯讀 | 複雜功能/重構規劃、實作藍圖 |
| `pm` | inherit, 唯讀 | 6 問逼問釐清需求、User Story 拆解 |
| `pr-test-analyzer` | sonnet, 唯讀 | PR 測試覆蓋質量與行為覆蓋審查 |
| `reviewer` | inherit, 唯讀 | 獨立第二意見 code review |
| `silent-failure-hunter` | sonnet, 唯讀 | 靜默失敗/swallowed errors 偵測 |
| `type-design-analyzer` | sonnet, 唯讀 | 型別封裝、不變性、Enforcement 審查 |

**14 個 Commands（`commands/`）** 按用途分組

規格鏈：`/specify`（需求→spec）、`/verify`（spec AC 反查）、`/chain-product`（specify→review→verify）

TDD 流程：`/tdd`（legacy shim）、`/chain-tdd`（4 步 TDD chain）、`/test`（測試生成與覆蓋率）

審查類：`/code-review`（本地或 PR，自動分流 quick/standard/deep）、`/review-pr`（alias → `/code-review --effort=standard`）

規劃執行：`/plan`（實作規劃 handoffs）

流程工具：`/pr-stack`（堆疊 PR 狀態）、`/db-migration`（schema→migration→rollback）、`/worklog`（jsonl 草稿批次送 Jira）

溝通工具：`/slack`（草稿 + mrkdwn 區塊）、`/ai`（意圖 dispatcher，路由至對應命令）

**38 個 Skills（`skills/`）** 按主題分群

| 主題 | Skills |
|---|---|
| 編排 / 規劃 | `agent-orchestration`, `executing-plans`, `deploy-plan`, `status-anchor`, `writing-plans`, `multi-agent-patterns` |
| TDD / 驗證 | `tdd-workflow`, `test-driven-development`, `verification-before-completion`, `verification-loop` |
| 除錯 / 品質 | `systematic-debugging`, `coding-standards`, `security-scan`, `security-review`, `runbook` |
| 搜尋 / 記憶 | `find-skills`, `search-first`, `memory-search`, `memory-systems`, `awesome-ai-search`, `deep-research` |
| 領域知識 | `api-design`, `backend-patterns`, `nuxt4-patterns`, `laravel-patterns` |
| 整合 / 工具 | `mcp-builder`, `integration-recommender`, `browser-automation-router`, `brainstorming` |
| 初始化 | `claude-context-init`, `observe` |

> 知識圖譜（符號依賴 / blast radius / 業務流程）改由 **code-review-graph** MCP（`mcp__code-review-graph__*`）提供，取代已停用的 GitNexus skills；見 `13-agent-orchestration.md`。

## 7. `hooks/` 事件驅動系統

**設計理念**：Hook 腳本在 Claude Code 事件觸發時由 shell 直接執行，不佔用對話 context。

**目錄結構**

```
hooks/
├── defs/                         ← Hook 定義（source of truth）
│   ├── session-start.json
│   ├── pre-tool-bash.json
│   ├── pre-tool-edit.json
│   ├── pre-tool-edit-tdd.json   ← TDD 強制（預設 off）
│   ├── pre-tool-context-budget.json
│   ├── pre-compact.json
│   ├── session-end.json
│   └── stop.json
├── hook-handler.sh              ← 主分派腳本
├── session-start.sh
├── pre-tool-bash.sh
├── pre-tool-edit.sh
├── pre-tool-edit-tdd.sh
├── pre-tool-context-budget.sh
├── pre-compact.sh
├── session-end.sh
├── stop.sh
└── reload-hint.sh
```

**Hook 觸發時機矩陣**

| 觸發事件 | 腳本 | 職責 |
|---|---|---|
| SessionStart | `session-start.sh` | 載入 env、讀 memory index、建 shell snapshot |
| PreToolUse(Bash) | `pre-tool-bash.sh` | RTK 長輸出壓縮、危險指令攔截 |
| PreToolUse(Edit/Write) | `pre-tool-edit.sh` | 保護檔案紅線檢查、file-history 記錄 |
| PreToolUse(Edit/Write) | `pre-tool-edit-tdd.sh` | TDD 強制（按需啟用）|
| PreToolUse（任意）| `pre-tool-context-budget.sh` | Context 使用率警示 |
| PreCompact | `pre-compact.sh` | 壓縮前掃描未存記憶的重要決策 |
| SessionEnd | `session-end.sh` | metrics 寫入、worklog draft flush、清理 snapshot |
| Stop | `stop.sh` | 任務中斷時寫入 corrections 信號 |

`defs/*.json` 的內容在啟動時合併進 `settings.json` 的 `hooks` 欄位，`hook-handler.sh` 依事件類型路由到對應腳本。

## 8. 記憶與狀態系統

**頂層沒有 `memory/` 目錄**，記憶實際儲存在兩個位置：

🌍 **全域記憶**：`.ab-tao/memory/`（跨專案長期偏好，目前空）

📁 **專案記憶**：`projects/<encoded>/memory/`（per-repo 隔離）

**三溫層架構**

| 溫層 | 路徑（以專案記憶為例）| 特性 | 限制 |
|---|---|---|---|
| 🔥 Hot | `memory/MEMORY.md` | 每次 session 自動載入 | ≤15 項 / ≤150 char/行 |
| 🌡️ Warm | `memory/{topic}/index.md` | 按需讀取，存細節 | 無限制 |
| 🧊 Cold | `memory/archive/` | 封存，僅搜尋命中時提取 | — |

**`projects/` 下的 10 個編碼目錄**（目錄名為工作路徑的 `-` 分隔 hash）

| 編碼目錄（節錄）| 對應 repo |
|---|---|
| `-Users-alvin-Kkday-projects-kkday-member-ci` | kkday-member-ci（當前）|
| `-Users-alvin-Kkday-projects-kkday-b2c-web` | kkday-b2c-web |
| `-Users-alvin-Kkday-projects-kkday-mobile-member-ci` | kkday-mobile-member-ci |
| `-Users-alvin-Documents-Obsidian-Vault` | Obsidian Vault |
| 其他 6 個 | 工具 repo、dotfiles 等 |

每個 `projects/<encoded>/` 下通常有 `memory/` 與 `plans/` 兩個子目錄。

**其他運行時目錄職責**

| 目錄 | 職責 | 寫入者 |
|---|---|---|
| `tasks/` | 原生 Claude Code tasks（Jan 2025+）| Claude Code |
| `plans/` | 原生 plansDirectory（Feb 2026+）| Plan mode |
| `sessions/` | Session 對話快照 | Claude Code |
| `session-env/` | 每個 session 的 env 變數快照 | `session-start.sh` |
| `shell-snapshots/` | Shell 工作目錄 + git 狀態快照 | hooks |
| `file-history/` | 被 Edit/Write 修改的檔案歷史 | `pre-tool-edit.sh` |
| `image-cache/` | 貼入圖片的本地快取 | Claude Code |
| `paste-cache/` | 剪貼板大段內容快取 | Claude Code |
| `backups/` | settings.json 修改前的備份 | 工具鏈 |

**`.ab-tao/` 子目錄**

| 路徑 | 內容 |
|---|---|
| `state.json` | 工具鏈 unified manifest |
| `metrics.jsonl` | 事件記錄（session / tool call / cost）|
| `worklog-drafts.jsonl` | `/worklog` 草稿佇列（批次送 Jira）|
| `session-state.json` | 最新 session 快照 |
| `corrections/` | 糾正信號（stop hook 寫入，self-evolution 讀取）|
| `logs/` | hook 執行日誌 |
| `profiles/` | 7 個 YAML profile（day-to-day/frugal/oss/personal/production/spike/work）|
| `runtime/` | `/ai` 意圖快取（intent-cache.json）|

## 9. `settings.json` 配置層級

`settings.json` 是全域主配置。`hooks` 欄位由 `hooks/defs/` 合併生成，**不建議手動修改**；其餘欄位可視需要直接編輯。

**頂層 keys 與用途**

| Key | 用途 |
|---|---|
| `model` | 主對話模型 |
| `effortLevel` | 思考深度（xhigh = extended thinking 啟用）|
| `autoMemoryEnabled` | 是否自動存入 auto-memory |
| `skipDangerousModePermissionPrompt` | bypassPermissions 時略過確認提示 |
| `cleanupPeriodDays` | session/快取保留天數 |
| `showThinkingSummaries` | 是否顯示思考摘要 |
| `includeCoAuthoredBy` | git commit 是否加 Co-authored-by |
| `statusLine` | 狀態列設定（claude-hud wrapper）|
| `mcpServers` | MCP 伺服器清單（chrome-devtools, context7 等）|
| `env` | 注入給所有 tool call 的環境變數 |
| `enabledPlugins` | 啟用的 plugin 列表（code-review, hookify, ralph-loop 等）|
| `permissions` | tool 呼叫授權（defaultMode, deny 清單, allow 清單）|
| `hooks` | Hook 定義（由 `hooks/defs/` 合併生成，勿手動改）|
| `_abTao` | 工具鏈擴充 metadata（version, costRouting 等）|

**安全邊界**

`permissions.defaultMode = bypassPermissions`：所有 tool call 自動執行無 prompt，適用個人 trusted 本機環境。

`permissions.deny` 黑名單包含 `force-push`（無 backup）、`reset-hard`、`rm -rf` 等不可逆操作，即使在 bypassPermissions 模式下也會攔截。

## 10. 讀寫邊界：哪些可以手動編輯

| 路徑 | 可否手動編輯 | 說明 |
|---|---|---|
| `CLAUDE.md` | ✅ 可 | @import 索引，修改立即生效 |
| `claude-md/*.md` | ✅ 可 | 規則邏輯主體，修改影響所有對話 |
| `rules/*.md` | ✅ 可 | 條件規則，修改對應觸發 path 生效 |
| `docs/*.md` | ✅ 可 | 參考文件，修改後下次 @import 生效 |
| `agents/*.md` | ✅ 可 | 子代理定義，修改影響後續 Agent tool 呼叫 |
| `commands/*.md` | ✅ 可 | 斜線命令實作 |
| `skills/*/SKILL.md` | ✅ 可 | 技能實作 |
| `hooks/defs/*.json` | ⚠️ 謹慎 | Hook 定義 source of truth；改完需同步進 settings.json |
| `hooks/*.sh` | ⚠️ 謹慎 | 直接影響 session 事件行為，改前備份 |
| `settings.json` | ⚠️ 謹慎 | 主配置；`hooks` 欄位勿手動改，其餘欄位可改 |
| `settings.local.json` | ✅ 可 | 機器獨立設定，不影響其他機器 |
| `projects/*/memory/` | ✅ 可 | 使用者私有記憶，可自由讀寫 |
| `projects/*/plans/` | ✅ 可 | 使用者私有計畫，可自由讀寫 |
| `history.jsonl` | ❌ 勿改 | Claude Code 原生快取，自動管理 |
| `sessions/` | ❌ 勿改 | Claude Code 原生快取，自動管理 |
| `cache/ .cache/` | ❌ 勿改 | Claude Code 原生快取，自動管理 |
| `.ab-tao/state.json` | ❌ 勿改 | 工具鏈 runtime state，自動管理 |

## 附錄：快速參照

**重要文件位置**

| 文件 | 路徑 | 用途 |
|---|---|---|
| 本文件 | `docs/STRUCTURE.md` | 使用者視角配置全覽 |
| 目錄全圖 | `docs/config-map.md` | 詳細目錄樹與版本歷史 |
| 審查 checklist | `docs/audit-checklists.md` | 四種審查模式完整 checklist |
| Slack 規範 | `docs/slack-principles.md` | Slack 語法紅線 + Icon 語義字典 |
| 本地工具安裝 | `docs/local-tools.md` | LM Studio / Milvus / browser-harness |
| 當前專案記憶 | `projects/<encoded>/memory/MEMORY.md` | Hot 記憶層索引 |

**Claude Code 原生目錄（不在 ~/.claude/ 下）**

Claude Code 本身也會在其他位置儲存資料：`~/Library/Application Support/Claude/` 存放應用層設定；MCP server 的 auth token 另行儲存，不在 `~/.claude/` 內。

**最後更新**：2026-06-11 ｜ Claude Opus 4.8
