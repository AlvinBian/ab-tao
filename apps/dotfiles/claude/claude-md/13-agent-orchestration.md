<agent_orchestration>

## Harness 設計原則（提煉自 omp）

| 原則 | 含義 |
|---|---|
| **Harness > Model** | 工具呼叫格式品質決定 model 能力上限 |
| **Schema > Prose** | Subagent 回傳結構化資料，禁止依賴散文解析 |
| **Pattern-trigger > Pre-instruction** | 遇具體 pattern 立即停下，優於通用前置指令 |
| **Curate > Wait** | 主動記憶勝於等使用者說「記住這個」|
| **Preview > Apply** | 預覽確認後再執行，不自動 apply 破壞性操作 |

## 資源速查表

| 需求 | 使用 |
|---|---|
| 架構設計 / 審查 | `architect` agent |
| 除錯 / 修復 | `debugger` agent |
| 複雜計畫 | `/plan` mode 或 `Plan` subagent |
| 程式碼審查 | `/code-review` |
| 廣域探索 | `Explore` subagent |
| 需求結構化 / spec | `/specify` command |
| spec AC 反向驗證 | `/verify` command |
| 找 skill / 補 skill | `find-skills` skill（auto-trigger + 手動 `pnpm run c:skills --find`）|
| **code-review-graph 知識圖譜** | 見下方「code-review-graph 整合」章節（符號依賴 + blast radius + 業務流程）|

## code-review-graph 知識圖譜整合

code-review-graph（MIT，支援 PHP / Vue / TS）為 repo 建**持久增量知識圖譜**，透過 MCP（`mcp__code-review-graph__*`）暴露工具，涵蓋**符號級依賴**（取代非商用 GitNexus）與**業務流程**（`list_flows` / `get_flow` / `generate_wiki`）。
>
> **與 Understand-Anything 互補（非取代）**：兩者按 audience 分工——**Claude 查** → code-review-graph MCP（review/debug 即時取依賴）；**人視覺探索** → Understand-Anything plugin（React dashboard / 導覽 tour / onboarding，見 `docs/local-tools.md §G`）。各自原生 auto-update，不衝突。

### 任務 → 工具映射

> **工具名規則**：MCP 完整工具名為 `mcp__code-review-graph__<name>_tool`（**所有工具皆有 `_tool` 後綴**，v3.4.0 共 30 個）。下表 `<name>` 省略前後綴，呼叫時補上，例：`get_architecture_overview` → `mcp__code-review-graph__get_architecture_overview_tool`。

| 任務 | 工具（`mcp__code-review-graph__*`）| 典型場景 |
|---|---|---|
| 架構探索 / 理解代碼 | `get_architecture_overview` / `semantic_search_nodes` / `traverse_graph` | "How does X work?" |
| **Blast radius / 改動影響** | `get_impact_radius` / `get_affected_flows` | "改 X 會 break 什麼？" |
| Trace bug / 根因 | `traverse_graph` / `query_graph` | "Why is X failing?" |
| Refactor / Rename | `refactor` / `apply_refactor` | "Rename this safely" |
| PR 審查 context | `get_review_context` / `get_minimal_context` | "Review PR #N" |
| 業務流程可視化 | `list_flows` / `get_flow` / `generate_wiki` | "這個 repo 的業務流程" |
| 建 / 更新圖譜 | `build_or_update_graph` / `detect_changes` | 初次索引 / reindex |
| 跨 repo 搜尋 | `cross_repo_search` | 多專案符號查找 |

### 使用原則

1. **新 repo / 陌生模組**：先 `get_architecture_overview` + `generate_wiki` 建心智模型，再 `semantic_search_nodes` 深入符號層
2. **改動後確認**：`get_impact_radius` + `get_affected_flows` 一併確認技術依賴 + 業務流程無斷鏈
3. **Debug 入口**：`get_affected_flows` 定位失效業務流 → `traverse_graph` 追技術符號鏈

> 環境：需 Python 3.11+；CLI 於 `~/.local/bin/code-review-graph`（v3.4.0）；vendor 已 commit 的專案需 `.code-review-graphignore`；MCP 需重啟 session 才載入。已接入 KKday 13 專案（daemon 背景增量更新 + launchd 開機自啟）；取代非商用禁用的 GitNexus。**serena（LSP）並存互補，未卸載**。

## 調度規則（強制）

**1. 併發優先**：多個獨立任務必須 parallel 同時啟動，禁止串行等待。
單一 message 可併發多個 Agent tool call；無依賴者必須同一輪送出。

