# ab-tao

**繁體中文** | [简体中文](README-zh-CN.md) | [English](README-en.md)

Turborepo monorepo — 開發環境統一管理 + 共用資源庫。

## 這是什麼

**ab-tao** 是一套以 Claude Code 為核心的開發環境自動化工具，解決「每台機器、每個專案都要重新設定一遍」的痛點。

核心能力：

- **一鍵部署** — 互動式安裝精靈，5 個階段自動完成 Claude Code 配置、ZSH 環境、AI 資源同步
- **技術棧感知** — 掃描你的 GitHub repos，用 AI 分類技術棧，只安裝匹配的 commands / agents / rules
- **AI 資源池** — 整合 7 個社群與官方 AI 來源，版本追蹤 + 安全驗證，一條指令同步到最新
- **快速參考表** — Claude Code 繁體中文版，每日自動同步，部署到 GitHub Pages

典型使用場景：

```
新機器 / 換工作 / 幫朋友設定 → pnpm run d:setup → 10 分鐘搞定全套開發環境
定期更新 AI 資源             → pnpm run c:sync:all → 保持所有 Claude 工具最新
查 Claude Code 快捷鍵        → 開啟 https://alvinbian.github.io/ab-tao/
```

## 核心優勢

### 智能安裝精靈，不只是「複製配置」

大多數 dotfiles 工具只是把配置檔 symlink 過去。ab-tao 的安裝精靈會**真正理解你的工作環境**：

- **多層技術棧偵測** — 靜態特徵掃描（tsconfig.json、Cargo.toml、go.mod 等 12+ 項簽名）+ package.json 依賴分析 + 信心評分（0–1.0 漸進累積），確保偵測準確
- **AI 自動分類** — 呼叫 Claude Haiku 為每個 repo 生成標籤與技術分類，並行處理多個 repo，結果快取避免重複 API 費用
- **角色自動判定** — commit 數 ≥3 自動標為主力（full CLAUDE.md），<3 為臨時（精簡），可手動覆蓋為工具型（最小）
- **本地路徑偵測** — 同時用 fd、Spotlight、資料夾映射三種方式找到 repo 在本機的位置
- **斷點續裝** — 偵測上次未完成的安裝，支援逐項恢復，不用重頭來過

### 企業級安全驗證，不信任外部資源

同步外部 AI 資源時，所有檔案都通過多層驗證：

- 攔截 6 種危險模式：`eval()`、`Function()`、動態 import、`rm -rf`、`sudo`、HTML 隱藏指令
- 掃描隱藏字元：零寬度字元（U+200B–U+200D、U+FEFF）、控制字元
- 512KB 檔案大小限制，SHA256 校驗和追蹤每個同步檔案
- `.md` 文件採警告模式（說明文本正常），可執行邏輯採錯誤模式
- 原子替換：備份 → 驗證 → 替換 → 清理，失敗自動回滾

### 內容尋址快取，AI 費用降到最低

```
.cache/
  repo-ai/    per-repo AI 分類結果（~0.08¢/次，快取命中免費）
  ecc-ai/     ECC 規則推薦 AI 翻譯結果
  merge/      跨 repo 去重整合結果
```

快取鍵基於 MD5(內容)，輸入相同自動命中。只有實際變更的 repo 才會觸發新的 AI 呼叫。

### 版本鎖定的 AI 資源同步

`.versions.json` 記錄每個來源的 commit SHA + 同步日期：

- SHA 相同自動跳過，不做無意義的同步
- `locked` 狀態完全凍結版本，升級需要明確解鎖
- 7 天 TTL 快取，過期才觸發遠端檢查
- 支援 `--pick ecc,superpowers` 只同步指定來源

### 對比其他 dotfiles 工具

| 維度 | dotbot / chezmoi | ab-tao |
|------|-----------------|--------|
| 技術棧感知 | ✗ 通用配置 | ✓ AI 分析 + 12+ 簽名偵測 |
| Claude Code 整合 | ✗ | ✓ commands / agents / rules / hooks 原生支援 |
| AI 資源管理 | ✗ | ✓ 7 個來源、版本追蹤、安全驗證 |
| 角色差異化配置 | ✗ | ✓ main / temp / tool 三層自動分級 |
| 安全驗證 | ✗ | ✓ 6 種攔截模式 + SHA256 |
| 快取優化 | ✗ | ✓ 內容尋址快取，AI 費用最小化 |
| 斷點續裝 | ✗ | ✓ 偵測未完成狀態，支援逐項恢復 |

## 架構

```
ab-tao/
├── apps/
│   ├── dotfiles/          @ab-tao/dotfiles — 環境配置、系統部署
│   └── cheatsheet/        Claude Code 快速參考表（繁體中文 GitHub Pages）
└── packages/
    ├── commons/           @ab-tao/commons  — AI 資源同步、安全驗證、技術偵測
    └── share/             @ab-tao/share    — 共用工具庫（utils/libs/run/log）
```

`dotfiles` 依賴 `commons` 與 `share`（`workspace:*`），單向依賴，職責分離。

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
| `pnpm run cheatsheet:open` | 在瀏覽器開啟本地 HTML 版本 |

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

- **互動式安裝精靈** — 5 階段部署（環境檢查 → 分析 → 確認計畫 → 執行 → 完成）
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
| **CI** | push → main | lint + build + test + 資源同步驗證 |
| **GitFlow** | PR + push + tag | 分支校驗 + PR 來源校驗 + commit 校驗 + Release |
| **Translate** | README.md 變更 → main | 自動翻譯 zh-CN + EN |
| **Sync** | 每週一 03:00 UTC | 自動同步外部 AI 資源 |
| **Cheatsheet** | 每日 03:00 UTC | 同步 Claude Code 快速參考表並部署至 GitHub Pages |

## License

MIT
