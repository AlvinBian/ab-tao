---
"@ab-tao/dotfiles": patch
---

**v1.2.1 — 3 個 HIGH 問題修復**

### 修復

- **state.mjs lock silent write**：`stateWrite` 在鎖逾時（`_lockGloballyFailed`）時現在正確跳過寫入，避免多 session 競態（先前 fast-fail flag 有設但寫入路徑沒檢查）
- **docs-freshness 測試誤報**：移除將 `d:doctor` 標記為過時命令的黑名單條目（d:doctor 已是 v1.2.0 正式命令）
- **agents/ 補 ab- prefix**：`architect.md` → `ab-architect.md`、`debugger.md` → `ab-debugger.md`，兌現 v1.2.0 release notes「all ab-tao resources standardized with ab- prefix」承諾；同步更新 `13-agent-routing.md`、`14-dag-parallel-execution.md`、`config-map.md`、`config-classifier.mjs`、`auto-plan.mjs`

### 升級提示

安裝 v1.2.1 後需手動清除舊 agent 檔案，否則 `~/.claude/agents/` 會同時存在舊版（`architect.md`、`debugger.md`）與新版：

```bash
rm -f ~/.claude/agents/architect.md ~/.claude/agents/debugger.md
pnpm run d:setup
```
