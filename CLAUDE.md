# ab-tao

Turborepo monorepo — 開發環境統一管理 + 共用資源庫。

## 技術棧

- **Node.js 18+ / pnpm 10+** — 運行環境
- **Turborepo** — 任務編排與快取
- **Biome** — 格式化與 lint
- **Changesets** — 版本管理

## 架構

```
apps/dotfiles/      — @ab-tao/dotfiles  — 智能篩選、互動安裝、動態配置
packages/commons/   — @ab-tao/commons   — 純資源池：同步、驗證、提供 API
packages/share/     — @ab-tao/share     — 共用工具庫：utils/libs
```

職責分離：commons 只同步資源 → dotfiles 按技術棧篩選 → 只安裝匹配的。

## 指令（簡稱：d = dotfiles · c = commons）

```bash
pnpm run help              # 指令總覽
pnpm run build             # 構建所有套件
pnpm run test              # 執行測試
pnpm run lint              # Biome lint
pnpm run format            # 格式化

pnpm run d:setup           # 互動式環境部署
pnpm run d:scan            # 技術棧掃描
pnpm run d:setup --doctor  # 環境診斷（setup Phase 1）
pnpm run d:status          # 配置儀表板
pnpm run d:report          # 瀏覽器 HTML Dashboard
pnpm run d:restore         # 還原備份
pnpm run d:hooks           # Hook 管理
pnpm run d:prefs-sync      # iCloud 偏好檔同步
pnpm run d:uninstall       # 移除 ab-tao

pnpm run c:ai-sync         # 列出 AI 來源（預設不同步）
pnpm run c:ai-sync --select  # 互動式選擇同步
pnpm run c:ai-sync --all   # 同步全部來源
pnpm run c:skills          # Claude Skills 管理
pnpm run c:translate       # 多語系翻譯生成
pnpm run c:validate        # 驗證資源結構
```

## v2.0.0 架構：輕量化配置 + 命令驅動

保留層（核心資產）：
```
  setup 互動精靈        — 5 階段部署（環境檢查 → 功能選擇 → 分析 → 確認 → 執行）
  /init 動態生成        — 各 repo 執行 claude /init 產生自訂 CLAUDE.md
  commons 資源同步      — 4 個可選 AI 來源（ECC · Anthropic · Superpowers · Context-Engineering）
  2 個 agents           — architect、debugger
  ZSH 模組化環境       — 7 個模組（~/.zshrc.d/ + sheldon 插件管理）
  Rules                 — 只保留 paths 條件載入 + Hooks 過濾
```

推薦安裝層（第三方輪子）：
```
  Token 優化            — RTK（Bash 輸出 -89%，brew install rtk）
  官方 Plugins          — code-review · commit-commands · feature-dev · security-guidance · hookify · ralph-loop · session-report · code-simplifier
  增強工具              — pilot-shell · prompt-improver · LSP（按語言）
  監控與診斷            — CCometixLine ccline（自動部署）· doctor（環境診斷）
```

## 開發規範

- **Commit** — Conventional Commits（繁體中文）
- **版本** — `pnpm run changeset` 建立變更記錄，`pnpm run version` 更新版本
- **安全** — 外部資源必須通過 security-validator（eval/sudo/rm-rf 攔截 + 512KB 限制，.md 為警告模式）
- **測試** — Node.js 原生 test runner，`node --test __tests__/*.test.mjs`
- **註釋** — 所有程式碼註釋、說明、測試描述使用繁體中文
