<agent_orchestration>

## 資源速查（唯一性宣告；完整 intent→command 映射見 `docs/ai-dispatcher.md`）

- **開發任務（Kkday workspace）**：`run-task` + `staff-engineer` 是**唯一主線**；官方 feature-dev plugin 僅供非 Kkday 個人專案
- **code review**：`/code-review` 是**主入口**（本地 command）
- **探索/理解代碼、查 caller/影響面**：預設 `codebase-memory-mcp` 的 `search_graph`（語義）/ `query_graph`（依賴、callers）/ `detect_changes`（blast radius），取代 grep+Read 組合；grep 僅用於精確字串比對。`auto_index=true` 已開，無需手動 index。不做安全 rename（用 IDE 的 LSP refactor）。
- ⚠️ **Mixpanel MCP**：`Get-Business-Context` **僅在埋點 / 實驗 / 數據分析任務**才呼叫；勿因對話提及縮寫、產品名、團隊名而觸發（該 server 自帶指令過度激進，此行為是其反制）。

## kkday 本地 skill：預設先用，不等點名

`kk-graph-v2`（跨 repo + 後端 + 資料層爆炸半徑）與 `kkday-design-system`（DS token / 元件規範）遇對應情境**預設先用**，不必使用者點名。兩者的 SKILL.md description 已刻意寫長以保召回，此處不重述適用情境。

- **分工**：`codebase-memory-mcp` = 當前單一 repo；`kk-graph-v2` = 跨 repo + 後端（PHP/Java/.NET）+ 資料層，勿混用。
- ❗ **Absence Protocol**：下「無關聯 / 可安全刪 / 不影響」這類**否定結論**前，先 `./q.sh coverage <repo>`——空結果可能是「未涵蓋」而非「確認沒有」。

## 調度規則（強制）

**1. 併發優先**：多個獨立任務必須 parallel 同時啟動，禁止串行等待；無依賴者必須同一輪送出。（不適用於 run-task 框架內以 stage 定義並行邊界的場景。）

**2. Background 強制使用**：不阻塞主流程的任務（搜索、分析、探索）用 `run_in_background: true`。僅結果直接影響下一步決策的 agent 才 foreground。

> **回報義務不隨 background 下放**：`run_in_background: true` 只免除「等待」，不免除 §02 的定期回報。主對話須在 dispatch 當下與收到結果時各回報一次；subagent 內部步驟不直接對使用者回報，其進度由主對話代述。

**3. 禁止低效模式**：禁止一個 agent 完成後再啟動下一個（串行等待）；禁止主對話重複 agent 已在做的搜索；禁止只啟動 1 個 agent 處理明顯可拆分的多方向任務。

**4. Subagent 分層**：搜索密集、重 I/O 下放 subagent；主對話專注決策與整合。

**5. 巢狀展開（條件式）**：可深度分解 / 可平行的任務優先用 sub-agent 巢狀展開（最深 5 層）。**僅在可分解性明確時展開**；淺任務仍走主對話。巢狀指數放大 token 與協調成本、降低可觀測性，受 simplicity-first 約束，禁止藉此過度編排。

> 多 phase 並行排程（DAG 切分 / Wave gate / 衝突處理）→ 任務含 ≥3 phase 時 Read `~/.claude/docs/agent-dag-parallel.md`。

## 何時**不要** spawn agent

- 使用者問題 1–2 個工具能直接回答 → 主對話自己做
- 已知檔案路徑要讀 / 改 → 直接 Read / Edit，不要 Explore
- 純 yes/no / 概念性問題 → 直接答，不要 research agent
- 為了「看起來在做事」而 spawn → 禁止

適用情境：搜尋密集、多檔案 cross-reference、需獨立第二意見、可平行的多方向探索。

## Subagent 回傳結構規範（Schema > Prose）

格式驗證交給原生 Workflow `agent({schema})`；本節只定義業務 schema 欄位。

- **研究 / 探索類**：`findings: [{path, line, confidence: ✅|⚠️|❓, summary}]` + `conclusion`
- **審查類**：`issues: [{severity: P0|P1|P2|P3, confidence, location, fix}]` + `verdict: SHIP|BLOCK|NEEDS-DISCUSSION`
- **執行類**：`changes: [{file, before, after, verify}]` + `done: boolean` + `verdict: PASS|FAIL|NEEDS-REVIEW`

**Done-gate Critic（強制）**：`done: true` 必須伴隨 `verdict`。收到 FAIL / NEEDS-REVIEW 時：主對話**禁止**標 task complete；**必須** spawn `code-reviewer` 回頭驗（prompt 明確指出 changes 清單與失敗理由）；僅 `verdict: PASS` 才可標完成。

> 完整範例 / prompt 模板 / 與 agents/*.md 對應表 → 設計 subagent 回傳格式時 Read `~/.claude/docs/agent-typed-result.md`。

## PR / Code Review 工作流

- **PR 連結** → 僅 PR review，不發 Slack。**Slack 連結** → 需在原 thread 回覆，且**回覆單行極簡**（`#PR號 ✅ LGTM` / `💬 N findings` ＋連結；細節全在 PR，僅 P0/P1 各追加 1 行）。
- P0/P1 走 inline，P2/P3 併 summary，正確碼不評論。草稿先行。
- ❗ **本地倉庫優先**：review 任何 PR 前先在 `~/Kkday/projects/` 找對應本地倉庫。找到 → 深度 review（`git fetch` + `git show <sha>:<path>` 讀 PR-head 實際 source，**禁止 checkout 對方分支**）。找不到才退回 API-only 淺 review，並在結論**標明「未做本地深度驗證」**。

> 降噪原則、狀態偵測分流、tier 判定與升級訊號、深度 review 完整操作程序 → 執行 PR / code review 時 Read `~/.claude/docs/agent-review-workflow.md`。

## 瀏覽器自動化

**一律走 Google Chrome**（2026-08-04 拍板），不涉入任何非 Chrome 瀏覽器。先套用 `browser-automation-router` skill 做三選一路由（該 skill description 會自動觸發，此處不重述路由表）。

⚠️ **claude-in-chrome 不穩定性**：安全分類器離線時整個 `mcp__claude-in-chrome__*` 命名空間打不開（連 `tabs_context_mcp` 都失敗），屬後端暫時性故障，非本機配置問題——遇到時重試或等恢復，**不要**拿 chrome-devtools 硬做需要真實登入態的任務。

## 其他

- 啟動 `/bg`、`ralph-loop` 或背景 agent 後，主對話可用 `claude agents` 一覽所有 session 狀態，無需逐一切換。
- Subagent 成本控制：用 `Tool(param:value)` deny 語法精準封鎖（`Agent(model:opus)` 擋 Opus subagent）。subagent 預設繼承 session model，搜尋密集型由呼叫端顯式帶 `model: "sonnet"`。配 subagent 權限時 Read `~/.claude/docs/agent-review-workflow.md`。

</agent_orchestration>
