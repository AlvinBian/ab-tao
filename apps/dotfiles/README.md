# @ab-tao/dotfiles

開發環境配置層 — 互動式安裝精靈、技術棧感知、Claude Code 配置生成、ZSH 環境管理。

## 職責

從 `@ab-tao/commons` 資源池中按技術棧動態篩選，只安裝匹配的工具與配置，部署到 `~/.claude/` 與 `~/`。

```
bin/          — CLI 入口（setup / scan / status / report / restore / hooks / prefs-sync / chrome / uninstall）
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
- **互斥鎖保護** — 寫入期間自動建立 `state.lock`，防止 Console 並發衝突

## 指令

```bash
pnpm run d:setup           # 互動式環境部署
pnpm run d:scan            # 技術棧掃描 + 技能庫生成
pnpm run d:setup --doctor  # 環境診斷
pnpm run d:status          # 配置狀態儀表板
pnpm run cs:open           # Web 後台控制台
pnpm run d:restore         # 還原備份
pnpm run d:hooks           # Hook 管理
pnpm run d:prefs-sync      # iCloud 偏好檔同步
pnpm run d:chrome          # Chrome 書籤 / 設定同步
pnpm run d:uninstall       # 移除 ab-tao
```

## 配置合併策略

`d:setup` 使用非對稱合併策略保護使用者自訂配置：

| 設定項                  | 策略       | 說明                                   |
| ----------------------- | ---------- | -------------------------------------- |
| `permissions.allow`     | preserve   | 使用者自訂允許清單完整保留             |
| `permissions.deny`      | union      | 模板安全基線 ∪ 使用者新增，不丟失基線  |
| `hooks`                 | dedup      | 相同 matcher + command 組合去重        |
| `enabledPlugins`        | preserve   | 使用者已安裝插件不被覆蓋               |
| `extraKnownMarketplaces`| 不寫入     | 空陣列自動過濾，不污染 settings.json   |

## 行為改善（v1.1.0）

- **Slack 發送強規則** — 未得到明確確認時，絕不自動呼叫 Slack 傳送工具
- **ccline 偵測穩定化** — 改用 `pnpm list -g` 權威查詢，消除 PATH 誤判重裝
- **SessionStart 配置提示** — settings.json 實質變更後，下次 session 開啟時自動提示 reload
- **互斥鎖** — `d:setup` 執行期間寫入 `state.lock`，Console GUI 同步顯示唯讀狀態