**2. Background 強制使用**：不阻塞主流程的任務（搜索、分析、探索）用 `run_in_background: true`。
僅結果直接影響下一步決策的 agent 才以 foreground 執行。

**3. 禁止低效模式**：
- 禁止一個 agent 完成後再啟動下一個（串行等待）
- 禁止主對話重複 agent 已在做的搜索
- 禁止只啟動 1 個 agent 處理明顯可拆分的多方向任務

**4. Subagent 分層**：搜索密集、重 I/O 工作下放 subagent；主對話專注決策與整合。

**5. 巢狀展開（條件式優先）**：可深度分解 / 可平行的任務，優先用 sub-agent 巢狀展開（Claude Code 2.1.172+ 起 sub-agent 可再生成 sub-agent，最深 5 層）——上層 supervisor fan-out 下層 worker，提升吞吐。**僅在可分解性明確時展開**：淺任務、1–2 工具能解決的（見下方「何時不要 spawn agent」）仍走主對話。巢狀放大平行度的同時也指數放大 token / 協調成本、降低可觀測性，受 simplicity-first 與範圍爆炸防禦約束，禁止藉巢狀能力過度編排。

## 何時**不要** spawn agent

- 使用者問題 1–2 個工具能直接回答 → 主對話自己做
- 已知檔案路徑要讀 / 改 → 直接 Read / Edit，不要 Explore
- 純 yes/no / 概念性問題 → 直接答，不要 research agent
- 為了「看起來在做事」而 spawn → 禁止

agent 適用情境：搜尋密集、多檔案 cross-reference、結果需獨立第二意見、可平行的多方向探索。

> 多 phase 並行排程（DAG 切分 / Wave gate / 衝突處理）→ Read `~/.claude/docs/agent-dag-parallel.md`（任務含 ≥3 phase 時）。

## Subagent 回傳結構規範（Schema > Prose）

啟動 subagent 時 **prompt 必須明確指定回傳 schema**，禁止接受純 prose 後再自行解析。

**研究 / 探索類**（Explore / general-purpose research）：
```
findings: [{path, line, confidence: ✅|⚠️|❓, summary}]
conclusion: 一句話結論
```

**審查類**（reviewer / architect / pr-test-analyzer / silent-failure-hunter / type-design-analyzer）：
```
issues: [{severity: P0|P1|P2|P3, confidence: high|medium|low, location, fix}]
verdict: SHIP | BLOCK | NEEDS-DISCUSSION
```

**執行類**（debugger / planner）：
```
changes: [{file, before, after, verify}]
done: boolean
verdict: PASS | FAIL | NEEDS-REVIEW
```

**Done-gate Critic（強制）**：`done: true` 必須伴隨 `verdict`。收到 FAIL 或 NEEDS-REVIEW 時：
- 主對話**禁止**標 task complete
- **必須** spawn `reviewer` agent 回頭驗（prompt 明確指出 changes 清單與失敗理由）
- 僅 `verdict: PASS` 才可標完成

