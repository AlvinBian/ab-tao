# cross-ide-export

將 ab-tao skills / commands 匯出到 Cursor、Windsurf、Codex 等 IDE，讓跨工具開發環境共享同一套 AI 工作流。

## 觸發場景

- 團隊部分成員使用 Cursor 而非 Claude Code，需要共享相同的 skill 定義
- 切換 IDE 時，不希望重新設定所有慣用 commands
- 評估新 AI IDE 工具（Windsurf / Codex）前，先匯出現有設定作為基準

> **注意：cross-ide-export 目前為 planned feature（M3 CLI 規劃中）**
> 以下命令格式為預留介面，尚未實作。預計於 ab-tao v2.0.0 釋出。
> 當前版本若執行以下命令，會收到「Feature not yet available」提示。

## Usage

```bash
# 匯出至 Cursor（~/.cursor/rules/ 格式）
pnpm run c:export --target cursor

# 匯出至 Windsurf（~/.windsurf/rules/ 格式）
pnpm run c:export --target windsurf

# 匯出至 OpenAI Codex CLI（~/.codex/instructions/ 格式）
pnpm run c:export --target codex

# 選擇性匯出特定 skills
pnpm run c:export --target cursor --only skills/test,skills/check

# 預覽匯出內容（不寫入檔案）
pnpm run c:export --target cursor --dry-run

# 列出各 IDE 匯出格式支援狀態
pnpm run c:export --list-targets
```

各 IDE 匯出格式對照：

| IDE | 目標路徑 | 格式 | 狀態 |
|-----|---------|------|------|
| Cursor | `~/.cursor/rules/*.mdc` | MDC Rule format | planned |
| Windsurf | `~/.windsurf/rules/*.md` | Markdown rules | planned |
| Codex CLI | `~/.codex/instructions/` | YAML instructions | planned |
| VS Code (Copilot) | `.github/copilot-instructions.md` | Markdown | planned |

## Troubleshoot

**執行命令後收到「Feature not yet available」**
此為預期行為。cross-ide-export 為 M3 計劃功能，追蹤進度：`https://github.com/ab-tao/ab-tao/issues/cross-ide-export`。

**匯出後 Cursor 未載入新 rules**
Cursor 需重啟才套用新的 `~/.cursor/rules/`。確認檔案權限正確（`chmod 644`）。

**部分 skill 匯出後語法不相容**
ab-tao skill 格式與 Cursor MDC 存在語法差異，`c:export` 會自動轉換；若轉換失敗，skill 會被標記為 `skipped`，查看 `--verbose` 輸出了解原因。

## Uninstall

```bash
pnpm run d:uninstall --feature cross-ide-export
```

移除後：`c:export` 命令停用；已匯出至其他 IDE 的檔案不會自動刪除，需手動清理。
