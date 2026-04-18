# Claude 全域個人規則 v1.0.0

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
@claude-md/06-quality-targets.md

## 降噪與配置

@claude-md/07-context-hygiene.md
@claude-md/08-memory-system.md
@claude-md/09-task-system.md
@claude-md/10-config-management.md

## 邊界與審查

@claude-md/11-audit-system.md
@claude-md/12-exceptions.md

## 尾錨定：Agent 調度（最高權重）

@claude-md/13-agent-routing.md
@claude-md/14-dag-parallel-execution.md

## 參考資源（按需載入）

@docs/rtk.md
@docs/audit-checklists.md
@docs/config-map.md
