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
pnpm run help              # 查看所有指令
```

## 指令

> 簡稱規則：`d:` = dotfiles · `c:` = commons

### 全局

| 指令 | 說明 |
|------|------|
| `pnpm run help` | 指令總覽 |
| `pnpm run build` | 構建所有套件 |
| `pnpm run test` | 執行測試（48 tests） |
| `pnpm run lint` | Biome lint |
| `pnpm run format` | 格式化 |
| `pnpm run clean` | 清理快取與 node_modules |

### d: dotfiles（互動式，需 TTY）

| 指令 | 說明 |
|------|------|
| `pnpm run d:setup` | 互動式環境部署 + 第三方工具推薦 |
| `pnpm run d:scan` | 技術棧掃描 + 技能庫生成 |
| `pnpm run d:doctor` | 環境診斷 |
| `pnpm run d:status` | 配置狀態儀表板 |
| `pnpm run d:report` | 瀏覽器 HTML Dashboard |
| `pnpm run d:restore` | 還原備份 |
| `pnpm run d:hooks` | Hook 管理 |
| `pnpm run d:uninstall` | 移除 ab-tao |

### c: commons（AI 資源同步）

| 指令 | 說明 |
|------|------|
| `pnpm run c:sync` | 列出 7 個 AI 來源與狀態（預設不同步） |
| `pnpm run c:sync:select` | 互動式選擇同步 |
| `pnpm run c:sync:all` | 同步全部 7 個來源 |
| `pnpm run c:validate` | 驗證資源結構 + 安全檢查 |

指定同步：`pnpm run c:sync -- --pick ecc,superpowers`

### 版本與發布

```bash
pnpm run changeset        # 建立變更記錄
pnpm run version          # 更新版本號
pnpm run release          # 構建 + 發布
```

## packages/commons

**純資源池** — 只負責同步、驗證、提供 API，不直接安裝到 `~/.claude/`：

- **資源同步引擎** — 7 個外部 AI 來源，支援多選 / 全選 / 跳過
- **安全驗證器** — eval/Function/sudo/rm-rf 攔截、512KB 檔案限制、SHA256 checksum（文件檔為警告模式）
- **版本追蹤** — `.versions.json` 記錄 commit SHA，支援版本鎖定
- **技術棧偵測** — TECH_TO_LANG 映射，供 dotfiles 篩選匹配資源
- **運行時同步** — 7 天 TTL 快取，過期自動觸發同步

### AI 資源來源

| 來源 | 說明 |
|------|------|
| **ecc** | Claude Code 社群資源（commands/agents/rules/skills） |
| **anthropic** | Anthropic 官方 Skills |
| **superpowers** | Claude Superpowers — 進階 agent 能力 |
| **ui-ux-pro** | UI/UX Pro Max Skill — 設計與前端最佳實踐 |
| **claude-plugins** | Anthropic 官方 Plugins |
| **letta** | Letta AI Skills（Slack/Google/Obsidian 整合） |
| **context-engineering** | Context Engineering Skills（context 優化/壓縮/評估） |

## apps/dotfiles

環境配置層（ab-tao v2.1.0）：

- **互動式安裝精靈** — 5 階段部署（分析 → 規劃 → 執行 → 完成）
- **AI 驅動技術棧偵測** — GitHub API + Claude AI 分類 + npm/PyPI/Packagist 查詢
- **Claude Code 配置生成** — 29 commands + 24 agents + rules + hooks
- **ZSH 模組化環境** — 10 個模組（aliases, git, fzf, nvm, completion...）
- **智能資源篩選** — 從 commons 資源池中按技術棧動態匹配，只安裝需要的
- **Pipeline 架構** — Tier 1 並行抓取 → Tier 2 AI 分類 → 技術棧篩選 → 推薦安裝

## 推薦的第三方工具

setup 完成後會推薦安裝以下工具：

- **RTK** — Bash 輸出壓縮 -89%（`curl -fsSL https://rtk.sh | bash`）
- **Claude-Mem** — 跨會話記憶（`npx claude-mem install`）
- **官方 Plugins** — 在 Claude Code 中執行 `/plugin`（code-review · commit-commands · feature-dev · simplify）

## CI/CD

- **PR 檢查** — lint + build + test（`.github/workflows/ci.yml`）
- **自動同步** — 每週一 03:00 UTC 同步外部資源（`.github/workflows/sync.yml`）

## License

MIT
