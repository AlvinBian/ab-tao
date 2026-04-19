# ab-tao

**繁體中文** | [简体中文](README-zh-CN.md) | [English](README-en.md)

Turborepo monorepo — 開發環境統一管理 + 共用資源庫。

## 這是什麼

**ab-tao** 是一套開發環境自動化工具，解決「每台機器、每個專案都要重新設定一遍」的痛點。目前以 Claude Code 生態整合為主，後續會持續擴充更多功能。

核心能力：

- **一鍵部署** — 互動式安裝精靈，自動完成開發工具配置、ZSH 環境、AI 資源同步
- **技術棧感知** — 掃描你的 GitHub repos，用 AI 分類技術棧，只安裝匹配的工具與配置
- **AI 資源池** — 整合社群與官方 AI 來源，版本追蹤 + 安全驗證，一條指令同步到最新
- **快速參考表** — Claude Code 繁體中文版，每日自動同步，部署到 GitHub Pages

典型使用場景：

```
新機器 / 換工作 / 幫朋友設定 → pnpm run d:setup → 10 分鐘搞定全套開發環境
定期更新 AI 資源             → pnpm run c:ai-sync --all → 保持所有工具最新
查 Claude Code 快捷鍵        → 開啟 https://alvinbian.github.io/ab-tao/
```

## 核心優勢

### 智能安裝精靈，不只是「複製配置」

- **技術棧偵測** — 靜態特徵掃描 + package.json 依賴分析 + 信心評分，確保偵測準確
- **AI 自動分類** — 為每個 repo 生成標籤與技術分類，並行處理，結果快取避免重複費用
- **角色自動判定** — 依 commit 數自動分為主力 / 臨時 / 工具三層配置
- **斷點續裝** — 偵測上次未完成的安裝，支援逐項恢復

### 安全驗證，不信任外部資源

同步外部資源時，所有檔案通過多層驗證：危險模式攔截、隱藏字元掃描、SHA256 校驗和追蹤、原子替換（失敗自動回滾）。

### 版本鎖定的資源同步

- SHA 相同自動跳過，不做無意義的同步
- `locked` 狀態完全凍結版本，升級需要明確解鎖
- 支援 `--pick ecc,superpowers` 只同步指定來源

### 對比其他 dotfiles 工具

| 維度           | dotbot / chezmoi | ab-tao                                       |
| -------------- | ---------------- | -------------------------------------------- |
| 技術棧感知     | ✗ 通用配置       | ✓ AI 分析 + 靜態特徵偵測                     |
| AI 工具整合    | ✗                | ✓ commands / agents / rules / hooks 原生支援 |
| AI 資源管理    | ✗                | ✓ 多來源、版本追蹤、安全驗證                 |
| 角色差異化配置 | ✗                | ✓ main / temp / tool 三層自動分級            |
| 安全驗證       | ✗                | ✓ 危險模式攔截 + SHA256                      |
| 斷點續裝       | ✗                | ✓ 偵測未完成狀態，支援逐項恢復               |

## 架構

```
ab-tao/
├── apps/
│   └── dotfiles/          @ab-tao/dotfiles — 智能篩選、互動安裝、動態配置
└── packages/
    ├── commons/           @ab-tao/commons  — 純資源池：同步、驗證、提供 API
    └── share/             @ab-tao/share    — 共用工具庫（utils/libs）
```

職責分離：`commons` 只同步資源 → `dotfiles` 按技術棧篩選 → 只安裝匹配的。

### apps/dotfiles

- **互動式安裝精靈** — 5 階段部署（環境檢查 → 功能選擇 → 分析 → 確認 → 執行）
- **AI 驅動技術棧偵測** — GitHub API + AI 分類，按技術棧動態匹配，只安裝需要的
- **ZSH 模組化環境** — 7 個模組（aliases, git, fzf, nvm, completion...）
- **Claude Code 配置生成** — commands + agents + rules + hooks

### packages/commons — AI 資源來源

| 來源                    | 說明                                                 |
| ----------------------- | ---------------------------------------------------- |
| **ecc**                 | Claude Code 社群資源（commands/agents/rules/skills） |
| **anthropic**           | Anthropic 官方 Skills                                |
| **superpowers**         | Claude Superpowers — 進階 agent 能力                 |
| **context-engineering** | Context Engineering Skills（context 優化/壓縮/評估） |

