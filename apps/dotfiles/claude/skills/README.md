# Skills 索引 (v1.0.0)

22 個 skills，按需載入（L3 on-demand）。透過 `c:skills --list` 查看安裝狀態。

---

## Workflow — 任務執行流程

| Skill | 觸發條件 |
|---|---|
| `brainstorming` | 任何創意工作開始前：功能設計、組件建立、行為修改 |
| `deep-research` | 需要多來源研究、文獻引用、綜合報告 |
| `dispatching-parallel-agents` | 2+ 個獨立任務可平行執行 |
| `executing-plans` | 持有書面計畫、需分段執行並設 review 檢查點 |
| `multi-agent-patterns` | 設計 supervisor/swarm/handoff 多 agent 系統 |
| `requesting-code-review` | 完成功能、major feature 或 merge 前驗證 |
| `systematic-debugging` | 遇到 bug、測試失敗、非預期行為 |
| `verification-before-completion` | 宣稱完成前：執行 linter/test/build 確認 |
| `writing-plans` | 持有 spec 或需求、準備展開多步驟任務前 |

## Tech — 技術特定模式

| Skill | 觸發條件 |
|---|---|
| `api-design` | 設計 REST API：命名、狀態碼、分頁、錯誤回應、版本管理 |
| `backend-patterns` | Node.js / Express / Next.js API 架構、DB 優化 |
| `claude-api` | 使用 Anthropic SDK / Claude API / Agent SDK 建立應用 |
| `coding-standards` | 跨專案命名、可讀性、不可變性基準規範 |
| `laravel-patterns` | Laravel routing / Eloquent / Queue / Cache / API resources |
| `mcp-builder` | 建立 MCP Server（FastMCP / TypeScript MCP SDK） |
| `nuxt4-patterns` | Nuxt 4 hydration 安全、SSR 資料抓取、route rules |
| `security-scan` | 掃描 .claude/ 配置的注入風險與安全漏洞 |
| `test-driven-development` | 實作任何 feature 或 bugfix 前 |

## Meta — 系統與工具

| Skill | 觸發條件 |
|---|---|
| `find-skills` | 從 skills.sh marketplace 搜尋與安裝 skills |
| `incident` | 生產環境突發事故：定級 → 止血 → 溝通 → 復盤 |
| `memory-systems` | 設計 agent 記憶系統、選擇 Mem0/Zep/Letta/LangMem |
| `runbook` | 生成一頁式維運手冊（部署/回滾/監控/排查） |

---

## 品質基準（Phase 14 審查）

- 所有 skills 通過 `skill-lint.mjs`：22/22 ✅
- 平均品質分：4.9 / 5.0
- frontmatter 規範：`name` + `description`（50-200字元）+ `version: 1.0.0` + `category`

## 更新方式

```bash
pnpm run c:skills --list         # 查看所有 skills 狀態
pnpm run c:skills --install <name>  # 安裝到 ~/.claude/skills/
pnpm run c:skills --update <name>   # 更新（觸發 config-choice flow）
pnpm run c:validate --skills        # 執行 lint 審查
```
