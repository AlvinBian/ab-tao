# ab-tao

Turborepo monorepo — 開發環境統一管理 + 共用資源庫。

## 架構

```
ab-tao/
├── apps/
│   └── dotfiles/          @ab-tao/dotfiles — 環境配置、系統部署
└── packages/
    └── commons/           @ab-tao/commons  — 工具庫、AI 資源同步、技術偵測
```

`dotfiles` 依賴 `commons`（`workspace:*`），單向依賴，職責分離。

## 技術棧

- **Node.js 18+** / **pnpm 9+** — 運行環境
- **Turborepo** — 任務編排與快取
- **Biome** — 格式化與 lint
- **Changesets** — 版本管理

## 快速開始

```bash
git clone https://github.com/AlvinBian/ab-tao.git
cd ab-tao
pnpm install
pnpm run build
pnpm run test
```

## 指令

### Root（Monorepo 全局）

| 指令 | 說明 |
|------|------|
| `pnpm run build` | 構建所有套件 |
| `pnpm run test` | 執行測試 |
| `pnpm run lint` | Biome lint |
| `pnpm run format` | 格式化 |
| `pnpm run setup` | 互動式環境部署（快捷方式） |
| `pnpm run sync` | 同步外部 AI 資源 (commons) |
| `pnpm run validate` | 驗證資源結構 + 安全檢查 (commons) |
| `pnpm run changeset` | 建立變更記錄 |

### dotfiles（互動式指令，需 TTY）

```bash
pnpm -F dotfiles setup      # 互動式完整部署
pnpm -F dotfiles scan       # 技術棧掃描 + 技能庫生成
pnpm -F dotfiles doctor     # 環境診斷
pnpm -F dotfiles status     # 配置狀態儀表板
pnpm -F dotfiles restore    # 還原備份
pnpm -F dotfiles hooks      # Hook 管理
pnpm -F dotfiles uninstall  # 移除 ab-dotfiles
```

### commons（自動化指令）

```bash
pnpm -F commons sync        # 同步外部 AI 資源
pnpm -F commons validate    # 驗證資源結構
```

## packages/commons

共用工具層，提供：

- **資源同步引擎** — 從 4 個外部 GitHub repo 同步 AI 資源（ECC、Anthropic Skills、Letta、Context Engineering）
- **安全驗證器** — eval/Function/sudo/rm-rf 攔截、512KB 檔案限制、路徑遍歷檢查、SHA256 checksum（文件檔為警告模式）
- **版本追蹤** — `.versions.json` 記錄 commit SHA，支援版本鎖定
- **技術棧偵測** — 自動偵測專案使用的技術，動態載入對應資源
- **運行時同步** — 7 天 TTL 快取，過期自動觸發同步

## apps/dotfiles

環境配置層（從 [ab-dotfiles](https://github.com/AlvinBian/ab-dotfiles) v2.1.0 遷入）：

- **互動式安裝精靈** — 5 階段部署（分析 → 規劃 → 執行 → 完成）
- **AI 驅動技術棧偵測** — GitHub API + Claude AI 分類 + npm/PyPI/Packagist 查詢
- **Claude Code 配置生成** — 27 commands + 22 agents + rules + hooks
- **ZSH 模組化環境** — 10 個模組（aliases, git, fzf, nvm, completion...）
- **ECC 資源整合** — everything-claude-code 外部資源同步與翻譯
- **Pipeline 架構** — Tier 1 並行抓取 → Tier 2 AI 分類 → 合併去重 → 推薦

## CI/CD

- **PR 檢查** — lint + build + test（`.github/workflows/ci.yml`）
- **自動同步** — 每週一 03:00 UTC 同步外部資源（`.github/workflows/sync.yml`）

## 開發

```bash
# 建立變更記錄
pnpm changeset

# 更新版本
pnpm version

# 發布
pnpm release
```

## License

MIT
