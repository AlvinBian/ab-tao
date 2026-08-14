# Claude 全域個人規則 v1.20.0

<!-- 載入順序：首尾權重最高（identity + agent-routing），中段可被 /compact 犧牲 -->
<!-- 來源管理：apps/dotfiles/claude/ 為 source of truth，由 ab-tao d:setup 部署 -->

## 首錨定：核心身份

@claude-md/00-identity.md
@claude-md/01-language.md
@claude-md/02-response-format.md

## 技術與品質

@claude-md/03-code-standards.md
@claude-md/04-verification.md
@claude-md/05-security.md
<!-- 06 品質目標 → rules/vue-nuxt.md（編輯前端檔時注入）；07 context-hygiene → PreCompact/SessionStart hooks（2026-07 機制遷移） -->

## 狀態與配置

@claude-md/08-state-system.md

## 邊界與審查

@claude-md/11-audit-system.md
@claude-md/12-exceptions.md

## 尾錨定：Agent 調度 + 確認機制 + 自我糾正（最高權重）

@claude-md/13-agent-orchestration.md
@claude-md/14-confirmation.md
@claude-md/15-self-correction.md

## 參考資源（真按需：觸發時 Read，勿改回 @import——@ 語法是硬載入）

- 審查模式跑 checklist → Read `~/.claude/docs/audit-checklists.md`
- 查 ~/.claude 結構 / 來源對照 → Read `~/.claude/docs/config-map.md`
- 安裝 / 排查本地工具（codebase-memory、browser-harness、agnix…）→ Read `~/.claude/docs/local-tools.md`
- RTK bash 輸出壓縮說明 → Read `~/.claude/docs/rtk.md`
- 建立 / 更新 Confluence 頁面 → Read `~/.claude/rules/confluence.md`
- 產出 / 改動 .xlsx / 試算表 → Read `~/.claude/rules/excel-ooxml.md`
