#!/usr/bin/env node

const HELP = `
\x1b[1m ab-tao 指令總覽\x1b[0m

\x1b[36m── Monorepo 全局 ──────────────────────────────────\x1b[0m
  pnpm run build          構建所有套件
  pnpm run test           執行測試（48 tests）
  pnpm run lint           Biome lint
  pnpm run format         格式化
  pnpm run setup          互動式環境部署（→ dotfiles）
  pnpm run sync           同步外部 AI 資源（→ commons）
  pnpm run validate       驗證資源結構（→ commons）

\x1b[33m── dotfiles 互動式（需 TTY）──────────────────────\x1b[0m
  pnpm -F dotfiles setup      完整環境部署精靈
  pnpm -F dotfiles scan       技術棧掃描 + 技能庫生成
  pnpm -F dotfiles doctor     環境診斷
  pnpm -F dotfiles status     配置狀態儀表板
  pnpm -F dotfiles report     瀏覽器 HTML Dashboard
  pnpm -F dotfiles restore    還原備份
  pnpm -F dotfiles hooks      Hook 管理
  pnpm -F dotfiles uninstall  移除 ab-dotfiles

\x1b[32m── commons 自動化 ──────────────────────────────────\x1b[0m
  pnpm -F commons sync        同步 4 個外部 AI 資源
  pnpm -F commons validate    驗證資源結構 + 安全檢查

\x1b[35m── 版本與發布 ──────────────────────────────────────\x1b[0m
  pnpm run changeset      建立變更記錄
  pnpm run version        更新版本號
  pnpm run release        構建 + 發布
  pnpm run clean          清理所有快取與 node_modules
`;

console.log(HELP);
