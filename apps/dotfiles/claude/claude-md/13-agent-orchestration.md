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
| 開發任務（Kkday workspace） | `run-task` + `staff-engineer`（唯一主線；官方 feature-dev plugin 僅供非 Kkday 個人專案）|
| code review | `/code-review`（本地 command 為主入口）|

> ⚠️ Mixpanel MCP：`Get-Business-Context` **僅在埋點 / 實驗 / 數據分析任務**才呼叫；勿因對話提及縮寫、產品名、團隊名而觸發（該 server 自帶指令過度激進，此行為其反制）。

## codebase-memory-mcp 代碼智能整合

探索/理解代碼、查 caller/影響面 → 預設 `search_graph`（語義搜尋）/ `query_graph`（依賴/callers）/ `detect_changes`（blast radius），取代 grep+Read 組合；grep 僅用於精確字串比對。`auto_index=true` 已開，無需手動 index。
不做安全 rename（LSP refactor，用 IDE）；業務流程可視化偏人視覺 dashboard（Understand-Anything）。

> 完整任務→工具映射與環境細節 → `docs/local-tools.md §A`。

## kkday 本地 skill 自動觸發（無感優先，預設先用不等點名）

兩個 kkday 專用 skill 已裝於 `~/.claude/skills/`，遇對應情境**預設先用**（細節與踩坑見專案 memory `kkday-graph-and-ds-skills.md`）。

### kk-graph-v2 — 跨 repo 全棧程式+資料關聯圖

跨 repo / 跨服務「關係」問題（呼叫鏈、改表爆炸半徑、API→表）先用 `~/.claude/skills/kk-graph-v2/q.sh` 定位再讀 source。
> **分工**：`codebase-memory-mcp` = 當前單一 repo；`kk-graph-v2` = 跨 repo + 後端（PHP/Java/.NET）+ 資料層爆炸半徑，勿混用。
> **Absence Protocol**：下「無關聯 / 可安全刪」否定結論前先 `./q.sh coverage <repo>`，空結果可能是「未涵蓋」非「確認沒有」。
> 完整指令集與踩坑細節 → 該 skill 本體。

### kkday-design-system — DS token/component 規範

產出任何 KKday UI（mockup / HTML / Vue / 元件）前先用此 skill → 正確 `$kk-*` token + `KkXxx` 元件，不自創 hex/px/圓角/字級；查 token 名稱、design review/QA 比對實作亦觸發。
> 317 icons / 202 pictograms 資產內建於 skill 目錄可直接讀，完整規範 → skill 本體。

## 調度規則（強制）

**1. 併發優先**：多個獨立任務必須 parallel 同時啟動，禁止串行等待。
單一 message 可併發多個 Agent tool call；無依賴者必須同一輪送出。此條不適用於 run-task 框架內以 stage 定義並行邊界的場景（見專案根 CLAUDE.md per-stage mode map）。

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

格式驗證交給原生 Workflow `agent({schema})`（2.1.154+ 原生支援驗證+重試），本規範只定義業務 schema 欄位；完整範例 / prompt 模板 / 與 agents/*.md 對應表 → `~/.claude/docs/agent-typed-result.md`。

- **研究 / 探索類**：`findings: [{path, line, confidence: ✅|⚠️|❓, summary}]` + `conclusion`
- **審查類**：`issues: [{severity: P0|P1|P2|P3, confidence, location, fix}]` + `verdict: SHIP|BLOCK|NEEDS-DISCUSSION`
- **執行類**：`changes: [{file, before, after, verify}]` + `done: boolean` + `verdict: PASS|FAIL|NEEDS-REVIEW`

**Done-gate Critic（強制）**：`done: true` 必須伴隨 `verdict`。收到 FAIL 或 NEEDS-REVIEW 時：
- 主對話**禁止**標 task complete
- **必須** spawn `code-reviewer` agent 回頭驗（prompt 明確指出 changes 清單與失敗理由）
- 僅 `verdict: PASS` 才可標完成

## PR / Code Review 工作流 + Review 深淺分流

> 降噪原則（Signal > Volume）、狀態偵測分流、needSlack 產物契約、tier 自動判定與升級訊號、Quick 能力組合 → Read `~/.claude/docs/agent-review-workflow.md`（執行 PR / code review 時）。
> 速記：PR 連結→僅 PR review 不發 Slack；Slack 連結→需在原 thread 回覆，**回覆單行極簡**（`#PR號 ✅ LGTM` / `💬 N findings`＋連結；細節全在 PR，僅 P0/P1 各追加 1 行）。P0/P1 inline、P2/P3 併 summary、正確碼不評論。草稿先行。
> **本地倉庫優先（深度 review 強規則）**：review 任何 PR 前，先在 `~/Kkday/projects/` 找對應本地倉庫（依 repo 名，如 `kkday-b2c-web` / `kkday-member-ci`）。找到 → **深度 review**：`git fetch origin <PR分支>` 後用 `git show <PR-head-sha>:<path>` 讀 PR-head 實際 source，驗證呼叫鏈 / 契約 / 平行路徑（grep 構建點與 caller），勝過只讀 GitHub diff 的淺 review。找不到本地倉庫才退回 API-only（`get_pull_request_files` 讀 diff）淺 review，並在結論標明「未做本地深度驗證」。**禁止切換對方 working branch**（用 fetch + `git show`，不 `checkout`），避免動到其未提交變更；跨 repo 功能（如 SSR + 前端）務必雙邊契約對照。

## 多 session 監看

啟動 `/bg`、`ralph-loop` 或背景 agent 後，主對話可用 `claude agents` 一覽所有 session 狀態 / 耗時 / 退出原因，無需逐一切換。

## 瀏覽器自動化分流

瀏覽器操作先套用 `browser-automation-router` skill（三選一路由，該 skill description 會自動觸發）。

## Subagent 成本控制：Tool(param:value) 權限語法

> 用 deny rule 精準封鎖特定參數值（`Agent(model:opus)` 擋 Opus subagent、`Bash(run_in_background:true)` 擋背景 Bash），與 `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` env 互補 → 完整語法、匹配規則、陷阱見 `~/.claude/docs/agent-review-workflow.md`（配 subagent 權限時）。

</agent_orchestration>
