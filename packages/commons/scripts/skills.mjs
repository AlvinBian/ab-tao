#!/usr/bin/env node

/**
 * c:skills — Claude Skills 子命令管理（Phase 10 實作）
 *
 * 子命令：
 *   --list                列出所有 skills 狀態
 *   --install [name]      從 commons/resources 安裝至 ~/.claude/skills/
 *   --update [name]       更新現有 skill（觸發 config choice flow）
 *   --diff <name>         顯示本地 vs ab-tao template 的 diff
 *   --remove <name>       安全移除（含 state.json 更新）
 *   --find <keyword>      從 commons 搜尋 skill
 *   --from <repo>         從 GitHub 指定來源安裝
 *   --global              寫入 ~/.claude/skills/（預設）
 *   --project             寫入 ./.claude/skills/（專案級）
 */

console.error("c:skills — Phase 10 尚未實作，敬請期待。");
process.exit(1);