## 技術棧

- **Node.js 18+** / **pnpm 10+** — 運行環境
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

| 指令              | 說明                    |
| ----------------- | ----------------------- |
| `pnpm run help`   | 指令總覽                |
| `pnpm run build`  | 構建所有套件            |
| `pnpm run test`   | 執行測試                |
| `pnpm run lint`   | Biome lint              |
| `pnpm run format` | 格式化                  |
| `pnpm run clean`  | 清理快取與 node_modules |

### d: dotfiles（互動式，需 TTY）

| 指令                   | 說明                            |
| ---------------------- | ------------------------------- |
| `pnpm run d:setup`          | 互動式環境部署 + 第三方工具推薦 |
| `pnpm run d:scan`           | 技術棧掃描 + 技能庫生成         |
| `pnpm run d:setup --doctor` | 環境診斷（setup Phase 1）       |
| `pnpm run d:status`         | 配置狀態儀表板                  |
| `pnpm run d:report`         | 瀏覽器 HTML Dashboard           |
| `pnpm run d:restore`        | 還原備份                        |
| `pnpm run d:hooks`          | Hook 管理                       |
| `pnpm run d:prefs-sync`     | iCloud 偏好檔同步               |
| `pnpm run d:uninstall`      | 移除 ab-tao                     |

### c: commons（AI 資源同步）

| 指令                          | 說明                                   |
| ----------------------------- | -------------------------------------- |
| `pnpm run c:ai-sync`          | 列出 AI 來源與狀態（預設不同步）       |
| `pnpm run c:ai-sync --select` | 互動式選擇同步                         |
| `pnpm run c:ai-sync --all`    | 同步全部來源                           |
| `pnpm run c:skills`           | Claude Skills 管理（list/install/diff）|
| `pnpm run c:translate`        | 多語系翻譯生成                         |
| `pnpm run c:validate`         | 驗證資源結構 + 安全檢查                |

指定同步：`pnpm run c:ai-sync -- --pick ecc,superpowers`

### 版本與發布

```bash
pnpm run changeset        # 建立變更記錄
pnpm run version          # 更新版本號
pnpm run release          # 構建 + 發布
```

## 文件

### 核心文件

| 文件                                                     | 說明                                                   |
| -------------------------------------------------------- | ------------------------------------------------------ |
| [CLAUDE.md](CLAUDE.md)                                   | 專案指令、架構說明、開發規範                           |
| [apps/dotfiles/README.md](apps/dotfiles/README.md)       | dotfiles 子包說明 — 安裝精靈、指令、目錄結構、版本記錄 |
| [packages/commons/README.md](packages/commons/README.md) | commons 子包說明 — AI 資源來源、安全驗證、指令         |

### Claude Code 參考

