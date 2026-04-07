# ab-tao

[English](README_EN.md) | [简体中文](README_CN.md) | **繁體中文**

Turborepo monorepo — 開發環境統一管理 + 共用資源庫。

## 架構

```
ab-tao/
├── apps/
│   ├── dotfiles/          @ab-tao/dotfiles — 環境配置、系統部署
│   └── cheatsheet/        Claude Code 快速參考表（繁體中文 GitHub Pages）
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
| `pnpm run test` | 執行測試 |
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

### cheatsheet（Claude Code 快速參考表）

| 指令 | 說明 |
|------|------|
| `pnpm run cheatsheet:update` | 從原站同步最新版並轉換繁體中文 |
| `pnpm run cheatsheet:force` | 強制更新（忽略版本比對） |

### 版本與發布

```bash
pnpm run changeset        # 建立變更記錄
pnpm run version          # 更新版本號
pnpm run release          # 構建 + 發布
```

## 文件

### 核心文件

| 文件 | 說明 |
|------|------|
| [CLAUDE.md](CLAUDE.md) | 專案指令、架構說明、開發規範 |
| [apps/dotfiles/CHANGELOG.md](apps/dotfiles/CHANGELOG.md) | dotfiles 版本變更記錄 |

### Claude Code 參考

| 資源 | 說明 |
|------|------|
| [Claude Code 快速參考表（繁體中文）](https://alvinbian.github.io/ab-tao/) | 完整快速參考表網頁版，每日自動同步 |
| [claude-code-cheatsheet.md](apps/dotfiles/docs/claude-code-cheatsheet.md) | 快速參考表 Markdown 版（備用） |
| [原始來源 cc.storyfox.cz](https://cc.storyfox.cz/) | 英文原版，by @phasE89 |

### 整合指南

| 文件 | 說明 |
|------|------|
| [gmail-filters.md](apps/dotfiles/docs/gmail-filters.md) | Gmail 自動分類規則配置指南 |

### 流程圖（Mermaid）

位於 [`apps/dotfiles/docs/flows/`](apps/dotfiles/docs/flows/)：

| 流程圖 | 說明 |
|--------|------|
| [setup-main.mmd](apps/dotfiles/docs/flows/setup-main.mmd) | 安裝精靈主流程 |
| [phase-plan.mmd](apps/dotfiles/docs/flows/phase-plan.mmd) | 規劃階段流程 |
| [phase-execute.mmd](apps/dotfiles/docs/flows/phase-execute.mmd) | 執行階段流程 |
| [ecc-pipeline.mmd](apps/dotfiles/docs/flows/ecc-pipeline.mmd) | ECC 資源同步 Pipeline |
| [env-check.mmd](apps/dotfiles/docs/flows/env-check.mmd) | 環境檢查流程 |
| [feature-map.mmd](apps/dotfiles/docs/flows/feature-map.mmd) | 功能全景圖 |
| [role-system.mmd](apps/dotfiles/docs/flows/role-system.mmd) | 角色與權限系統 |
| [session-lifecycle.mmd](apps/dotfiles/docs/flows/session-lifecycle.mmd) | 會話生命週期 |
| [repo-select.mmd](apps/dotfiles/docs/flows/repo-select.mmd) | 倉庫選擇流程 |
| [config-protection.mmd](apps/dotfiles/docs/flows/config-protection.mmd) | 設定保護機制 |
| [setup-status.mmd](apps/dotfiles/docs/flows/setup-status.mmd) | 安裝狀態追蹤 |
| [slack-setup.mmd](apps/dotfiles/docs/flows/slack-setup.mmd) | Slack 整合設定 |
| [upgrade-legacy.mmd](apps/dotfiles/docs/flows/upgrade-legacy.mmd) | 舊版升級流程 |

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

環境配置層（v1.0.0）：

- **互動式安裝精靈** — 5 階段部署（分析 → 規劃 → 執行 → 完成）
- **AI 驅動技術棧偵測** — GitHub API + Claude AI 分類 + npm/PyPI/Packagist 查詢
- **Claude Code 配置生成** — 29 commands + 24 agents + rules + hooks
- **ZSH 模組化環境** — 10 個模組（aliases, git, fzf, nvm, completion...）
- **智能資源篩選** — 從 commons 資源池中按技術棧動態匹配，只安裝需要的
- **Pipeline 架構** — Tier 1 並行抓取 → Tier 2 AI 分類 → 技術棧篩選 → 推薦安裝

## 推薦的第三方工具

setup 完成後會推薦安裝以下工具：

| 工具 | 安裝指令 | 說明 |
|------|----------|------|
| **RTK** | `brew install rtk` | Bash 輸出壓縮 -89%，安裝後自動生效 |
| **Claude-Mem** | `npx claude-mem install` | 跨會話記憶管理 |
| **官方 Plugins** | 在 Claude Code 中執行 `/plugin` | code-review · commit-commands · feature-dev · simplify |

## GitFlow

採用標準 GitFlow 分支策略：

| 分支 | 命名格式 | 來源 | 合併到 | 用途 |
|------|----------|------|--------|------|
| 主分支 | `main` | - | - | 線上穩定版（受保護） |
| 開發分支 | `develop` | main | - | 日常開發彙總 |
| 功能分支 | `feature/*` | develop | develop | 開發新功能 |
| 發布分支 | `release/v*` | develop | main + develop | 提測、發版 |
| 緊急修復 | `hotfix/*` | main | main + develop | 線上 BUG |

> `main` 分支受保護：只能從 `develop` 或 `release/*` 透過 PR 合併，不允許直接推送。

```bash
# 開發新功能
git checkout develop && git checkout -b feature/xxx

# 發布版本
git checkout develop && git checkout -b release/v1.1.0

# 緊急修復
git checkout main && git checkout -b hotfix/xxx
```

## CI/CD

| Workflow | 觸發 | 說明 |
|----------|------|------|
| **CI** | push/PR → main | lint + build + test |
| **GitFlow** | PR + push + tag | 分支校驗 + PR 來源校驗 + commit 校驗 + Release |
| **Sync** | 每週一 03:00 UTC | 自動同步外部 AI 資源 |
| **Translate** | README.md 變更 | 自動翻譯 EN + zh-CN |
| **Cheatsheet** | 每日 03:00 UTC | 同步 Claude Code 快速參考表並部署至 GitHub Pages |

## License

MIT
