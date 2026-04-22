<agent_routing>

## 資源速查表

| 需求 | 使用 |
|---|---|
| 架構設計 / 審查 | `architect` agent |
| 除錯 / 修復 | `debugger` agent |
| 複雜計畫 | `ab-writing-plans` skill 或 `Plan` subagent |
| 程式碼審查 | `code-review` plugin |
| Feature 實作 | `feature-dev` plugin |
| 代碼簡化 | `code-simplifier` plugin |
| 廣域探索 | `Explore` subagent |
| 找 skill / 補 skill | `ab-find-skills` skill（auto-trigger + 手動 `pnpm run c:skills --find`）|

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

→ 多 phase 任務並行執行規則：見 `14-dag-parallel-execution.md`

</agent_routing>
