# ab-tao

Turborepo monorepo — 開發環境統一管理 + 共用資源庫。

## 技術棧

- **Node.js 18+ / pnpm 9+** — 運行環境
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
pnpm run d:doctor          # 環境診斷
pnpm run d:status          # 配置儀表板（含使用監控 + 清理）
pnpm run d:restore         # 還原備份

pnpm run c:sync            # 列出 AI 來源（預設不同步）
pnpm run c:sync:select     # 互動式選擇同步
pnpm run c:sync:all        # 同步全部 7 個來源
pnpm run c:validate        # 驗證資源結構
```

## v4 架構：智能配置精靈 + 最佳輪子編排

保留層（核心資產）：
```
  setup 互動精靈        — 5 階段部署（環境檢查 → 功能選擇 → 分析 → 確認 → 執行）
  CLAUDE.md 八大模塊    — 工作流 + 質量紅線 + 編碼標準 + 指令 + 規範
  commons 資源同步      — 7 個 AI 來源、版本追蹤、安全驗證
  5 個獨有 agents       — 架構師/計劃/TDD/程式碼審查/安全審查
  ZSH 模組化環境       — 10 個模組（aliases/git/fzf/nvm/completion...）
  .claudeignore         — 自動生成，按 repo 偵測
  預索引                — .claude/index/ 壓縮索引（API/組件/schema）
  Rules                 — 只保留 paths 條件載入 + Hooks 過濾
```

推薦安裝層（第三方輪子）：
```
  Token 優化            — RTK（Bash 輸出 -89%）· Claude-Mem（跨會話記憶）
  官方 Plugins          — code-review · commit-commands · feature-dev · simplify
  增強工具              — pilot-shell · prompt-improver · LSP（按語言）
  監控與診斷            — statusline（自動部署）· doctor（環境診斷）
```

## 開發規範

- **Commit** — Conventional Commits（繁體中文）
- **版本** — `pnpm run changeset` 建立變更記錄，`pnpm run version` 更新版本
- **安全** — 外部資源必須通過 security-validator（eval/sudo/rm-rf 攔截 + 512KB 限制，.md 為警告模式）
- **測試** — Node.js 原生 test runner，`node --test __tests__/*.test.mjs`
- **註釋** — 所有程式碼註釋、說明、測試描述使用繁體中文
