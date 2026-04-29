# plugin-audit

plugin 審計工具，自動偵測 `settings.json` 中的 ghost（已啟用但未安裝）、過時、重複 plugin，輸出可操作的修復清單。

## 觸發場景

- 執行 `pnpm run d:setup --doctor` 時，plugin-audit 作為 Phase 1 子檢查自動運作
- `settings.json` 手動編輯後，執行 `pnpm run c:plugin --audit` 驗證一致性
- 升級 ab-tao 版本後，確認舊版 plugin 是否仍相容

## Usage

```bash
# 完整審計（ghost / 過時 / 重複）
pnpm run c:plugin --audit

# 僅檢查 ghost plugin（已啟用但本機未安裝）
pnpm run c:plugin --audit --only ghost

# 審計並自動修復（移除 ghost、停用過時）
pnpm run c:plugin --audit --fix

# 輸出 JSON 格式報告
pnpm run c:plugin --audit --format json > audit-report.json
```

審計輸出範例：
```
Plugin Audit Report — 2026-04-27
─────────────────────────────────
Ghost plugins (enabled but not installed):
  ✗ security-guidance     → 建議：pnpm add -g @anthropic/security-guidance 或移除 settings.json 條目

Outdated plugins:
  ⚠ code-review@1.2.0    → 最新版 1.4.1，執行 pnpm update -g @anthropic/code-review

Duplicate plugins:
  ！ralph-loop 重複啟用   → settings.json 第 12、34 行重複，建議保留最後一條

Total: 1 ghost / 1 outdated / 1 duplicate
Run with --fix to auto-remediate ghost and duplicate entries.
```

## Troubleshoot

**審計報告誤標 ghost（plugin 已安裝仍報告未找到）**
可能是非標準安裝路徑。在 `settings.json._abTao.pluginPaths` 新增自訂路徑：
```json
{
  "_abTao": {
    "pluginPaths": ["/opt/homebrew/lib/node_modules"]
  }
}
```

**`--fix` 未移除 ghost 條目**
確認 `settings.json` 有寫入權限（`ls -la ~/.claude/settings.json`）。若為唯讀，手動移除對應條目。

**過時 plugin 更新後仍顯示 outdated**
執行 `pnpm run c:plugin --audit --refresh-cache` 強制重新解析版本資訊。

## Uninstall

```bash
pnpm run d:uninstall --feature plugin-system
```

移除後：`c:plugin --audit` 命令停用；已安裝的第三方 plugin 本身不受影響。
