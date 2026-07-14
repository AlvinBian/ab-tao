<config_management>

## 設定檔修改紅線

以下檔案 Claude **禁止主動修改**（除非使用者明確點名）：
- `~/.claude/memory/`、`~/.claude/projects/` — 使用者私有資料
- `~/.claude/settings.json` — 由 ab-tao d:setup 統一管理
- `~/.claude/.ab-tao/state.json` — ab-tao runtime state

## 優先級

衝突時：企業設定 > 使用者全域 > 專案 `.claude/` > plugin 預設。規則衝突時直接指出，不自行調和。

> `/config` 快速設定用法、preserve path 機制、d:setup 選項說明 → Read `~/.claude/docs/config-map.md`（改設定時）

</config_management>
