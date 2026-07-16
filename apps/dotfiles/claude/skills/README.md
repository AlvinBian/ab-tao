# Skills 索引 (v2.0.0 · 2026-07-16 對齊實際)

22 個 skills，按需載入（L3 on-demand）。透過 `c:skills --list` 查看安裝狀態。

---

## Workflow — 任務執行流程

| Skill | 觸發條件 |
|---|---|
| `brainstorming` | 任何創意工作開始前：功能設計、組件建立、行為修改 |
| `researching-code` | 新功能動工前調查 codebase：要碰的檔案、可循 pattern、風險 |
| `planning-solutions` | 產出分 phase 實作計畫：範圍、驗收標準、per-phase 驗證 |
| `implementing-code` | 依計畫逐 phase 實作：寫碼、跑測試、記錄偏差 |
| `reviewing-code` | 上線前品質把關：自動檢查 + 計畫符合度 → APPROVED / NEEDS_FIX |
| `systematic-debugging` | 遇到 bug、測試失敗、非預期行為（提修法前先系統性定位） |
| `test-driven-development` | 實作任何 feature 或 bugfix 前 |
| `verification-before-completion` | 宣稱完成前：執行 linter / test / build 確認 |
| `deep-research` | 需要多來源研究、文獻引用、綜合報告 |

## Tech — 技術特定模式

| Skill | 觸發條件 |
|---|---|
| `api-design` | 設計 REST API：命名、狀態碼、分頁、錯誤回應、版本管理 |
| `coding-standards` | 跨專案命名、可讀性、不可變性基準規範 |
| `mcp-builder` | 建立 MCP Server（FastMCP / TypeScript MCP SDK） |
| `nuxt4-patterns` | Nuxt 4 hydration 安全、SSR 資料抓取、route rules、懶加載 |
| `security-scan` | 掃描 .claude/ 配置的注入風險與安全漏洞 |

## KKday 專屬

| Skill | 觸發條件 |
|---|---|
| `kk-graph-v2` | 跨 repo / 跨服務關係查詢（呼叫鏈、改表爆炸半徑、API→表）；先 `q.sh` 定位再讀 source |
| `kkday-design-system` | 產出任何 KKday UI（mockup / HTML / Vue）前必用：`$kk-*` token + `KkXxx` 元件 |

## Meta — 系統與工具

| Skill | 觸發條件 |
|---|---|
| `agent-orchestration` | 多 agent 編排：Supervisor / Swarm / Hierarchical、DAG 並行調度 |
| `browser-automation-router` | 瀏覽器操作前路由決策：claude-in-chrome（預設）/ chrome-devtools（量測）/ Browser pane（dev 預覽）三選一 |
| `find-skills` | 本地無匹配 skill 時搜尋社群 skill 集合並提供安裝選項 |
| `awesome-ai-search` | 搜尋 Awesome-AI-Pedia 知識庫，補本地 skills 未涵蓋的 AI 工具 / 最佳實踐 |
| `memory-search` | 語義搜尋全域與專案 memory 中的過往決策、偏好、pattern |
| `visual-explainer` | 產出自包含 HTML 視覺報告：架構圖、diff review、計畫審視、複雜表格 |

---

## 品質基準

- frontmatter 規範：`name` + `description`（50–200 字元）+ `version` + `category`
- 驗證：`pnpm run c:validate --skills`

## 更新方式

```bash
pnpm run c:skills --list            # 查看所有 skills 狀態
pnpm run c:skills --install <name>  # 安裝到 ~/.claude/skills/
pnpm run c:skills --update <name>   # 更新（觸發 config-choice flow）
```
