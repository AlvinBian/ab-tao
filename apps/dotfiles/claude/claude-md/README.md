# claude-md/ — 核心規則模組

每個檔案對應一個語義邊界，透過 `~/.claude/CLAUDE.md` 的 @import 載入。

| 檔案 | 說明 | 行數上限 |
|---|---|---|
| 00-identity.md | 角色定義（首錨定）| 5 |
| 01-language.md | 語言規則 | 7 |
| 02-response-format.md | 回應格式規範：預設形狀（ADHD 可執行性）→ 例外（四段式降級為架構/選型專用）→ pre-send 自檢 | 39 |
| 03-code-standards.md | 技術傾向 + Simplicity First + 復用分層解耦 + 工作流 | 32 |
| 04-verification.md | Web search 查證規則 + Figma / i18n 判準 | 27 |
| 05-security.md | 安全規範 + Git 操作紅線 + 外部通訊紅線（對外發送分級制，§14 觸發清單/豁免的唯一權威來源）| 58 |
| 08-state-system.md | Tasks/Plans/Memory 邊界 + 溫層架構 + 冷啟動（09 已併入）| 41 |
| 11-audit-system.md | 審查模式入口（/audit）| 4 |
| 12-exceptions.md | 臨時偏離核心規則的條件 | 24 |
| 13-agent-orchestration.md | Agent 調度 + 資源速查 + 本地 skill 觸發（尾錨定）| 81 |
| 14-confirmation.md | 確認機制呈現規範（二值 [Y/N] / 多值 AskUserQuestion）；觸發清單/授權豁免見 §05 | 36 |
| 15-self-correction.md | Loop 偵測、假設顯式化、串流中斷觸發等自我糾正規則 | 63 |

> 行數上限由 `hooks/config-lint.sh` R1 自動校驗（實際行數 + 10% 向上取整，2026-07-17 瘦身後重算）。

> 已裁併：06-quality-targets → `rules/vue-nuxt.md`；07-context-hygiene → hooks 機制；09-task-system → 08；**10-config-management → 禁改清單併入 05、優先級鏈併入 12（2026-08-13）**；16 → `docs/ai-dispatcher.md`、17 → `docs/archive/federated-memory.md`（未部署構想，2026-07-17 封存）、18-self-evolution 已退役刪除（2026-07-16）。

**載入順序**：首錨定（00/01/02）+ 尾錨群（13/14/15）權重最高，中段可被 /compact 犧牲。
