# @ab-tao/dotfiles

開發環境配置層 — 互動式安裝精靈、技術棧感知、Claude Code 配置生成、ZSH 環境管理。

## 職責

從 `@ab-tao/commons` 資源池中按技術棧動態篩選，只安裝匹配的工具與配置，部署到 `~/.claude/` 與 `~/`。

```
bin/          — CLI 入口（setup / scan / status / report / restore / hooks / prefs-sync / uninstall）
libs/         — 核心邏輯（分析、配置生成、部署、技術棧偵測）
claude/       — Claude Code 資源（commands / agents / rules / hooks / skills）
zsh/          — ZSH 環境（~/.zshrc.d/ + sheldon 插件管理，7 個模組）
docs/         — 流程圖（Mermaid）、整合指南
```

## 安裝精靈流程

```
環境檢查 → 分析（GitHub API + AI 分類）→ 確認計畫 → 執行 → 完成
```

- **技術棧偵測** — 靜態特徵掃描 + package.json 依賴分析 + 信心評分
- **角色自動判定** — commit 數 ≥3 → 主力（full CLAUDE.md）/ <3 → 臨時 / 手動 → 工具型
- **斷點續裝** — 偵測上次未完成狀態，支援逐項恢復

## 指令

```bash
pnpm run d:setup           # 互動式環境部署
pnpm run d:scan            # 技術棧掃描 + 技能庫生成
pnpm run d:setup --doctor  # 環境診斷
pnpm run d:status          # 配置狀態儀表板
pnpm run cs:open           # Web 後台控制台（已取代 HTML Dashboard）
pnpm run d:restore         # 還原備份
pnpm run d:hooks           # Hook 管理
pnpm run d:uninstall       # 移除 ab-tao
```
