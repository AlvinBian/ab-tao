# GitNexus 知識圖譜整合細節

> 由 `claude-md/13-agent-orchestration.md` 按需指向，架構探索 / blast radius / rename 任務時 Read。

## MCP 工具速查

| Tool | 用途 |
|---|---|
| `query` | 以概念查詢相關執行流程（process-grouped） |
| `context` | 單一符號的 360° 視角（callers / callees / processes） |
| `impact` | 符號 blast radius（d=1 WILL BREAK / d=2 LIKELY / d=3 MAY） |
| `detect_changes` | git diff → 影響的執行流程 |
| `rename` | 多檔案協調 rename（dry_run 先 preview） |
| `cypher` | 原始 Cypher 查詢（先讀 `gitnexus://repo/{name}/schema`）|

**Resource 導航**（輕量，100-500 token）：`gitnexus://repo/{name}/context` → 新 session 必讀，含 staleness 警告。

## Hook 自動增強行為

**PreToolUse（Grep / Glob / Bash grep/rg）**：hook 自動從圖譜取回相關符號，注入 `additionalContext`，不需手動呼叫 MCP。

**PostToolUse（Bash git commit/merge/rebase/pull）**：hook 比對 HEAD 與 `meta.json` lastCommit，若不同則通知 agent 執行 `npx gitnexus analyze`。**Hook 不自動 analyze**（避免阻塞 120s + KuzuDB 衝突），由 agent 自行決定時機。

## Index 管理規則

- 新 session 先讀 `gitnexus://repo/{name}/context`，確認 index 新鮮度
- Index stale → 提示使用者執行 `npx gitnexus analyze`（非同步，不阻塞對話）
- Worktree：linked worktree 沒有自己的 `.gitnexus/`；hook 自動解析 `--git-common-dir` 找到 canonical repo 的 index

## GitNexus + Review 整合

**standard / deep tier** 的 PR review 可選用 `gitnexus-pr-review` 做 blast radius 分析：

```
gitnexus_detect_changes({scope: "compare", base_ref: "main"})
→ Changed: <N> symbols in <M> files
→ Affected processes: <X>, <Y>
→ Risk: LOW / MEDIUM / HIGH / CRITICAL
```

d=1 callers 不在 PR diff 中 → 標記為潛在 breaking change（HIGH finding）。
