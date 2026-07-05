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
| **codebase-memory-mcp 代碼智能** | 見下方「codebase-memory-mcp 整合」章節（語義 + 依賴圖 + blast radius）|

## codebase-memory-mcp 代碼智能整合

`codebase-memory-mcp`（MIT，26.4k★，158 語言，內建 code embedding）為 repo 建**持久知識圖譜 + 語義向量**，透過 MCP（`mcp__codebase-memory-mcp__*`，14 tools）**一個工具兼語義搜尋 + 結構依賴圖 + blast-radius**，取代 claude-context / CodeRAG / code-review-graph / serena（實測背書，見 `docs/local-tools.md §A`）。

> **無感優先(預設行為)**：探索/理解/搜尋代碼時**預設走 codebase-memory**（`search_graph` 找代碼、`query_graph`/`detect_changes` 看影響），**取代 grep+Read 組合**；grep 僅用於精確字串比對。`auto_index=true` 已開 → MCP session 啟動自動建/更新索引,**無需手動 index**。

### 任務 → 工具映射

| 任務 | 工具（`mcp__codebase-memory-mcp__*`）| 典型場景 |
|---|---|---|
| 語義搜尋 / 按意思找代碼 | `search_graph` | "處理 X 的代碼在哪" |
| **Blast radius / 改動影響** | `detect_changes`（git diff→影響+風險）/ `query_graph` | "改 X 會 break 什麼？" |
| Trace / 依賴鏈 / callers | `trace_path` / `query_graph`（callers_of/callees_of）| "誰呼叫 X" |
| 架構探索 / hub 熱點 | `get_architecture`（hotspots/fan-in）| "How does X work?" |
| 讀符號源碼 / schema | `get_code_snippet` / `get_graph_schema` | 取源碼 / 圖結構 |
| 建 / 更新索引 | `cli index_repository`（2s 級）| 初次索引 / reindex |

⚠️ **能力邊界（誠實）**：不做**安全 rename**（LSP refactor，舊 crg/serena 有，現無替代 → 用 IDE）；「業務流程可視化」偏 **Understand-Anything**（人看 dashboard，見 §G）。

### 使用原則
1. **新 repo**：`cli index_repository`（2s）→ `get_architecture` 建心智模型 → `search_graph` 深入
2. **改動後**：`detect_changes` 確認 blast-radius
3. **Debug**：`search_graph` 定位 → `trace_path` / `query_graph` 追依賴鏈

> 環境：node 套件（`npm i -g codebase-memory-mcp`），**零重依賴**（無 PyTorch/Docker/daemon）；MCP 於 `.claude.json` user scope（穩定 fnm default node bin），重啟 session 載入，每 repo 首次需 index。**Understand-Anything（人視覺）互補**。

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

## PR / Code Review 工作流 + Review 深淺分流

> 降噪原則（Signal > Volume）、狀態偵測分流、needSlack 產物契約、tier 自動判定與升級訊號、Quick 能力組合 → Read `~/.claude/docs/agent-review-workflow.md`（執行 PR / code review 時）。
> 速記：PR 連結→僅 PR review 不發 Slack；Slack 連結→需在原 thread 回覆。P0/P1 inline、P2/P3 併 summary、正確碼不評論。草稿先行。

## 多 session 監看

啟動 `/bg`、`ralph-loop` 或背景 agent 後，主對話可用 `claude agents` 一覽所有 session 狀態 / 耗時 / 退出原因，無需逐一切換。

## 瀏覽器自動化分流

遇到任何瀏覽器操作需求，先套用 `browser-automation-router` skill 決策：

| 場景 | 工具 |
|---|---|
| session 內互動 / Lighthouse / 記憶體分析 | chrome-devtools MCP |
| 長任務 / self-healing / domain helper 沉澱 | browser-harness |

> browser-harness 預設啟用（d:setup 自動安裝）；停用：`c:locals --stop browser-harness`。

## Subagent 成本控制：Tool(param:value) 權限語法

> 用 deny rule 精準封鎖特定參數值（`Agent(model:opus)` 擋 Opus subagent、`Bash(run_in_background:true)` 擋背景 Bash），與 `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` env 互補 → 完整語法、匹配規則、陷阱見 `~/.claude/docs/agent-review-workflow.md`（配 subagent 權限時）。

</agent_orchestration>
