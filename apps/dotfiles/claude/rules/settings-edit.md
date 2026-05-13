---
name: settings-edit
description: Claude / ab-tao 設定檔修改紅線與優先級。
paths:
  - "**/.claude/settings.json"
  - "**/.claude/settings.local.json"
  - "**/.ab-tao/state.json"
---

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

</config_management>
