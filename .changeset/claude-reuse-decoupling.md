---
"@ab-tao/dotfiles": patch
---

feat(claude): 新增復用/分層/解耦工程原則規則 + 配置一致性修復

- 新增 `rules/reuse-and-decoupling.md`（條件載入，編輯程式碼檔時注入）：復用優先搜尋鏈、DRY 分層抽取（Rule of Three + 職責去處表）、解耦原則（單一職責 / 依賴方向單向 / 元件薄 / 面向介面 / 副作用隔離 / 最小公開面）、反向氣味清單
- `claude-md/03-code-standards.md`：新增「復用 · 分層 · 解耦」核心原則小節（always-on 高層心智模型）；修復失效的 `rules/code-quality.md` 斷鏈指標 → 改指向實際存在的 typescript / vue-nuxt / barrel-exports / reuse-and-decoupling
- `commands/plan.md`：回填 runtime 較新版本（含 `EXECUTE_COMMAND:` 自動派發 + Mandatory Post-Execution Hooks + Done When）
- docs 同步：`config-map.md` rules 7→8 檔、`audit-checklists.md` 審查清單同步；個人規則版本標記統一 v1.7.2