| 資源                                                                      | 說明                               |
| ------------------------------------------------------------------------- | ---------------------------------- |
| [Claude Code 快速參考表（繁體中文）](https://alvinbian.github.io/ab-tao/) | 完整快速參考表網頁版，每日自動同步 |
| [原始來源 cc.storyfox.cz](https://cc.storyfox.cz/)                        | 英文原版，by @phasE89              |

### 整合指南

| 文件                                                    | 說明                       |
| ------------------------------------------------------- | -------------------------- |
| [gmail-filters.md](apps/dotfiles/docs/gmail-filters.md) | Gmail 自動分類規則配置指南 |

### 流程圖（Mermaid）

位於 [`apps/dotfiles/docs/flows/`](apps/dotfiles/docs/flows/)：

| 流程圖                                                                  | 說明                  |
| ----------------------------------------------------------------------- | --------------------- |
| [setup-main.mmd](apps/dotfiles/docs/flows/setup-main.mmd)               | 安裝精靈主流程        |
| [phase-plan.mmd](apps/dotfiles/docs/flows/phase-plan.mmd)               | 規劃階段流程          |
| [phase-execute.mmd](apps/dotfiles/docs/flows/phase-execute.mmd)         | 執行階段流程          |
| [ecc-pipeline.mmd](apps/dotfiles/docs/flows/ecc-pipeline.mmd)           | ECC 資源同步 Pipeline |
| [env-check.mmd](apps/dotfiles/docs/flows/env-check.mmd)                 | 環境檢查流程          |
| [feature-map.mmd](apps/dotfiles/docs/flows/feature-map.mmd)             | 功能全景圖            |
| [role-system.mmd](apps/dotfiles/docs/flows/role-system.mmd)             | 角色與權限系統        |
| [session-lifecycle.mmd](apps/dotfiles/docs/flows/session-lifecycle.mmd) | 會話生命週期          |
| [repo-select.mmd](apps/dotfiles/docs/flows/repo-select.mmd)             | 倉庫選擇流程          |
| [config-protection.mmd](apps/dotfiles/docs/flows/config-protection.mmd) | 設定保護機制          |
| [setup-status.mmd](apps/dotfiles/docs/flows/setup-status.mmd)           | 安裝狀態追蹤          |
| [slack-setup.mmd](apps/dotfiles/docs/flows/slack-setup.mmd)             | Slack 整合設定        |
| [upgrade-legacy.mmd](apps/dotfiles/docs/flows/upgrade-legacy.mmd)       | 舊版升級流程          |

## 推薦的第三方工具

setup 完成後會推薦安裝以下工具：

| 工具             | 安裝指令                        | 說明                                                   |
| ---------------- | ------------------------------- | ------------------------------------------------------ |
| **RTK**          | `brew install rtk`              | Bash 輸出壓縮 -89%，安裝後自動生效                     |
| **官方 Plugins** | 在 Claude Code 中執行 `/plugin` | code-review · commit-commands · feature-dev · simplify |
| **CCometixLine** | 自動安裝（setup 時）            | Claude Code statusline — Git 狀態、Context 用量、費用  |

### CCometixLine Statusline

[CCometixLine](https://github.com/Haleclipse/CCometixLine) 是一個用 Rust 寫的高效能 Claude Code statusline 工具，在 `pnpm run d:setup` 選擇「🤖 Claude Code 配置」時自動安裝。

功能：
- Git 分支狀態（branch、dirty、ahead/behind）
- Claude 模型顯示
- Context window 用量百分比
- 費用與 session 時長追蹤
- 互動式 TUI 配置介面（`ccline --config`）
- 多主題支援（cometix、minimal、gruvbox、nord）

安裝後 `~/.claude/settings.json` 自動寫入：

```json
{
  "statusLine": {
    "type": "command",
    "command": "ccline",
    "padding": 0
  }
}
```

## GitFlow

採用標準 GitFlow 分支策略：

| 分支     | 命名格式     | 來源    | 合併到         | 用途                 |
| -------- | ------------ | ------- | -------------- | -------------------- |
| 主分支   | `main`       | -       | -              | 線上穩定版（受保護） |
| 開發分支 | `develop`    | main    | -              | 日常開發彙總         |
| 功能分支 | `feature/*`  | develop | develop        | 開發新功能           |
| 發布分支 | `release/v*` | develop | main + develop | 提測、發版           |
| 緊急修復 | `hotfix/*`   | main    | main + develop | 線上 BUG             |

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

| Workflow      | 觸發                  | 說明                                           |
| ------------- | --------------------- | ---------------------------------------------- |
| **CI**        | push → main           | lint + build + test + 資源同步驗證             |
| **Git Flow**  | PR + push + tag       | 分支校驗 + PR 來源校驗 + commit 校驗 + Release |
| **Release**   | push → main           | Version PR 自動建立 + changeset tag + Release  |
| **Translate** | README.md 變更 → main | 自動翻譯 zh-CN + EN（需要 `GH_PAT` secret）    |
| **Sync**      | 每週一 03:00 UTC      | 自動同步外部 AI 資源                           |

### 必要 Secrets 設定

**Translate workflow** 使用 [GitHub Models API](https://models.inference.ai.azure.com)，需要有 `models` 權限的 PAT：

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
2. 建立新 token，勾選 **Models** 權限（read access）
3. Repo → Settings → Secrets and variables → Actions → 新增 secret：`GH_PAT`

> 預設的 `GITHUB_TOKEN` 不含 `models` 權限，必須另外設定 `GH_PAT`。

## License

MIT
