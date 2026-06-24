<config_management>

## 設定檔修改紅線

以下檔案 Claude **禁止主動修改**（除非使用者明確點名）：
- `~/.claude/memory/`、`~/.claude/projects/` — 使用者私有資料
- `~/.claude/settings.json` — 由 ab-tao d:setup 統一管理
- `~/.claude/.ab-tao/state.json` — ab-tao runtime state

## 優先級

衝突時：企業設定 > 使用者全域 > 專案 `.claude/` > plugin 預設。
規則衝突時直接指出，不自行調和。

## 安裝選擇詢問

使用者跑 `d:setup` 出現選項 `[u/k/m/s]` 時，按字面意義回答即可。

## /config 快速設定（CC 2.1.181+）

session 內可用 `/config key=value` 直接設定任一 setting，免進選單；互動 / `-p` / Remote Control 皆支援。

- 例：`/config thinking=false`、`/config effort=high`、`/config model=opusplan`
- `/config --help` 列出所有可用 shorthand key（CC 2.1.183+）
- `/config` 選單切換鍵行為（2.1.183+）：Enter 與 Space 都改值，Esc 為「儲存並關閉」（非還原）

> ⚠️ `/config` 改的是 **live `~/.claude/settings.json`**，非 ab-tao source template。要永久跨機保留須回寫 `apps/dotfiles/claude/settings.template.json` 並 `d:setup`，否則僅當機生效（且 `env` / `permissions.allow` / `model` 等 preserve path 由 local pin，template 不覆蓋）。

</config_management>
