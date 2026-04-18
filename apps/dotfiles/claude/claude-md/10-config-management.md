<config_management>

## 三層架構

**全域層** `~/.claude/`：所有 session 共享的規則、工具、記憶。
**專案層** `.claude/`（repo 內）：覆蓋全域，僅在該 repo 生效。
**ab-tao 層** `apps/dotfiles/claude/`：共享資源 source of truth，由 ab-tao 部署至全域層。

優先級：企業 > 個人全域 > 專案 > plugin

## ab-tao 職責邊界

**ab-tao 管理**：`claude-md/`、`rules/`、`docs/`、`agents/`、`commands/`、`skills/`、`hooks/`
**使用者自管**：`memory/`、`projects/`（ab-tao 絕不覆蓋）
**chezmoi（可選）**：跨機器同步個人化檔案（CLAUDE.md、settings.json）

## 安裝選擇流程

`d:setup` 對每個 managed 檔案提供：
- `[u]` 使用 ab-tao 預設（自動 timestamp backup）
- `[k]` 保留本地（標記 userOverride，日後自動 skip）
- `[m]` 合併（僅 JSON/YAML）
- `[s]` 跳過本次

選擇持久化至 `~/.claude/.ab-tao/state.json`；`d:setup --reset-choices` 重置。

</config_management>
