---
name: agent-orchestration
version: 1.0.0
category: workflow
description: >
  Multi-agent 編排完整指南：何時啟動 subagent、三種架構模式（Supervisor / Swarm / Hierarchical）、DAG 並行調度。
  關鍵字觸發：「parallel」「並行」「subagent」「多 agent」「dispatch」「DAG」「fan-out」
tools: Read, Grep, Glob
---

# Agent Orchestration

## 何時用 Subagent

### 適用場景

| 情況 | 使用 subagent | 原因 |
|---|---|---|
| 2+ 獨立任務（無共享狀態） | ✅ | 並行節省實際時間 |
| 搜尋密集 / 重 I/O | ✅ | 釋放主 context 做決策 |
| 需要第二意見 | ✅ | 隔離 context 避免偏見 |
| 多方向探索（不知道哪邊對） | ✅ | 同時試多個方向 |
| 已知路徑 Read/Edit 2-3 個檔 | ❌ | 主對話直接做更快 |
| 純概念問題 / yes-no | ❌ | 不需要 spawn |

### 決策流程

```
任務數量 ≥ 2 且相互獨立？
  └─ Yes → 可並行？（無共享狀態 / 無檔案衝突）
              ├─ Yes → Parallel dispatch（同一 message 多 Agent call）
              └─ No  → Sequential agents
  └─ No  → 主對話自己做
```

### 不要 Spawn 的情況

- 僅 1-2 個 Read 能回答的問題
- 已知路徑直接 Read/Edit，不要 Explore
- 為了「看起來在做事」而 spawn（禁止）

## 三種編排模式

### Pattern 1：Supervisor / Orchestrator

```
User → Supervisor → [Worker A, Worker B, Worker C] → Aggregation → Output
```

**選用時機**：任務有明確分解、需要集中協調、人工監督重要。

**核心問題 — Telephone Game**：Supervisor 會改寫 Worker 回覆，丟失細節。
**解法**：Workers 可直接 `forward_message` 給使用者，跳過 Supervisor 重述。

**限制**：每個 Supervisor 最多帶 3-5 個 Worker（超出加第二層 Supervisor）。

### Pattern 2：Peer-to-Peer / Swarm

```
Agent A ⇄ Agent B ⇄ Agent C  （任意互相交接）
```

**選用時機**：任務需要靈活探索、需求動態浮現、無法預先分解。

**核心機制**：明確的 handoff protocol + 接收方知道傳遞過來的 state。

**風險**：無中央協調器時容易發散，必須設 convergence 條件。

### Pattern 3：Hierarchical

```
Strategy Layer (目標定義)
  └─ Planning Layer (任務分解)
       └─ Execution Layer (原子執行)
```

**選用時機**：大型專案有層次結構、需要戰略 + 戰術 + 執行分層。

**注意**：層間協調開銷重，只在規模夠大時才值得。

## DAG 並行調度（ab-tao 強制規則）

有明確依賴圖（DAG）的多 phase 任務，強制優先使用多 agent 並行。

### 執行流程（4 步）

1. **依賴分析**：列所有 phase → 繪 DAG → 標檔案衝突點
2. **Wave 切分**：同 Wave 內 ① 無直接依賴 ② 無檔案衝突
3. **並行啟動**：單一 message 多 Agent tool call（foreground）
4. **Wave gate**：Wave N 全完成 + review → 啟 Wave N+1

### Agent 分派建議

| Phase 類型 | 建議 subagent_type |
|---|---|
| 架構設計 / 審查 | `architect` |
| 除錯 / build 修復 | `debugger` |
| 程式碼審查 | `code-reviewer` |
| 廣域探索 | `Explore` / `general-purpose` |
| 規劃 | `Plan` subagent |

### 檔案衝突處理

兩個 Phase 改同一個檔案 → 選一：
- **合併**：放進同一個 agent（熱檔共修）
- **序列化**：拆到不同 Wave
- **解耦**：拆分過大的檔案

### 禁止

- 序列執行可並行的 phase
- 未檢查檔案衝突就並行（race condition）
- 不繪 DAG 直接並行（邏輯錯誤）

## Agent Prompt 最佳實踐

每個 subagent prompt 必須：
1. **焦點**：一個明確問題域（不要「修好所有 test」）
2. **自給自足**：所有理解任務需要的 context 都在 prompt 裡
3. **明確輸出**：「回傳根因 + 修改摘要」而非「修好它」
4. **邊界**：「不要修改其他檔案」、「只改 test 不改 production code」

## Context 隔離

- **Instruction passing**（預設）：只傳 subagent 需要的 context
- **Filesystem coordination**：需要多 agent 共享狀態時走檔案，不走 message passing
- **Full context delegation**：避免，會部分抵消 context 隔離的效益

## 常見失誤

| 失誤 | 防止方式 |
|---|---|
| Token 成本低估 | Multi-agent ≈ 15x baseline，提前編預算 |
| Supervisor 瓶頸 | ≤5 worker/supervisor，結果 forward 直接回使用者 |
| 過度分解 | 先測試最小 agent 數，只在確認有 context 隔離效益後才加 |
| Error 串聯 | 每層加 output validation，不盲信上游結果 |
| Agent 漂移 | 每個 agent 明確 scope + 時間限制 |
