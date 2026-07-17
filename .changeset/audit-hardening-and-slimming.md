---
'@ab-tao/dotfiles': minor
---

9 維度審計落地：config-lint 靜默失效偵測 + 護欄確定性下沉 + 常駐瘦身 + 入口收斂

**config-lint（agnix-lite，本版核心）**
- 新增 `hooks/config-lint.sh` + `defs/config-lint.json`：9 條規則偵測「文件寫了但不存在/不生效」（R1 行數上限、R2 引用路徑、R3 q.sh 子指令、R4 defs↔settings 對賬、R5 `_abTao` 旗標消費者、R6 枚舉合法性、R7 skills description/封存斷鏈、R8 明文 secret、R9 殘留檔），SessionStart 7 天節流、warn-only；首跑挖出 37 findings（含本地 defs 6 檔重複註冊 drift），修至 0
- 新增 `scripts/pr-auto-approve-check.sh`：auto-approve 六條件中 ③④⑤＋安全閥改確定性計算（4 個真實 PR 端到端驗證）

**護欄確定性下沉（no-mistakes 思路）**
- `pre-tool-bash.sh`：裸 `git commit`/`git push` warn-only 三豁免提醒；移除 `--force-with-lease` 自相矛盾攔截
- `pre-tool-edit.sh`：`settings.json`/`state.json` 完整路徑精確攔截（§10 禁改清單 backstop）
- `session-end.sh`：security_warnings 30 天 GC＋race-condition 殘留掃描＋backups 輪替保留 10 份；decay scan 改寫 `.ab-tao/decay-report.md`
- settings：`enableAllProjectMcpServers=false`、deny +=`Agent(model:opus)`、`_abTao` 清 3 個零消費者空氣開關（costRouting/memoryLintEnabled/tddStrictMode，孤兒 hook pre-tool-edit-tdd.sh 一併刪）

**常駐瘦身與入口收斂（33.6KB → 28.3KB，-16%）**
- 14-confirmation 73→32 行（觸發清單指向 §05 唯一權威）；13-agent-orchestration -2.9KB（瀏覽器分流表/schema 範例/工具長文下放 pointer）；08-state-system 重寫指向真正運作的 `projects/*/memory/`
- 開發入口收斂：superpowers 五件套歸檔（brainstorming→skills-archive；ai-sdlc 四件套加 commons-loader denylist 防重裝）；Kkday 統一 run-task+staff-engineer
- github MCP 退場（統一 gh CLI，消除 PAT 落地）；`preserve-policy` FORBIDDEN_DIRS 補 skills-archive/commands-archive

**清退**
- 死檔 hooks.json、v160 雙版本與 federated-memory 實體歸檔 `docs/archive/`、Plan Frontmatter Convention 刪除（0% 落地）、memory-search description 誠實化、coding-standards 封存斷鏈修復
