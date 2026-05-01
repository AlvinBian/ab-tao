<agent_orchestration>

## 資源速查表

| 需求 | 使用 |
|---|---|
| 架構設計 / 審查 | `architect` agent |
| 除錯 / 修復 | `debugger` agent |
| 複雜計畫 | `/plan` mode 或 `Plan` subagent |
| 程式碼審查 | `code-review` plugin |
| 廣域探索 | `Explore` subagent |
| 需求結構化 / spec | `/specify` command |
| spec AC 反向驗證 | `/verify` command |
| 找 skill / 補 skill | `find-skills` skill（auto-trigger + 手動 `pnpm run c:skills --find`）|

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

## 何時**不要** spawn agent

- 使用者問題 1–2 個工具能直接回答 → 主對話自己做
- 已知檔案路徑要讀 / 改 → 直接 Read / Edit，不要 Explore
- 純 yes/no / 概念性問題 → 直接答，不要 research agent
- 為了「看起來在做事」而 spawn → 禁止

agent 適用情境：搜尋密集、多檔案 cross-reference、結果需獨立第二意見、可平行的多方向探索。

## DAG 並行執行

**原則**：有明確依賴圖（DAG）的多 phase 任務，**強制優先使用多 agent 並行**，禁止盲目序列執行。

### 何時觸發

- plan / 任務含 ≥3 phase
- phase 間有明確依賴（可繪 DAG）
- 使用者批准 plan 後、使用者問「能並行嗎 / 有更好切分嗎」、使用者下「按照計畫執行」

### 執行流程（4 步）

1. **依賴分析**：列所有 phase → 繪 DAG → 標檔案衝突點
2. **Wave 切分**：同 Wave 內 ① 無直接依賴 ② 無檔案衝突
3. **並行啟動**：單一 message 多 Agent tool call（foreground）
4. **Wave gate**：Wave N 全完成 + review → 啟 Wave N+1

### 禁止

- 序列執行可並行 phase
- Wave 內未檢查檔案衝突就並行（race condition）
- 不列 DAG 直接並行（邏輯錯誤）
- 單 agent 跨 Wave 執行（違反 gate 原則）

### 衝突處理

兩 phase 改同檔 → 選一：
- 合併為同一 agent（熱檔共修）
- 強制序列化（放不同 Wave）
- 拆檔解耦（若檔案本身過大）

### Agent 分派建議

| phase 類型 | 建議 subagent_type |
|---|---|
| 架構/設計評估 | `architect` |
| 除錯 / build 修復 | `debugger` |
| 程式碼審查 | `code-reviewer` |
| 探索/分析 | `Explore` / `general-purpose` |
| 規劃 | `/plan` mode / `Plan` subagent |
| 重構/簡化 | `architect` agent（5 維審查含簡化建議）|

## 瀏覽器自動化分流

遇到任何瀏覽器操作需求，先套用 `browser-automation-router` skill 決策：

| 場景 | 工具 |
|---|---|
| session 內互動 / Lighthouse / 記憶體分析 | chrome-devtools MCP |
| 長任務 / self-healing / domain helper 沉澱 | browser-harness |

> browser-harness **預設啟用**（d:setup 自動安裝）；不需要時可在 d:setup 功能選擇取消勾選，
> 或透過 `c:locals --stop browser-harness` 暫停。

</agent_orchestration>
