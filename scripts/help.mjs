#!/usr/bin/env node

const HELP = `
\x1b[1m ab-tao 指令總覽\x1b[0m

\x1b[36m── 全局 ───────────────────────────────────────────\x1b[0m
  pnpm run build              構建所有套件
  pnpm run test               執行測試
  pnpm run lint               Biome lint
  pnpm run format             格式化
  pnpm run clean              清理快取與 node_modules

\x1b[33m── dotfiles（互動式，需 TTY）──────────────────────\x1b[0m
  pnpm run dotfiles:setup     完整環境部署精靈
  pnpm run dotfiles:scan      技術棧掃描 + 技能庫生成
  pnpm run dotfiles:doctor    環境診斷
  pnpm run dotfiles:status    配置狀態儀表板
  pnpm run dotfiles:report    瀏覽器 HTML Dashboard
  pnpm run dotfiles:restore   還原備份
  pnpm run dotfiles:hooks     Hook 管理
  pnpm run dotfiles:uninstall 移除 ab-dotfiles

\x1b[32m── commons（AI 資源，7 個來源）────────────────────\x1b[0m
  pnpm run commons:sync           列出來源與狀態
  pnpm run commons:sync:select    互動式選擇同步
  pnpm run commons:sync:all       同步全部
  pnpm run commons:validate       驗證資源結構

  指定同步: pnpm run commons:sync -- --pick ecc,superpowers

\x1b[35m── 版本與發布 ──────────────────────────────────────\x1b[0m
  pnpm run changeset          建立變更記錄
  pnpm run version            更新版本號
  pnpm run release            構建 + 發布
`;

console.log(HELP);
