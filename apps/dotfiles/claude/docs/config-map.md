# ~/.claude/ 結構全圖 (v1.19.1 · 2026-07-16 對齊實際)

```
~/.claude/
│
├── CLAUDE.md                    # ≤80 行，純 @import 索引
│
├── claude-md/                   # 核心規則模組（always-on，透過 @import 載入）13 檔（00–05, 08, 10–15；09 已併入 08、06→rules/vue-nuxt、07→hooks 已下放）
│   ├── README.md
│   ├── 00-identity.md           首錨定
│   ├── 01-language.md
│   ├── 02-response-format.md
│   ├── 03-code-standards.md     技術傾向 + 程式碼規範
│   ├── 04-verification.md       查證規則 + Figma MCP + i18n 缺項
│   ├── 05-security.md           安全規範 + Git 操作紅線 + 外部通訊紅線（對外發送分級制）
│   ├── 08-state-system.md       Tasks/Plans/Memory 邊界 + 溫層架構 + 冷啟動（09 已併入）
│   ├── 10-config-management.md  全域 ⇄ 專案 ⇄ ab-tao 分工
│   ├── 11-audit-system.md
│   ├── 12-exceptions.md
│   ├── 13-agent-orchestration.md  尾錨定（資源速查 + 調度規則核心；PR review/tier/param 已拆 docs/agent-review-workflow.md）
│   ├── 14-confirmation.md       確認機制（二值 [Y/N] / 多值 AskUserQuestion + 授權豁免 + 對外通訊硬例外）尾錨群
│   └── 15-self-correction.md    尾錨群（自我糾正 + 數值估算驗算）
│
├── rules/                       # 13 檔（11 個 paths: 自動觸發 + 2 個 CLAUDE.md 指標載入）
│   ├── api-and-data.md          paths: src/api/ routes/ *.sql migrations/
│   ├── barrel-exports.md        paths: *.vue *.ts *.tsx *.js *.jsx *.mjs *.cjs
│   ├── confluence.md            ⚠️ 無 paths:，靠 CLAUDE.md 參考資源指標載入
│   ├── excel-ooxml.md           ⚠️ 無 paths:，靠 CLAUDE.md 參考資源指標載入
│   ├── git-and-pr.md            paths: **/.github/** CHANGELOG* COMMIT_EDITMSG
│   ├── html-report.md           paths: **/*.html（HTML 報告輸出規範）
│   ├── migrations.md            paths: migrations/ *.sql prisma/ drizzle/
│   ├── php-codeigniter.md       paths: application/**/*.php src/**/*.php
│   ├── reuse-and-decoupling.md  paths: *.vue *.ts *.tsx *.js *.jsx composables/ stores/
│   ├── sql.md                   paths: *.sql queries/ sql/
│   ├── testing.md               paths: *.test.* *.spec.* __tests__/ test/
│   ├── typescript.md            paths: *.ts *.tsx *.js *.jsx *.mjs *.cjs
│   └── vue-nuxt.md              paths: *.vue *.css *.scss *.sass nuxt.config.* composables/
│                                ⚠️ 指標載入的兩檔：config-lint R2 掃描範圍不含頂層 CLAUDE.md，
│                                   指標行若遺失會靜默斷鏈，改動 CLAUDE.md 後須手動確認
│
├── docs/                        # 參考文件（指針載入，非規則）18 檔（2026-07-16 清退 10 個孤兒/過時檔）
│   │
│   │   # ── CLAUDE.md 指針目標（4）──
│   ├── rtk.md                   RTK 工具 + token 預算影響
│   ├── audit-checklists.md      四種審查模式 checklist 完整版
│   ├── config-map.md            本文件
│   ├── local-tools.md           codebase-memory-mcp + 本地工具安裝指引
│   │
│   │   # ── Slack 叢集（2）──
│   ├── slack-principles.md      Slack 語法紅線（雙軌）+ Icon 語義字典 + 4 層骨架 + Anti-patterns
│   ├── slack-audience-profiles.md   7 種 audience（rd/pm/mkt/qa/ops/ued/multi）
│   │
│   │   # ── 系統參考（按需，9）──
│   ├── security-details.md      授權邊界逐條定義（Git 三豁免反例 + Slack 兩級授權 + /feedback）引用: 05-security
│   ├── git-pr-conventions.md    Conventional Commits + PR title + 堆疊 PR + 分支流程      引用: 05-security
│   ├── agent-review-workflow.md PR review 工作流 + Review 深淺分流 + Tool(param) 語法  引用: 13-agent-orchestration
│   ├── agent-dag-parallel.md    多 phase 並行排程（DAG 切分 / Wave gate）引用: 13-agent-orchestration
│   ├── agent-typed-result.md    Subagent 回傳 schema 範例 + prompt 模板  引用: 13-agent-orchestration
│   ├── self-correction-details.md  串流中斷觸發細節 + 歷史案例          引用: 15-self-correction
│   ├── state-system-details.md  資料夾命名規範                          引用: 08-state-system
│   ├── ai-dispatcher.md         /ai dispatcher 40+ intent 映射表 + 使用說明
│   └── archive/federated-memory.md  第四溫層跨專案記憶構想（未部署，2026-07-17 封存）
│   │
│   │   # ── 版本封存（2，位於 docs/archive/）──
│   ├── archive/audit-checklists-v160.md
│   └── archive/config-map-v160.md
│   │
│   │   # ── 研究 / 未分類（4）──
│   │   attribution / cost-routing / failure-catalog / profile-system
│
├── agents/                      # 7 agents（planner / reviewer 已移除：計畫用內建 Plan、審查用 code-reviewer）
│   ├── architect.md             架構設計 + 5 維審查（唯讀）
│   ├── code-reviewer.md         程式碼審查專家
│   ├── debugger.md              根因定位 + 最小 diff（可寫）
│   ├── pm.md                    產品需求釐清 + 6 逼問框架（唯讀）
│   ├── pr-test-analyzer.md      PR 測試覆蓋率 + 行為覆蓋分析
│   ├── silent-failure-hunter.md 無聲失敗 / 錯誤吞噬專項
│   └── type-design-analyzer.md  型別設計分析（不變量 + 封裝）
│
├── commands/                    # 13 commands（review-pr 併入 code-review；plan/verify/quality-gate 已移除；chain-* 歸檔 → commands-archive/）
│   ├── ai.md
│   ├── audit.md                 四種審查模式入口（原 claude-md/11）
│   ├── check.md                 Build Fix + Quality Gate + 9-gate --gates
│   ├── code-review.md           PR 代碼審查入口（自動分流 quick/standard/deep；原 /review-pr 已併入）
│   ├── db-migration.md
│   ├── feature-dev.md
│   ├── handoff.md               清 context / compact 前交接班（與 /resume 成對）
│   ├── pr-stack.md
│   ├── santa-loop.md
│   ├── slack.md                 Slack 訊息助手 v4.2.0（雙軌 lint + 分級制授權）
│   ├── specify.md               需求 → 結構化 spec（AC + non-goals）
│   ├── test.md
│   └── worklog.md
│
├── skills/                      # 22 skills 受 ab-tao 管理（c:skills 盤點；⚠️ skills/README.md 索引已知過時待重建）
│
├── hooks/                       # 9 hook defs（事件驅動，零 context cost）
│   ├── defs/                    # Hook 定義（每個 hook 一個 JSON，source of truth）
│   │   ├── session-start.json        ab-tao:session:start
│   │   ├── pre-tool-bash.json        ab-tao:pre:bash
│   │   ├── pre-tool-edit.json        ab-tao:pre:edit
│   │   ├── pre-tool-context-budget.json  ab-tao:pre:context-budget（advisory）
│   │   ├── pre-compact.json          ab-tao:pre-compact
│   │   ├── post-tool-failure.json    ab-tao:post:tool:failure（工具失敗日誌 + 告警）
│   │   ├── stop.json                 ab-tao:stop
│   │   └── session-end.json          ab-tao:session:end
│   └── *.sh                     Hook 執行腳本
│
├── memory/                      # 全域記憶（所有 session 共享）· 溫層 flat 檔（五層，見 08-state-system）
│   ├── MEMORY.md                Hot：純 index（≤15 項）
│   ├── system-patterns.md       Stable：偏好 / feedback / 永久參考（檔不存在則跳過）
│   ├── active-context.md        Volatile：進行中 ticket / mid-run 記錄（檔不存在則跳過）
│   ├── {topic}/index.md         Warm：細節按需
│   └── archive/                 Cold：封存（sync excluded）
│
├── projects/                    # 按專案隔離（ab-tao 絕不覆蓋）
│   └── {encoded}/
│       ├── memory/MEMORY.md
│       └── plans/index.md
│
├── tasks/                       # 原生 Claude Code tasks（Jan 2025+）
├── plans/                       # 原生 plansDirectory（Feb 2026+）
│
├── settings.json                # 主配置：hooks（9 條合併）+ mcpServers + model + env
├── settings.local.json          # 機器獨立（不 sync，gitignored）
│
└── .ab-tao/                     # ab-tao 運行時資料夾
    ├── state.json               # unified manifest（managed + choices + sync）
    ├── state.schema.json        # JSON Schema
    ├── state.lock               # 寫入互斥鎖
    ├── preferences.json         # d:setup 用戶偏好（永久 · ⚠️ user-private，git 同步見 ab-config-sync）
    └── metrics.jsonl            # Observability（Phase 17）
```

