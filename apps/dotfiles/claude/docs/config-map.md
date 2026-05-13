# ~/.claude/ 結構全圖 (v1.7.0)

```
~/.claude/
│
├── CLAUDE.md                    # ≤35 行，三層架構（首錨定 / 高風險紅線 / 對話初始 + 按需載入表）
│
├── claude-md/                   # 核心規則模組（always-on，透過 @import 載入）12 檔（00–05, 07–08, 11–13, 15）
│   ├── README.md
│   ├── 00-identity.md           首錨定
│   ├── 01-language.md
│   ├── 02-response-format.md
│   ├── 03-code-standards.md     技術傾向 + Simplicity First + 工作流（版本管理 / 規範 → rules/code-quality）
│   ├── 04-verification.md       查證規則 + Figma MCP + i18n 缺項
│   ├── 05-security.md           安全規範 + bypassPermissions + Git 操作紅線
│   ├── 07-context-hygiene.md    壓縮策略 + 條件載入規則
│   ├── 08-state-system.md       Tasks/Plans/Memory 邊界 + 冷啟動（detail → docs/state-system-details）
│   ├── 11-audit-system.md
│   ├── 12-exceptions.md
│   ├── 13-agent-orchestration.md  尾錨定（資源速查 + 調度規則，DAG → docs/agent-dag-parallel）
│   └── 15-self-correction.md    5 節精簡自我糾正（§5+§7 → docs/self-correction-details）
│
├── rules/                       # 條件載入（paths: frontmatter）9 檔
│   ├── api-and-data.md          paths: src/api/ routes/ *.sql migrations/
│   ├── barrel-exports.md        paths: *.vue *.ts *.tsx *.js *.jsx *.mjs *.cjs
│   ├── code-quality.md          paths: *.vue *.ts *.tsx *.js *.jsx package.json（版本管理 + 程式碼規範）
│   ├── git-and-pr.md            paths: stacked PR 工作流
│   ├── migrations.md            paths: migrations/ *.sql prisma/ drizzle/
│   ├── settings-edit.md         paths: .claude/settings.json .ab-tao/state.json（設定檔修改紅線）
│   ├── testing.md               paths: *.test.* *.spec.* __tests__/
│   ├── typescript.md            paths: *.ts *.tsx
│   └── vue-nuxt.md              paths: *.vue nuxt.config.* composables/（SSR + quality_targets）
│
├── docs/                        # 參考文件（按需 Read，非 always-on）12 檔
│   ├── rtk.md                   RTK 工具 + token 預算影響
│   ├── audit-checklists.md      三模式 checklist 完整版
│   ├── config-map.md            本文件
│   ├── slack-principles.md      Slack 語法紅線 + Icon 語義字典 + 4 層骨架 + Anti-patterns
│   ├── slack-audience-profiles.md   7 種 audience（reader mental model + 決策原則）
│   ├── ai-dispatcher.md         /ai dispatcher 30+ intent 映射表 + 使用說明
│   ├── federated-memory.md      第四溫層跨專案記憶設定與使用
│   ├── self-evolution.md        failure-patterns append-only 自我演進 + ADR-002 invariants
│   ├── local-tools.md           LM Studio + Milvus + browser-harness + Awesome-AI-Pedia 安裝指引
│   ├── state-system-details.md  資料夾命名 + Plan Frontmatter Convention（08 按需指向）
│   ├── agent-dag-parallel.md    DAG 切分 / Wave gate / 衝突處理（13 按需指向）
│   └── self-correction-details.md  §5 目標錨定 + §7 半成品禁止（15 按需指向）
│
├── agents/                      # 4 agents（2 核心 + 2 角色化）
│   ├── architect.md             架構設計 + 5 維審查
│   ├── debugger.md              根因定位 + 最小 diff
│   ├── pm.md                    產品需求釐清 + 6 逼問框架（唯讀）
│   └── reviewer.md              第二意見 code review（唯讀）
│
├── commands/                    # 8 unique commands
│   ├── check.md                 Build Fix + Quality Gate + 9-gate --gates
│   ├── db-migration.md
│   ├── pr-stack.md
│   ├── slack.md
│   ├── specify.md               需求 → 結構化 spec（AC + non-goals）
│   ├── test.md
│   ├── verify.md                spec AC 反向覆蓋驗證
│   └── worklog.md
│
├── skills/                      # 24+ skills（按需載入）
│
├── hooks/                       # 9 hook defs（事件驅動，零 context cost）
│   ├── defs/                    # Hook 定義（每個 hook 一個 JSON，source of truth）
│   │   ├── session-start.json        ab-tao:session:start
│   │   ├── pre-tool-bash.json        ab-tao:pre:bash
│   │   ├── pre-tool-edit.json        ab-tao:pre:edit
│   │   ├── pre-tool-edit-tdd.json    ab-tao:pre:edit:tdd（TDD 強制，預設 off）
│   │   ├── pre-tool-context-budget.json  ab-tao:pre:context-budget（advisory）
│   │   ├── pre-compact.json          ab-tao:pre-compact
│   │   ├── post-tool.json            ab-tao:post-tool
│   │   ├── stop.json                 ab-tao:stop
│   │   └── session-end.json          ab-tao:session:end
│   └── *.sh                     Hook 執行腳本
│
├── memory/                      # 全域記憶（所有 session 共享）
│   ├── MEMORY.md                hot 索引（≤15 項）
│   ├── preferences/             長期個人偏好
│   ├── patterns/                可重用 pattern
│   └── archive/                 cold layer
│
├── projects/                    # 按專案隔離（ab-tao 絕不覆蓋）
│   └── {encoded}/
│       ├── memory/MEMORY.md
│       └── plans/index.md
│
├── tasks/                       # 原生 Claude Code tasks（Jan 2025+）
├── plans/                       # 原生 plansDirectory（Feb 2026+）
│
├── settings.json                # 主配置：hooks（7條合併）+ mcpServers + model + env
├── settings.local.json          # 機器獨立（不 sync，gitignored）
│
└── .ab-tao/                     # ab-tao 運行時資料夾
    ├── state.json               # unified manifest（managed + choices + sync）
    ├── state.schema.json        # JSON Schema
    ├── state.lock               # 寫入互斥鎖
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
