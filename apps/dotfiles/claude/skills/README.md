# Skills 索引 (v3.0.0 · 2026-08-13 對齊實際)

按需載入（L3 on-demand）。透過 `c:skills --list` 查看安裝狀態；即時數量：`find ~/.claude/skills -name SKILL.md | wc -l`（目前 22）。

> ⚠️ 這份索引在 2026-07-16 → 2026-08-13 之間失準過（列了 5 個寫成隔天就被封存的 superpowers 套件，同時漏列 8 個 KKday 專屬 skill）。**改動 `skills/` 時務必同步這張表**——一份會說謊的索引比沒有索引更糟。

## Workflow — 任務執行流程

| Skill | 觸發條件 |
|---|---|
| `run-task` | 推進單一開發任務的生命週期（S0–S5）：「幫我處理 <task>」「繼續 <task>」 |
| `staff-engineer` | 設計 / 實作 / 重構 / 審查任何非瑣碎程式碼時，套用資深主任工程師的判斷（不變式、失敗模式、爆炸半徑） |
| `systematic-debugging` | 遇到 bug、測試失敗、非預期行為（提修法前先系統性定位根因） |
| `test-driven-development` | 實作任何 feature 或 bugfix 前 |
| `verification-before-completion` | 宣稱完成前：執行 linter / test / build 確認 |
| `deep-research` | 需要多來源研究、文獻引用、綜合報告（本機用 `anysearch`） |

## Tech — 技術特定模式

| Skill | 觸發條件 |
|---|---|
| `api-design` | 設計 REST API：命名、狀態碼、分頁、錯誤回應、版本管理 |
| `nuxt4-patterns` | Nuxt 4 hydration 安全、SSR 資料抓取、route rules、懶加載 |

> 跨專案的命名 / 可讀性 / 復用基準規範**不在此處**：走常駐 `claude-md/03-code-standards.md` + 編輯對應檔案時自動注入的 `rules/typescript.md`、`rules/reuse-and-decoupling.md`。

## KKday 專屬

| Skill | 觸發條件 |
|---|---|
| `kk-graph-v2` | 跨 repo / 跨服務關係查詢（呼叫鏈、改表爆炸半徑、API→表）；先 `q.sh` 定位再讀 source |
| `kkday-design-system` | 產出任何 KKday UI（mockup / HTML / Vue）前必用：`$kk-*` token + `KkXxx` 元件 |
| `kkday-investigate` | 線上問題調查 SOP（log + DB + 原始碼三維度）：訂單號、會員 UUID、Jira 單號、「線上出事」 |
| `kkday-mcp-ops` | kkday MCP stack（PG / Kibana / QA tools）設定與維運：「pg 連不上」「MCP 逾時」 |
| `tool-jenkins` | Jenkins (SIT) job 狀態、build 失敗、console log、觸發 build |
| `tool-kibana` | 透過 Kibana (SIT) 查 log / 解短網址 / 找 index pattern |
| `tool-prometheus` | Prometheus 指標、PromQL、資源用量、QPS、延遲、服務健康度 |

## Meta — 系統與工具

| Skill | 觸發條件 |
|---|---|
| `agent-orchestration` | 多 agent 編排：Supervisor / Swarm / Hierarchical、DAG 並行調度 |
| `browser-automation-router` | 瀏覽器操作前路由決策（一律 Chrome）：chrome-devtools（預設調試/量測）/ claude-in-chrome（需真實登入態）/ Browser pane（本專案 dev 預覽） |
| `find-skills` | 本地無匹配 skill 時搜尋社群 skill 集合並提供安裝選項 |
| `awesome-ai-search` | 搜尋 Awesome-AI-Pedia 知識庫，補本地 skills 未涵蓋的 AI 工具 / 最佳實踐 |
| `memory-search` | 搜尋全域與專案 memory 中的過往決策、偏好、pattern |
| `visual-explainer` | 產出自包含 HTML 視覺報告：架構圖、diff review、計畫審視、複雜表格 |
| `htmltool2-editor` | 把已產出的 HTML 報告接到本地 htmltool2 視覺編輯器直接改文字 |

## 已退場

| Skill | 何時 | 原因 |
|---|---|---|
| `brainstorming` / `researching-code` / `planning-solutions` / `implementing-code` / `reviewing-code` | 2026-07-17 | superpowers 五件套，封存於 `.skills-archived/2026-07-17/` |
| `coding-standards` | 2026-08-13 | `origin: ECC` 舶來教材（內文為 Next.js/Supabase/React），與實際 Vue/PHP 棧不符；已被 `claude-md/03` + `rules/typescript.md` + `rules/reuse-and-decoupling.md` 覆蓋 |
| `mcp-builder` | 2026-08-13 | 與內建 `anthropic-skills:mcp-builder` 內容重複，兩份 description 各佔一份常駐且觸發語意重疊 |
| `security-scan` | 2026-08-13 | 依賴未安裝的第三方 npm `ecc-agentshield`（安全工具本身要臨時抓未審查套件）；功能已被 `hooks/config-lint.sh` + `security-guidance` plugin 覆蓋 |

## 品質基準

- frontmatter 規範：`name` + `description`（50–200 字元，由 config-lint R7 校驗）+ `version` + `category`
- R7 的超長豁免自 2026-08-13 起改為**句式自動偵測**（description 含「Use when(ever)」「觸發時機」「當使用者…」等觸發密集句式即豁免上限），`R7_LEN_ALLOW` 只留人工例外。純人工白名單已落後過一次，勿再單靠它。
- 驗證：`pnpm run c:validate --skills`

## 更新方式

```bash
pnpm run c:skills --list            # 查看所有 skills 狀態
pnpm run c:skills --install <name>  # 安裝到 ~/.claude/skills/
pnpm run c:skills --update <name>   # 更新（觸發 config-choice flow）
```