## 路徑管理

所有路徑由 `apps/dotfiles/libs/core/paths.mjs` 的 `P.*` 命名空間統一管理。
禁止在其他 ab-tao 程式碼中硬編碼 `path.join(HOME, ".claude", ...)` 字面量。

## Hooks 架構

Hook 定義存放於 repo 的 `apps/dotfiles/claude/hooks/defs/*.json`（每個 hook 一個檔案）。
`d:setup` 執行時讀取所有 defs → 合併進 `~/.claude/settings.json` 的 `hooks` 欄位（id-dedup，ECC hooks 不受影響）。
`d:hooks` 管理啟用 / 停用，直接讀寫 `settings.json`，無需單獨的 `hooks.json`。

**`DirectoryAdded`（2026-07-28 新增，CC 2.1.219+）**：`/add-dir` 中途掛入新工作目錄時，由 `directory-added.sh` 注入該目錄的記憶索引 / 計畫 / in-repo `CLAUDE.md` 指引，補上 `session-start.sh` 只認 startup 當下 cwd 的缺口。此事件的輸出契約與其他 hook 不同——走頂層 `systemMessage`（不支援 `hookSpecificOutput.additionalContext`，也非 SessionStart 的 stdout 直注入），且 `matcher` 比對的是 `source` 欄位（`slash_command` / `register_repo_root`）而非路徑；官方文件尚未收錄，規格取自 CLI 二進位。

