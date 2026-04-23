# ~/.claude/ 結構全圖 (v1.3.0)

```
~/.claude/
│
├── CLAUDE.md                    # ≤80 行，純 @import 索引
│
├── claude-md/                   # 核心規則模組（always-on，透過 @import 載入）
│   ├── README.md
│   ├── 00-identity.md           首錨定
│   ├── 01-language.md
│   ├── 02-response-format.md
│   ├── 03-code-standards.md     技術傾向 + 版本管理 + 程式碼規範
│   ├── 04-verification.md
│   ├── 05-security.md           安全規範 + bypassPermissions 風險揭露
│   ├── 06-quality-targets.md
│   ├── 07-context-hygiene.md    降噪四層策略
│   ├── 08-memory-system.md      Memory 生命週期 + 三溫層
│   ├── 09-task-system.md        Tasks/Plans/Memory 邊界
│   ├── 10-config-management.md  全域 ⇄ 專案 ⇄ ab-tao 分工
│   ├── 11-audit-system.md
│   ├── 12-exceptions.md
│   ├── 13-agent-routing.md      尾錨定（資源速查 + 調度規則）
│   ├── 14-dag-parallel-execution.md  DAG 並行執行規則（尾錨定前）
│   └── 15-self-correction.md    尾錨群（8 條自我糾正規則）
│
├── rules/                       # 條件載入（paths: frontmatter）
│   ├── api-and-data.md          paths: src/api/ routes/ *.sql migrations/
│   ├── vue-nuxt.md              paths: *.vue nuxt.config.* composables/
│   ├── typescript.md            paths: *.ts *.tsx
│   ├── testing.md               paths: *.test.* *.spec.* __tests__/
│   └── migrations.md            paths: migrations/ *.sql prisma/ drizzle/
│
├── docs/                        # 參考文件（可 @import，非規則）
│   ├── rtk.md                   RTK 工具 + token 預算影響
│   ├── audit-checklists.md      三模式 checklist 完整版
│   ├── slack-templates.md       Slack 視覺元素 + 20 個場景模板（commands/slack.md 動態載入）
│   ├── slack-audience-profiles.md   7 種 audience profile + channel mapping（commands/slack.md 動態載入）
│   └── config-map.md            本文件
│
├── agents/                      # 2 focused agents
│   ├── architect.md             架構設計 + 5 維審查
│   └── debugger.md              根因定位 + 最小 diff
│
├── commands/                    # 5 unique commands
│   ├── check.md
│   ├── db-migration.md
│   ├── pr-stack.md
│   ├── slack.md
│   └── test.md
│
├── skills/                      # 23 skills（按需載入）
│
├── hooks/                       # 7 hooks（事件驅動，零 context cost）
│   ├── defs/                    # Hook 定義（每個 hook 一個 JSON，source of truth）
│   │   ├── session-start.json   ab-tao:session:start
│   │   ├── pre-tool-bash.json   ab-tao:pre:bash
│   │   ├── pre-tool-edit.json   ab-tao:pre:edit
│   │   ├── pre-compact.json     ab-tao:pre-compact
│   │   ├── post-tool.json       ab-tao:post-tool
│   │   ├── stop.json            ab-tao:stop
│   │   └── session-end.json     ab-tao:session:end
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
