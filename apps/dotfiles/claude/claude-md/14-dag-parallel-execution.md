<dag_parallel_execution>

## 原則

有明確依賴圖（DAG）的多 phase 任務，**強制優先使用多 agent 並行**，禁止盲目序列執行。

## 何時觸發

- plan / 任務含 ≥3 phase
- phase 間有明確依賴（可繪 DAG）
- 使用者批准 plan 後、使用者問「能並行嗎 / 有更好切分嗎」、使用者下「按照計畫執行」

## 執行流程（4 步）

1. **依賴分析**：列所有 phase → 繪 DAG → 標檔案衝突點
2. **Wave 切分**：同 Wave 內 ① 無直接依賴 ② 無檔案衝突
3. **並行啟動**：單一 message 多 Agent tool call（foreground）
4. **Wave gate**：Wave N 全完成 + review → 啟 Wave N+1

## 禁止

- 序列執行可並行 phase
- Wave 內未檢查檔案衝突就並行（race condition）
- 不列 DAG 直接並行（邏輯錯誤）
- 單 agent 跨 Wave 執行（違反 gate 原則）

## 衝突處理

兩 phase 改同檔 → 選一：
- 合併為同一 agent（熱檔共修）
- 強制序列化（放不同 Wave）
- 拆檔解耦（若檔案本身過大）

## Agent 分派建議

| phase 類型 | 建議 subagent_type |
|---|---|
| 架構/設計評估 | `architect` |
| 除錯 / build 修復 | `debugger` |
| 程式碼審查 | `code-reviewer` |
| 探索/分析 | `Explore` / `general-purpose` |
| 規劃 | `writing-plans` skill / `Plan` subagent |
| 重構/簡化 | `code-simplifier` |

</dag_parallel_execution>
