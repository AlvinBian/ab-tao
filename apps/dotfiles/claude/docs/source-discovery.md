# source-discovery

AI 資源來源探索系統，管理 10 個 curated source 清單，讓使用者以互動方式選擇性同步 skills / commands / agents。

## 觸發場景

- 初次設置或升級時，執行 `pnpm run c:ai-sync --select` 瀏覽並選擇要同步的來源
- 新增社群 skill source（如 gstack）時，先透過此系統驗證白名單後再同步
- 定期執行 `pnpm run c:ai-sync --check` 確認已選來源的版本是否有更新

## Usage

```bash
# 互動式選擇要同步的來源（推薦）
pnpm run c:ai-sync --select

# 列出所有 10 個 curated source 及狀態
pnpm run c:ai-sync --list

# 同步全部已啟用來源
pnpm run c:ai-sync --all

# 從特定 source 同步 curated skills
pnpm run c:skills:curated --from gstack

# 檢查來源版本更新（不執行同步）
pnpm run c:ai-sync --check

# 新增自訂來源（需通過白名單驗證）
pnpm run c:ai-sync --add-source <github-url>
```

10 個 curated sources：

| # | Source | 類型 | 預設啟用 |
|---|--------|------|---------|
| 1 | ECC (Enterprise Claude Config) | skills / agents | ✓ |
| 2 | Anthropic Official | commands | ✓ |
| 3 | Superpowers | skills | 選配 |
| 4 | Context-Engineering | patterns | 選配 |
| 5 | gstack community | skills | 選配 |
| 6 | ab-tao built-in | hooks / rules | ✓ |
| 7 | pilot-shell | shell integration | 選配 |
| 8 | prompt-improver | rewrite hooks | 選配 |
| 9 | LSP extensions | language servers | 選配 |
| 10 | ralph-loop | iterative debug | 選配 |

**白名單治理原則**：
- 所有 curated source 均通過 `security-validator` 掃描（eval/sudo/rm-rf 攔截 + 512KB 限制）
- 自訂來源（`--add-source`）需提供 GitHub URL，自動執行安全掃描後方可加入
- `.md` 格式 source 進入警告模式（可使用但標示未完整審查）
- 企業環境可在 `settings.json._abTao.sourceAllowlist` 鎖定允許來源清單

## Troubleshoot

**`--select` 互動介面未顯示全部 10 個 source**
確認 ab-tao 版本 ≥ v1.6.0：`pnpm run --filter @ab-tao/dotfiles -- version`。舊版只顯示 4 個來源。

**`--from gstack` 回傳 403 或網路錯誤**
gstack source 需要 GitHub token：`export GITHUB_TOKEN=<your-token>`，或在 `settings.json` 設定 `env.GITHUB_TOKEN`。

**自訂來源安全掃描失敗**
檢視掃描報告：`pnpm run c:ai-sync --add-source <url> --verbose`。常見觸發：含 `curl | bash` pattern 或檔案超過 512KB。

## Uninstall

```bash
pnpm run d:uninstall --feature source-discovery
```

移除後：`c:ai-sync` 命令停用；已同步的 skills / commands 不受影響，保留於 `~/.claude/skills/`。