> 完整 schema 範例 / prompt 模板 / 與 agents/*.md 的對應表 → `~/.claude/docs/agent-typed-result.md`

## PR / Code Review 工作流（降噪優先）

### 最高原則：Signal > Volume
評論是成本不是產出。每條評論先問「不發會怎樣」。能不發就不發、能合併就不散落、別人提過的絕不重提。

### 第零段：狀態偵測（review 前必跑）
讀 PR 既有 comments/reviews（入口 A 另讀 Slack thread 進度）→ 建「已覆蓋問題清單」→ 分流：
| 偵測到 | 模式 |
|---|---|
| 無評論 | 全新 review |
| 已有評論（含他人）| 增量：只補 net-new，已覆蓋禁重提 |
| 多 reviewer 並行 | 補位：交叉驗證既有，只加沒人提的 |
| Slack thread 已討論 | 回應最新討論點，禁重發總結 |

### 第一段：入口
- PR 連結 → 直接取，needSlack=false
- Slack 連結 → 讀 thread 抓 PR 連結（無則停下問，禁臆測），needSlack=true

### 第二段：Review + 降噪閘門
1. `/code-review` 分析（tier 見下方 Review 深淺分流規格；`--effort` 覆寫）
2. 去重：每個 finding 比對「已覆蓋清單」→ 重複者丟棄（不發 / 不提 / 不附和）
3. 嚴重度閘門：P0/P1 → inline；P2/P3 → 彙整進 1 條 summary 末段「次要」清單；正確碼 → 不評論（禁 per-line LGTM 噪音）
4. 聚合：同類問題多處 → 1 條評論列點，不每處一條
5. 產出 = 最多 1 條 summary + N 條 P0/P1 inline（N 盡量小）

### 第三段：外發（全部草稿先行）
- PR 評論草稿 + Slack 草稿一併呈現 → 確認 → 才發
- Slack（needSlack）走 `/slack` 區塊化（結論 → 風險 → PR 連結）

### 專項工具（pipeline 按 tier 自動掛載 / 手動單呼）
| 工具 | 觸發 |
|---|---|
| `reviewer` agent | always / 第二意見 |
| `silent-failure-hunter` | diff 含 try / catch / `.catch(` / swallow |
| `type-design-analyzer` | diff 含 `.ts` / `.tsx` / `.d.ts` |
| `pr-test-analyzer` | prod code 改 ＆ test 未改 |
| `architect` agent | deep tier / 架構深度審查（5 維度評分）|

### 紅線（引用既有，不重述）
- PR：comment / inline 可；approve / merge 見 §05 deny list
- i18n 缺項：見 §04，不自創文案
- 外發：草稿先行（§05 + Preview > Apply）

## Review 深淺分流規格

### 自動判定 Tier

| 層級 | 觸發條件 | 耗時 |
|---|---|---|
| **quick** | 行數 ≤ 80（stacked +50%）＆ 檔案 ≤ 3 ＆ 無強制升級訊號 | < 90s |
| **standard** | 80–300 行 / 4–10 檔 / 命中 standard 升級訊號 | ~5 min |
| **deep** | > 300 行 / > 10 檔 / 命中 deep 升級訊號 | ~8 min |

**stacked PR**：偵測 git-spice stack（base ≠ main）時，quick 上限 +50%（≤ 120 行）。

### 強制升級訊號

**→ deep**（path allowlist）：
`**/migrations/**` / `**/schema.prisma` / `**/*.sql` / `**/middleware/auth*` / `**/guards/**` / `**/policies/**` / `**/permissions/**` / `**/payment/**` / `**/billing/**` / `**/charge*` / `**/.env*` / `**/config/secrets*` / `**/crypto*` / `**/hash*`

**→ standard**（path allowlist）：
`**/cron*` / `**/scheduler*` / `**/queue*` / `**/cors*` / `**/csp*` / `**/cookie*` / `package.json` dependencies|scripts 段

**→ standard**（risk keyword scan）：
`SECRET` / `SALT` / `PRIVATE_KEY` / `DROP TABLE` / 動態程式碼求值 / React raw HTML 注入屬性 / `child_process` / `bcrypt` / `jwt.sign` / `Math.random`（安全 context）/ diff 含 `^- *if ` 開頭位於 auth 路徑

**→ standard**（diff 形狀）：純刪除 PR `+0/-N` / `.env.example` 改動 / featureFlag default 翻轉

**行數計算排除**：`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `*.snap` / `dist/**` / `*.generated.*` / `*.min.*`

**優先級**：allowlist > keyword > shape > 行數。降級需 4 條全清。

### Quick 模式能力組合

| 能力 | 觸發條件 |
|---|---|
| Diff 正確性檢視 | always |
| typecheck | always |
| lint | always |
| `reviewer` agent | always |
| `silent-failure-hunter` | diff 含 try / catch / `.catch(` / swallow |
| `type-design-analyzer` | diff 含 `.ts` / `.tsx` / `.d.ts` |
| `pr-test-analyzer` lite | prod code 改 ＆ test 未改 |

**覆寫**：`--effort=quick|standard|deep`；`--effort=quick --force` 需附 justification。

## 多 session 監看

啟動 `/bg`、`ralph-loop` 或背景 agent 後，主對話可用 `claude agents` 一覽所有 session 狀態 / 耗時 / 退出原因，無需逐一切換。

## 瀏覽器自動化分流

遇到任何瀏覽器操作需求，先套用 `browser-automation-router` skill 決策：

| 場景 | 工具 |
|---|---|
| session 內互動 / Lighthouse / 記憶體分析 | chrome-devtools MCP |
| 長任務 / self-healing / domain helper 沉澱 | browser-harness |

> browser-harness 預設啟用（d:setup 自動安裝）；停用：`c:locals --stop browser-harness`。

</agent_orchestration>
