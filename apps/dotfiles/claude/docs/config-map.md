# ~/.claude/ 結構全圖 (v1.15.0)

```
~/.claude/
│
├── CLAUDE.md                    # ≤80 行，純 @import 索引
│
├── claude-md/                   # 核心規則模組（always-on，透過 @import 載入）14 檔（00–08, 10–13, 15）
│   ├── README.md
│   ├── 00-identity.md           首錨定
│   ├── 01-language.md
│   ├── 02-response-format.md
│   ├── 03-code-standards.md     技術傾向 + 程式碼規範
│   ├── 04-verification.md       查證規則 + Figma MCP + i18n 缺項
│   ├── 05-security.md           安全規範 + bypassPermissions + Git 操作紅線
│   ├── 06-quality-targets.md
│   ├── 07-context-hygiene.md    降噪四層策略
│   ├── 08-state-system.md       Tasks/Plans/Memory 邊界 + 三溫層 + 冷啟動（取代 08+09）
│   ├── 10-config-management.md  全域 ⇄ 專案 ⇄ ab-tao 分工
│   ├── 11-audit-system.md
│   ├── 12-exceptions.md
│   ├── 13-agent-orchestration.md  尾錨定（資源速查 + 調度規則核心；PR review/tier/param 已拆 docs/agent-review-workflow.md）
│   └── 15-self-correction.md    尾錨群（自我糾正 + 數值估算驗算）
│
├── rules/                       # 條件載入（paths: frontmatter）10 檔
│   ├── api-and-data.md          paths: src/api/ routes/ *.sql migrations/
│   ├── barrel-exports.md        paths: *.vue *.ts *.tsx *.js *.jsx *.mjs *.cjs
│   ├── git-and-pr.md            paths: **/.github/** CHANGELOG* COMMIT_EDITMSG
│   ├── migrations.md            paths: migrations/ *.sql prisma/ drizzle/
│   ├── php-codeigniter.md       paths: application/**/*.php src/**/*.php
│   ├── reuse-and-decoupling.md  paths: *.vue *.ts *.tsx *.js *.jsx composables/ stores/
│   ├── sql.md                   paths: *.sql queries/ sql/
│   ├── testing.md               paths: *.test.* *.spec.* __tests__/
│   ├── typescript.md            paths: *.ts *.tsx *.js *.jsx *.mjs *.cjs
│   └── vue-nuxt.md              paths: *.vue *.css *.scss *.sass nuxt.config.* composables/
│
├── docs/                        # 參考文件（可 @import，非規則）29 檔
│   │
│   │   # ── CLAUDE.md @import 目標（4）──
│   ├── rtk.md                   RTK 工具 + token 預算影響
│   ├── audit-checklists.md      四種審查模式 checklist 完整版
│   ├── config-map.md            本文件
│   ├── local-tools.md           codebase-memory-mcp + browser-harness + AI-Pedia 安裝指引
│   │
│   │   # ── Slack 叢集（2）──
│   ├── slack-principles.md      Slack 語法紅線 + Icon 語義字典 + 4 層骨架 + Anti-patterns
│   ├── slack-audience-profiles.md   7 種 audience（rd/pm/mkt/qa/ops/ued/multi）
│   │
│   │   # ── 系統參考（按需，9）──
│   ├── agent-review-workflow.md PR review 工作流 + Review 深淺分流 + Tool(param) 語法  引用: 13-agent-orchestration
│   ├── ai-dispatcher.md         /ai dispatcher 40+ intent 映射表 + 使用說明
│   ├── federated-memory.md      第四溫層跨專案記憶設定（projects.json 格式）
│   ├── self-evolution.md        failure-patterns append-only 自我演進 + ADR-002 invariants
│   ├── STRUCTURE.md             ~/.claude/ 結構快照
│   ├── agent-dag-parallel.md    多 phase 並行排程（DAG 切分 / Wave gate）引用: 13-agent-orchestration
│   ├── agent-typed-result.md    Subagent 回傳 schema 範例 + prompt 模板  引用: 13-agent-orchestration
│   ├── self-correction-details.md  串流中斷觸發細節 + 歷史案例          引用: 15-self-correction
│   ├── state-system-details.md  Plan Frontmatter / 資料夾命名規範        引用: 08-state-system
│   │
│   │   # ── 評估 / 指標（2）──
│   ├── lsp-mcp-evaluation.md    LSP MCP 評估紀錄
│   ├── metrics-fields.md        Observability 指標欄位定義
│   │
│   │   # ── 版本封存（2）──
│   ├── audit-checklists-v160.md（archive）
│   └── config-map-v160.md       （archive）
│   │
│   │   # ── 研究 / 未分類（10）──
│   │   adversarial-review / attribution / chains / cost-routing / cross-ide-export /
│   │   failure-catalog / plugin-audit / profile-system / source-discovery / voice-trigger
│
├── agents/                      # 9 agents
│   ├── architect.md             架構設計 + 5 維審查（唯讀）
│   ├── code-reviewer.md         程式碼審查專家
│   ├── debugger.md              根因定位 + 最小 diff（可寫）
│   ├── planner.md               複雜功能 / 重構計畫
│   ├── pm.md                    產品需求釐清 + 6 逼問框架（唯讀）
│   ├── pr-test-analyzer.md      PR 測試覆蓋率 + 行為覆蓋分析
│   ├── reviewer.md              第二意見 code review（唯讀）
│   ├── silent-failure-hunter.md 無聲失敗 / 錯誤吞噬專項
│   └── type-design-analyzer.md  型別設計分析（不變量 + 封裝）
│
├── commands/                    # 17 commands
│   ├── ai.md
│   ├── chain-product.md
│   ├── chain-tdd.md
│   ├── check.md                 Build Fix + Quality Gate + 9-gate --gates
│   ├── code-review.md           PR 代碼審查入口（自動分流 quick/standard/deep）
│   ├── db-migration.md
│   ├── feature-dev.md
│   ├── plan.md
│   ├── pr-stack.md
│   ├── quality-gate.md
│   ├── review-pr.md
│   ├── santa-loop.md
│   ├── slack.md
│   ├── specify.md               需求 → 結構化 spec（AC + non-goals）
│   ├── test.md
│   ├── verify.md                spec AC 反向覆蓋驗證
│   └── worklog.md
│
├── skills/                      # 31 skills 受 ab-tao 管理；live 另含社群安裝（數量依機器 c:skills / agnix 重整而定）
│
├── hooks/                       # 9 hook defs（事件驅動，零 context cost）
│   ├── defs/                    # Hook 定義（每個 hook 一個 JSON，source of truth）
│   │   ├── session-start.json        ab-tao:session:start
│   │   ├── user-prompt-submit.json   ab-tao:prompt:enrich（Jira/Confluence/破壞性命令注入）
│   │   ├── pre-tool-bash.json        ab-tao:pre:bash
│   │   ├── pre-tool-edit.json        ab-tao:pre:edit
│   │   ├── pre-tool-context-budget.json  ab-tao:pre:context-budget（advisory）
│   │   ├── pre-compact.json          ab-tao:pre-compact
│   │   ├── post-tool-failure.json    ab-tao:post:tool:failure（工具失敗日誌 + 告警）
│   │   ├── stop.json                 ab-tao:stop
│   │   └── session-end.json          ab-tao:session:end
│   └── *.sh                     Hook 執行腳本
│
├── memory/                      # 全域記憶（所有 session 共享）· 三溫層 flat 檔（見 08-state-system）
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