**事件名合法性由 `config-lint.sh` R10 把關**：R4 只從 defs/ 單向反查 settings.json，事件名打錯會靜默失效（hook 永不觸發且無報錯）；R10 反向枚舉 `settings.json.hooks` 的 key，比對 VS Code extension `claude-code-settings.schema.json` 動態抽出的合法事件表（不硬編碼，隨版本自動跟上）。

**不再部署到 `~/.claude/` 的檔案**：`hooks.json`、`mcp.yml`、`plugins.yml`、`profiles/`、`memory-templates/`

## 來源對照

| ~/.claude/ 目錄 | ab-tao source | 管理方式 |
|---|---|---|
| claude-md/ | apps/dotfiles/claude/claude-md/ | ab-tao d:setup |
| rules/ | apps/dotfiles/claude/rules/ | ab-tao d:setup |
| docs/ | apps/dotfiles/claude/docs/ | ab-tao d:setup |
| agents/ | apps/dotfiles/claude/agents/ | ab-tao d:setup |
| commands/ | apps/dotfiles/claude/commands/ | ab-tao d:setup |
| skills/ | apps/dotfiles/claude/skills/ | ab-tao d:setup / c:skills |
| hooks/*.sh | apps/dotfiles/claude/hooks/*.sh | ab-tao d:setup |
| settings.json (hooks) | apps/dotfiles/claude/hooks/defs/*.json | ab-tao d:setup / d:hooks |
| memory/ | — | 使用者自管 |
| projects/ | — | 使用者自管 |

## /config 快速設定（自 claude-md/10 下放，CC 2.1.181+）

session 內可用 `/config key=value` 直接設定任一 setting，免進選單；互動 / `-p` / Remote Control 皆支援。

- 例：`/config thinking=false`、`/config effort=high`、`/config model=opusplan`
- `/config --help` 列出所有可用 shorthand key（CC 2.1.183+）
- `/config` 選單切換鍵行為（2.1.183+）：Enter 與 Space 都改值，Esc 為「儲存並關閉」（非還原）
- 使用者跑 `d:setup` 出現選項 `[u/k/m/s]` 時，按字面意義回答即可

> ⚠️ `/config` 改的是 **live `~/.claude/settings.json`**，非 ab-tao source template。要永久跨機保留須回寫 `apps/dotfiles/claude/settings.template.json` 並 `d:setup`，否則僅當機生效（且 `env` / `permissions.allow` / `model` 等 preserve path 由 local pin，template 不覆蓋）。
