---
"@ab-tao/dotfiles": minor
"@ab-tao/console": patch
---

移除 iCloud 偏好同步功能 + Claude 設定 backport（個人規則 v1.15.0）

- **移除 iCloud 同步全套**：`ab-async` / `d:prefs-sync` / `--from-icloud` / console SyncView / `sync99Local` 偏好下線；user-private 偏好改由 git-based 同步處理（見 `ab-config-sync`）。
- **settings.template.json backport**：新增 `chrome-devtools` / `context7` / `anysearch` MCP server；補破壞性命令 deny（git `checkout --`/`clean`/`stash drop`、`terraform`/`pulumi`/`cdk destroy`、docker `compose down -v`/`system prune`/`volume rm`）；新增 `warp` plugin；`attribution.sessionUrl=false`。
- **新增 UserPromptSubmit hook**：偵測 Jira ticket / Confluence URL / 破壞性命令關鍵字並注入相關 context（kill-switch `CLAUDE_PROMPT_ENRICH=0`）。hook defs 由 8 → 9。
- **claude-md / docs**：新增 `/config` 快速設定章節（10-config-management）與 `Tool(param:value)` 權限語法章節（13-agent-orchestration）；local-tools 新增 anysearch 安裝指引；STRUCTURE / config-map 版號與計數校正（skills 31、hooks 9）。
- **fix(console)**：el-text `type` 由無效值 `secondary` 改為 `info`。
