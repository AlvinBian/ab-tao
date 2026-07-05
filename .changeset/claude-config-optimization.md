---
"@ab-tao/dotfiles": minor
---

Claude 配置全層優化 + 工具棧重整

**配置優化（常駐預算 + 一致性）**
- `claude-md/13-agent-orchestration.md` 拆分：PR review 工作流 + Review tier 分流 + Tool(param) 語法 → 新 `docs/agent-review-workflow.md`（含 Review 5 入口路由表），常駐 −16%
- Memory sync drift 修復：`state.mjs` sync.included 幽靈路徑 `memory/preferences|patterns` → `memory/`；config-map/audit-checklists/profiles/memory-templates 同步收斂
- `skills/test-driven-development` 斷鏈 `@testing-anti-patterns.md` 移除

**新工具**
- `bin/verify-claude-sync.mjs`：用 `buildSyncPlan` 驗 source↔live 一致性（forbidden/additive/overwriteInteractive 分類 + state dead-sync 檢查）
- `commands/check.md` Gate 7 CfgSync：品質閘門自動跑一致性驗收
- zoxide 整合（`libs/external/zoxide.mjs`）

**工具棧重整**
- claude-context 退役 → CodeRAG（語義搜尋，本地 fastembed）；doctor / zsh / status / settings.template / mcp.yml 對應更新
