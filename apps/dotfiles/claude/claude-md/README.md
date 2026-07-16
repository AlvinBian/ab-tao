# claude-md/ — 核心規則模組

每個檔案對應一個語義邊界，透過 `~/.claude/CLAUDE.md` 的 @import 載入。

| 檔案 | 說明 | 行數上限 |
|---|---|---|
| 00-identity.md | 角色定義（首錨定）| 10 |
| 01-language.md | 語言規則 | 10 |
| 02-response-format.md | 回應格式規範 | 15 |
| 03-code-standards.md | 技術傾向 + Simplicity First + 復用分層解耦 + 工作流 | 60 |
| 04-verification.md | Web search 查證規則 + Figma / i18n 判準 | 30 |
| 05-security.md | 安全規範 + Git 操作紅線 + 外部通訊紅線（對外發送分級制）| 50 |
| 08-state-system.md | Tasks/Plans/Memory 邊界 + 溫層架構 + 冷啟動（09 已併入）| 40 |
| 10-config-management.md | 設定檔禁改清單 + 優先級 + ab-tao 分工 | 20 |
| 11-audit-system.md | 審查模式入口（/audit）| 10 |
| 12-exceptions.md | 臨時偏離核心規則的條件 | 15 |
| 13-agent-orchestration.md | Agent 調度 + 資源速查 + 本地 skill 觸發（尾錨定）| 160 |
| 14-confirmation.md | 確認機制（二值 [Y/N] / 多值 AskUserQuestion + 授權豁免邊界）| 70 |
| 15-self-correction.md | Loop 偵測、假設顯式化、串流中斷觸發等自我糾正規則 | 60 |

> 已裁併：06-quality-targets → `rules/vue-nuxt.md`；07-context-hygiene → hooks 機制；09-task-system → 08；16 → `docs/ai-dispatcher.md`、17 → `docs/federated-memory.md`、18-self-evolution 已退役刪除（2026-07-16）。

**載入順序**：首錨定（00/01/02）+ 尾錨群（13/14/15）權重最高，中段可被 /compact 犧牲。
