# ab-tao

Turborepo monorepo — dotfiles 環境管理 + 共用資源庫。

## 技術棧

- **Node.js 18+ / pnpm 9+** — 運行環境
- **Turborepo** — 任務編排與快取
- **Biome** — 格式化與 lint
- **Changesets** — 版本管理

## 架構

```
apps/dotfiles/     — @ab-tao/dotfiles — 環境配置、系統部署
packages/commons/  — @ab-tao/commons  — 工具庫、AI 資源同步、技術偵測
```

dotfiles 依賴 commons（`@ab-tao/commons: workspace:*`），單向依賴。

## 常用指令

```bash
pnpm install           # 安裝依賴
pnpm run build         # 構建所有套件
pnpm run test          # 執行測試
pnpm run lint          # Biome lint
pnpm run sync          # 同步外部 AI 資源
pnpm run validate      # 驗證資源結構 + 安全檢查
pnpm run format        # 格式化
```

## 開發規範

- **Commit** — Conventional Commits
- **版本** — `pnpm changeset` 建立變更記錄，`pnpm version` 更新版本
- **安全** — 外部資源必須通過 security-validator（eval/sudo/rm-rf 攔截 + 100KB 限制）
- **測試** — Node.js 原生 test runner，`node --test __tests__/*.test.mjs`
