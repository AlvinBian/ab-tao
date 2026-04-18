# claude-md/ — 核心規則模組

每個檔案對應一個語義邊界，透過 `~/.claude/CLAUDE.md` 的 @import 載入。

| 檔案 | 說明 | 行數上限 |
|---|---|---|
| 00-identity.md | 角色定義（首錨定）| 10 |
| 01-language.md | 語言規則 | 10 |
| 02-response-format.md | 回應格式規範 | 15 |
| 03-code-standards.md | 技術傾向 + 版本管理 + 程式碼規範 + 工作流 | 50 |
| 04-verification.md | Web search 查證規則 | 10 |
| 05-security.md | 安全規範 + bypassPermissions 警示 | 20 |
| 06-quality-targets.md | Core Web Vitals + 兼容性目標 | 10 |
| 07-context-hygiene.md | 降噪四層策略（L0-L3）+ /compact 指令 | 25 |
| 08-memory-system.md | Memory 生命週期 + 三溫層 + 自動策略 | 30 |
| 09-task-system.md | Tasks/Plans/Memory 邊界 + 原生整合 | 25 |
| 10-config-management.md | 全域 ⇄ 專案 ⇄ ab-tao 分工 + 安裝選擇 | 25 |
| 11-audit-system.md | 三種審查模式入口 | 10 |
| 12-exceptions.md | 臨時偏離核心規則的條件 | 15 |
| 13-agent-routing.md | Agent 速查表 + 調度規則（尾錨定）| 30 |

**載入順序**：首尾權重最高（00/01/02 + 13），中段可被 /compact 犧牲。
