# @ab-tao/dotfiles

## 1.20.1

### Patch Changes

- 69acc0f: 指針品質修正 + html-report 改指標載入 + config-map 校正

  v1.20.0 把 `13` / `05` 的細節下放到 `docs/` 後，載入完全依賴指標觸發 —— 而指標失效是靜默的。本版是對該機制的驗證與補強。

  **2 條劣質指針改為動詞開頭**

  逐條檢查 14 條下放指標，2 條是名詞結尾的「詳見 X」型（沒有任何時刻會讓人想到要去讀它）：`RTK bash 輸出壓縮說明 →` 改為 `bash 輸出過長要壓縮 / 安裝設定 RTK →`；`bypassPermissions：…適用邊界 →` 改為 `…判斷某操作是否落在其適用範圍內時 →`。

  **`rules/html-report.md` 由 `paths` 改為指標載入**

  本檔 25,846 B（`rules/` 總量 40%），原 `paths: ["**/*.html"]` 無排除 —— 讀到 `node_modules`、build 產物、測試 fixture 裡的任何 HTML 都會整份注入。且它規範的是「產出報告」這個意圖性動作，不是「碰到 HTML 檔」這個附帶事件，`paths` 觸發與語義本就不合。

  改用 `CLAUDE.md` 指標載入後實測確認：v1.20.0 新增的 config-lint R2 反向檢查會自動接管保護（刪掉指標行即報「永遠不會被載入」），順帶驗證該檢查是通用的、不是對原本兩個檔寫死。

  **`docs/config-map.md` 全面校正**

  結構參考的權威文件數字錯了比沒有更糟。實測比對後修正 claude-md 13→12 檔、commands 13→15（補 `pr-watch` 與 `verify`）、hooks 9→15 defs / 17 支 `.sh`、rules 觸發分佈 11+2→10+3，並移除已被 v1.20.0 解決的「R2 掃不到頂層 CLAUDE.md」警語。校對後 claude-md 12 / rules 13 / commands 15 / skills 22 / agents 7 全部與實際相符。

## 1.20.0

### Minor Changes

- e0e74c3: 全域配置重整：同步閉環修復 + 死配置清除 + 常駐瘦身

  **修同步根因**

  `state.json` 的 `managed` 為空物件（機器從未跑完整 `d:setup`），使 `session-start.sh` 的 config drift 偵測迴圈 0 次 —— 是假保護，source 與部署端雙向 drift 長期無警告累積。`d:setup` 本身不能用來修（非 TTY 卡在互動 prompt，且其「舊配置清理」推薦項會把 `code-review` / `verify` / `testing` 誤判成專案級殘留而刪除）。改以 `config-lint` 新增 R11 呼叫 `verify-claude-sync.mjs`（`/check` 的 Gate 7）做一致性驗證，SessionStart 自動跑；`session-start.sh` 該段改為「managed 為空時明講本段不生效」，不再靜默通過。

  **搶救只在部署端但活躍中的檔案**

  `post-tool-failure.sh`（PostToolUse 直接引用）、`statusline.sh`（statusLine 直接引用）、`reorder-settings.js`、`commands/pr-watch.md` 回寫 source —— 這些誤刪或一次 `d:setup` 就會壞。

  **修好的靜默失效**

  - `commands/verify.md` 缺件：`13-agent-orchestration` 的資源速查表引用 `/verify`，部署端卻沒有
  - `session-start.sh` Part 1 移除：`project-prompts/` 不存在使其恆 no-op，且該段的 `cp` 會無條件覆蓋使用者手寫的 `CLAUDE.local.md`，是潛在資料遺失路徑
  - `skills/test-driven-development` 引用不存在的 `@testing-anti-patterns.md`
  - `skills/deep-research` 引用未註冊的 `firecrawl` / `exa` MCP → 改為本機可用的 `anysearch`
  - `skills/README.md` 索引 25 項中 14 項對不上實際（8 幽靈 + 8 遺漏）→ 重建為 22/22 精確

  **修 6 個 code bug（各有反向測試）**

  - `config-lint` R7：`${#desc}` 在 C locale 對 UTF-8 算 bytes 而非字元，使「50–200 字元」對中文 description 實際只剩約 1/1.7。改用 UTF-8 locale 下的 `wc -m`；白名單改為句式自動偵測 + 人工例外雙軌（純人工白名單已落後過一次，長期製造 9 筆噪音）
  - `config-lint` R9：掃描範圍補 `claude-md` / `rules` / `docs`
  - `config-lint` R4：補反向檢查（settings 有掛但 defs 缺）
  - `config-lint` R2：補頂層 `CLAUDE.md` 進掃描清單 + 新增反向檢查（無 `paths:` 的 rules 檔必須被 `CLAUDE.md` 指標引用）—— 這是「指標載入」類規則檔先前唯一沒有安全網的失效路徑
  - `session-end.sh` `.bak` GC：glob 用 `*.bak.*` 但實際檔名是 `*.bak-YYYYMMDD`、`-maxdepth 1` 漏掉子目錄、時間戳解析格式對不上 —— 三重失效使該 GC 從未清掉任何檔。改用 `-mtime`
  - `pre-tool-context-budget.sh`：過閾值後每次 Read 都重複注入同一句提示（實測單一 session 注入 48 次），加冷卻後降為 2 次

  **常駐瘦身 31,754 → 27,689 B（−12.8%，每 session 省約 1,355 tokens）**

  - `02-response-format` 改寫為三層結構（預設形狀 → 例外 → pre-send 自檢），整合 ADHD-friendly 的可執行性規則；四段式由預設降級為「架構設計 / 方案選型」專用例外
  - `13-agent-orchestration` 9,462 → 6,267：刪與 `docs/ai-dispatcher`、skill description 重複的內容；保留全部否定式紅線；新增「回報義務不隨 background 下放」條文
  - `05-security` 6,537 → 5,434：論證下放 docs，19 條紅線逐條驗證保留；吸收 §10 禁改清單
  - `10-config-management` 退場：禁改清單 → §05、優先級鏈 → §12
  - 移除 3 個重複或失效的 skill（`mcp-builder` 與內建重複、`coding-standards` 為與實際技術棧不符的舶來教材、`security-scan` 依賴未安裝的第三方套件）

  **其他**

  - `hook-handler.sh` 通知格式對齊另兩個 hook（三者共用同一 QUEUE_FILE 與 LOCK_DIR，先前格式取決於誰先搶到鎖）；保留其原有的原子搬移，不動競態處理
  - `rules/{confluence,excel-ooxml,html-report}.md` 首次納管；前二者入庫前已脫敏（移除憑證取得手法、內部專案代號、資料 schema 範例共 7 處）
  - 14 個 command 的 frontmatter 補齊；`/test` 與 `rules/testing.md` 的重述改為指標

  驗證：source ↔ 部署端 8 個目標零差異；`config-lint` findings 14 → 1。

## 1.19.1

### Patch Changes

- Slack review 通知四階段 + 既有 hook / 守門改動收斂

  **Slack review 回報階段化（本次主體）**

  - `docs/agent-review-workflow.md`：新增「Slack 通知階段」階段表（S1 接手 Ack / S2 阻塞需澄清 / S3 自動修 nit push / S4 review 結論），四階段皆為單行固定格式、發在原 `thread_ts`。S1 於抓到 PR 連結當下即發，先於任何 review 動作；明確排除「中途進度回報」與「approve 單獨一則」以避免洗版；pr-watch 自動偵測 `headChanged` 的自發 re-review 不發 S1。
  - `claude-md/05-security.md`：外部通訊紅線的「Review 工作流產物免確認直發」清單由兩則擴充為四階段，讓 S1 Ack 不被草稿確認流程卡住（Ack 的價值在即時性）。

  **一併收斂的既有未提交改動**

  - `hooks/directory-added.sh` + `defs/directory-added.json`：`DirectoryAdded` 事件（CC 2.1.219+），`/add-dir` 中途掛入目錄時注入該目錄記憶 / 計畫 / in-repo 慣例，補 `session-start.sh` 只認 startup cwd 的缺口。
  - `hooks/pre-tool-pg-prod-guard.sh` + def：PROD 查詢 harness 層守門（非唯讀語句 deny、危險查詢 deny、其餘 ask）。
  - `hooks/session-start-kkday-mcp.sh` + def：kkday MCP stack 狀態偵測，12h 節流提示。
  - `hooks/config-lint.sh`：新增 R10 反向枚舉 `settings.json.hooks` key，比對 schema 動態抽出的合法事件表，防事件名打錯靜默失效。
  - `hooks/pre-tool-bash.sh`：補 `gh api` 等效寫入與 `gh repo delete` 攔截。
  - `settings.template.json`：deny 補 `Bash(gh repo delete *)`；移除 `CLAUDE_CODE_SUBAGENT_MODEL`（實測為硬鎖，會使 Agent 的 model 參數失效）。
  - `docs/config-map.md`：補 `DirectoryAdded` 輸出契約與 R10 說明。

## 1.19.0

### Minor Changes

- 瀏覽器自動化路由收斂為 Chrome-only（四選一 → 三選一）

  - **`claude-md/13-agent-orchestration.md`**：「瀏覽器自動化分流」整段重寫。所有瀏覽器任務一律走 Google Chrome，不再涉入 Tabbit / Arc / Edge 等非 Chrome 瀏覽器；預設起點改為 **chrome-devtools MCP**（互動 / console / network / 量測全包），僅「必須以使用者本人身分操作真實已登入帳號」才退回 claude-in-chrome，本專案 dev server 預覽維持 Browser pane。改以表格呈現三個情境。
  - **`skills/browser-automation-router/SKILL.md`**：v5.0.0 → v6.0.0。Tabbit 從決策樹移除、改列入「禁用路徑」；description 同步收斂。
  - **`docs/local-tools.md §B`**：刪除 Tabbit 安裝 / 啟動 / profile 複製細節，改為「非 Chrome 瀏覽器已完全退出」的決策記錄與日後重建前提。

  **順帶修正既有矛盾**：13-agent 與 skill 兩份規則原本對「預設用哪個工具」講法相反（前者 claude-in-chrome、後者 chrome-devtools），本次統一為 chrome-devtools 預設。source 端的 skill / docs 原本落後部署檔，一併以較新者回填。

  **動機**：維護單一瀏覽器的專用 MCP + profile 複製方案（登入態快照、Keychain 解密、獨立 user-data-dir、未推上游的 macOS patch）成本高於價值；且 claude-in-chrome 的安全分類器離線時整個工具命名空間不可用，預設改走 chrome-devtools 可避開此單點故障。

## 1.18.1

### Patch Changes

- 7be0893: 修復 d:setup --dry-run 非 TTY 下被自動 Quick 降級掛死 + 清除 2 個空氣開關

  **setup.mjs（bug fix）**

  - 根因：非 TTY 環境自動降級 flagQuick=true 後，Quick 分支仍呼叫 `runLegacyCheckIfNeeded()`→`runUpgrade()` 跳出互動 `p.select`（無 dry-run/TTY 保護），非 TTY 下 stdin 立即 EOF 形同掛死；衝突警告也誤把「自動降級」當「使用者明確衝突」，印出誤導訊息
  - 修法：拆 `explicitQuick`（使用者是否真的打了 `--quick`）與 `flagQuick`（含自動降級）；dry-run 時 `runLegacyCheckIfNeeded()` 只回報偵測結果、不進互動 select；衝突警告改判 `explicitQuick && flagDryRun`
  - 新增 `setup-dry-run.test.mjs`：子行程 timeout 迴歸測試，涵蓋非 TTY dry-run 不掛死 + 明確衝突仍警告

  **settings 清理**

  - `_abTao` 移除 `voiceTrigger`/`skillCreatorEnabled`（config-lint R5 確認全倉庫零消費者，非保留待決）

## 1.18.0

### Minor Changes

- dc58ff6: 9 維度審計落地：config-lint 靜默失效偵測 + 護欄確定性下沉 + 常駐瘦身 + 入口收斂

  **config-lint（agnix-lite，本版核心）**

  - 新增 `hooks/config-lint.sh` + `defs/config-lint.json`：9 條規則偵測「文件寫了但不存在/不生效」（R1 行數上限、R2 引用路徑、R3 q.sh 子指令、R4 defs↔settings 對賬、R5 `_abTao` 旗標消費者、R6 枚舉合法性、R7 skills description/封存斷鏈、R8 明文 secret、R9 殘留檔），SessionStart 7 天節流、warn-only；首跑挖出 37 findings（含本地 defs 6 檔重複註冊 drift），修至 0
  - 新增 `scripts/pr-auto-approve-check.sh`：auto-approve 六條件中 ③④⑤ ＋安全閥改確定性計算（4 個真實 PR 端到端驗證）

  **護欄確定性下沉（no-mistakes 思路）**

  - `pre-tool-bash.sh`：裸 `git commit`/`git push` warn-only 三豁免提醒；移除 `--force-with-lease` 自相矛盾攔截
  - `pre-tool-edit.sh`：`settings.json`/`state.json` 完整路徑精確攔截（§10 禁改清單 backstop）
  - `session-end.sh`：security_warnings 30 天 GC ＋ race-condition 殘留掃描＋ backups 輪替保留 10 份；decay scan 改寫 `.ab-tao/decay-report.md`
  - settings：`enableAllProjectMcpServers=false`、deny +=`Agent(model:opus)`、`_abTao` 清 3 個零消費者空氣開關（costRouting/memoryLintEnabled/tddStrictMode，孤兒 hook pre-tool-edit-tdd.sh 一併刪）

  **常駐瘦身與入口收斂（33.6KB → 28.3KB，-16%）**

  - 14-confirmation 73→32 行（觸發清單指向 §05 唯一權威）；13-agent-orchestration -2.9KB（瀏覽器分流表/schema 範例/工具長文下放 pointer）；08-state-system 重寫指向真正運作的 `projects/*/memory/`
  - 開發入口收斂：superpowers 五件套歸檔（brainstorming→skills-archive；ai-sdlc 四件套加 commons-loader denylist 防重裝）；Kkday 統一 run-task+staff-engineer
  - github MCP 退場（統一 gh CLI，消除 PAT 落地）；`preserve-policy` FORBIDDEN_DIRS 補 skills-archive/commands-archive

  **清退**

  - 死檔 hooks.json、v160 雙版本與 federated-memory 實體歸檔 `docs/archive/`、Plan Frontmatter Convention 刪除（0% 落地）、memory-search description 誠實化、coding-standards 封存斷鏈修復

## 1.17.0

### Minor Changes

- e3ae386: 對外發送分級制 + 全域配置帳實對齊與清退

  **對外發送分級制（2026-07-16 拍板）**

  - 結論性／總結性訊息（進度回報、總結、公告、自由文本）：發送前一律呈現草稿、由使用者親自確認 [Y]；動作語義只授權進入草稿流程，plan 預先聲明與自動化迴圈不豁免；唯一跳過＝當前 turn 明確標示「直接發送」
  - Review 工作流產物（PR 評論／`gh pr review`／固定格式 Slack 單行回報）直發免逐則確認；拿不準一律當結論性
  - `commands/slack.md` v4.2.0：A3/A3.5 雙軌 lint（直發 standard markdown／手貼 mrkdwn）、A4.3 工具前綴泛化＋發送後回讀驗證、轉換器全形標點 bug 定案（`**` 前後只放半形）

  **agent 工作流斷鏈修復**

  - 幽靈 agent：reviewer→code-reviewer、planner→ 內建 Plan；執行類 schema／模板／對應表補 `verdict`（Done-gate Critic 恢復可判定）
  - agent-review-workflow：approve「5 條件」→6 對齊 §05；`/review-pr` 指涉改 `/code-review --effort=deep`

  **清退與帳實對齊**

  - 刪 10 個孤兒／過時 docs（8 零引用 + STRUCTURE.md + self-evolution.md，逐檔驗證無依賴）
  - browser-harness 退役：瀏覽器調試／長任務統一 claude-in-chrome，router skill v3.0.0 三選一
  - 結構索引全面對齊實際：config-map（claude-md 13／agents 7／commands 13／skills 22／docs 21）、claude-md README 重寫、skills README v2.0.0、audit-checklists 修過時斷言＋新增分級制檢查項

- f3d6512: PR review 嚴格護欄自動 approve 機制 + 用戶確認協議 + 常駐瘦身收尾

  **PR review / auto-approve**

  - `gh pr review --approve` 嚴格護欄：6 條件全滿足才自動執行（verdict 僅採信本輪自審、非 deep-tier 敏感路徑、mergeable 非衝突、CI 非失敗態、完成閘門綁定當前 head sha）+ 他人 CHANGES_REQUESTED 安全閥；只 approve 不 merge
  - `13-agent-orchestration.md`：review PR 前先查 `~/Kkday/projects/` 對應本地倉庫，找到則 fetch + `git show` 讀 PR-head 實際 source 深度驗證，取代純讀 GitHub diff 的淺 review

  **用戶確認協議（新 `claude-md/14-confirmation.md`）**

  - 二值決策走 inline `[Y/N]`、多值（3+ 選項）走 AskUserQuestion 彈窗，禁止用連續 Y/N 疊問替代多值決策
  - 全域觸發清單（對外通訊 / git-PR / 破壞性操作 / 程式碼品質偏離 / 範圍設定）+ 授權豁免邊界 + Preview>Apply 呈現規範

  **其他收尾**

  - 修復 §05 斷引用（「見 §13 deep allowlist」該清單實際不存在，改為 §05 自足定義）
  - 瀏覽器工具路由收斂為四選一（claude-in-chrome 預設）；Mixpanel `Get-Business-Context` 反制規則（僅分析任務呼叫，避免對話提及縮寫誤觸發）
  - always-on 常駐內容瘦身、context-budget hook JSON 化、skills 盤點整併、audit-checklists 結構對齊、3 個靜默失效的 context 注入修復

## 1.16.0

### Minor Changes

- 11da2b7: Claude 配置全層優化 + 工具棧重整

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

## 1.15.1

### Patch Changes

- a7aaaac: 修復測試基建：node:test runner 對齊 + 孤兒測試納入執行

  - dotfiles/commons/share 的 `__tests__` 由誤用 `import from 'vitest'`（未宣告依賴 → `ERR_MODULE_NOT_FOUND`，整套件 0 執行）改為零依賴 `node:test`，對齊 `rules/testing.md`「CLI/工具庫採 node:test」。
  - `eslint.config.js`：為這三套件 `__tests__` 關閉 antfu 預設 `test/no-import-node-test`（該規則強制 vitest import，與 node:test runner 自相矛盾；`apps/console` 仍走 vitest 不在範圍）。
  - `rules-whitelist.test.mjs`：預期規則數 8 → 9（補 `php-codeigniter`，v1.10.6 已新增但測試漏更新）。
  - dotfiles test glob 擴至 `libs/*/__tests__/*.test.mjs`，納入先前未被 `node --test` 執行的 6 個孤兒測試（`transaction.test.mjs` 的 `beforeAll`/`afterAll` → node:test 的 `before`/`after`）。
  - 結果：dotfiles 113 → 163、commons 36、share 3 全數通過；lint 0 error。

- Updated dependencies [a7aaaac]
  - @ab-tao/commons@1.1.1
  - @ab-tao/share@1.0.1

## 1.15.0

### Minor Changes

- 32ded3f: 移除 iCloud 偏好同步功能 + Claude 設定 backport（個人規則 v1.15.0）

  - **移除 iCloud 同步全套**：`ab-async` / `d:prefs-sync` / `--from-icloud` / console SyncView / `sync99Local` 偏好下線；user-private 偏好改由 git-based 同步處理（見 `ab-config-sync`）。
  - **settings.template.json backport**：新增 `chrome-devtools` / `context7` / `anysearch` MCP server；補破壞性命令 deny（git `checkout --`/`clean`/`stash drop`、`terraform`/`pulumi`/`cdk destroy`、docker `compose down -v`/`system prune`/`volume rm`）；新增 `warp` plugin；`attribution.sessionUrl=false`。
  - **新增 UserPromptSubmit hook**：偵測 Jira ticket / Confluence URL / 破壞性命令關鍵字並注入相關 context（kill-switch `CLAUDE_PROMPT_ENRICH=0`）。hook defs 由 8 → 9。
  - **claude-md / docs**：新增 `/config` 快速設定章節（10-config-management）與 `Tool(param:value)` 權限語法章節（13-agent-orchestration）；local-tools 新增 anysearch 安裝指引；STRUCTURE / config-map 版號與計數校正（skills 31、hooks 9）。
  - **fix(console)**：el-text `type` 由無效值 `secondary` 改為 `info`。

## 1.14.4

### Patch Changes

- 修正 local-tools code-review-graph daemon 文檔：`daemon add` 無 `--watch-mode` 旗標（位置參數語法），移除錯誤標註（預設即監看檔案 + git 事件）

## 1.14.3

### Patch Changes

- 移除說明文件中 GitNexus 點名描述

  13-agent-orchestration / local-tools / STRUCTURE 的「取代 GitNexus」rationale 描述移除（保留語意，去點名）。剩餘 GitNexus 字樣僅存於 CHANGELOG 與 lsp-mcp-evaluation 歷史紀錄（不竄改）。

## 1.14.2

### Patch Changes

- GitNexus 100% 移除（功能性殘留全清）

  - **zsh**：移除 30-aliases.zsh 整個 GitNexus alias 區塊（25 個 gn\* alias）
  - **README**：60-tools 工具列表移除 gitnexus
  - 同步清理（非 source，本機）：~/.claude/settings.json 移除 3 個 gitnexus hook group（PreToolUse/PostToolUse/SessionStart）、刪 hook 腳本（gitnexus-sync.sh + gitnexus/ 目錄）、刪 16 專案 .gitnexus 圖譜資料（2.3GB）
  - 保留：CHANGELOG / lsp-mcp-evaluation（歷史紀錄）、「取代非商用 GitNexus」說明（rationale context）

## 1.14.1

### Patch Changes

- code-review-graph 與 Understand-Anything 改為互補定位（非取代）

  - **13-agent-orchestration**：移除「取代 Understand-Anything」，改為 audience 分工互補（Claude 查 → crg MCP ｜ 人視覺探索 → UA dashboard）
  - **local-tools**：新增「G. Understand-Anything」章節（定位對照 / 8 skills / auto-update + 成本策略 / worktree 注意）

## 1.14.0

### Minor Changes

- 說明文件全面同步：GitNexus 殘清 + code-review-graph 工具名修正 + 安裝章節

  - **README**：個人規則版號 v1.8.0 → v1.8.1
  - **13-agent-orchestration**：code-review-graph 工具名補 `_tool` 後綴規則（修 404 隱患）；修正「已卸載 Serena」不實陳述（serena 並存互補）
  - **ai-dispatcher**：7 條 `gitnexus-*` skill 映射 → code-review-graph MCP 工具（gitnexus skills 已不存在）
  - **local-tools**：新增「F. code-review-graph」安裝/daemon/embed/視覺化/排錯章節
  - 保留：STRUCTURE.md（已正確）、lsp-mcp-evaluation.md（2026-05-24 歷史評估報告，不竄改）

## 1.13.0

### Minor Changes

- PR review 工作流降噪重構 + code-review-graph MCP 接入

  - **13-agent-orchestration**：`Review 入口決策表` 重構為「PR / Code Review 工作流（降噪優先）」——新增第零段狀態偵測（已 review 偵測 + 去重）、嚴重度閘門（P2/P3 彙整單條 summary）、雙入口（PR / Slack 連結）、外發草稿先行；保留 Review 深淺分流規格
  - **settings.template.json**：mcpServers 新增 `code-review-graph` 條目（knowledge graph MCP，符號依賴 + blast radius + 業務流程）
  - 個人規則 v1.8.0 → v1.8.1

## 1.12.0

### Minor Changes

- docs(claude): 個人規則版本 v1.7.2→v1.8.0 里程碑 + 說明文件全面更新 — CLAUDE.md/config-map/STRUCTURE 版本標記統一；STRUCTURE.md 大幅同步（rules 7→9 表重寫、docs 22→28、清除廢棄 GitNexus skills/hooks、api-and-data offset 修正、commands 14→17、移除過時 config-map v1.6.1 引用）；根 CHANGELOG 補 [1.10.0] 配置整合優化條目；README 補最新版本指引

## 1.11.2

### Patch Changes

- chore(claude): 配置整合優化(3/n) — 清 GitNexus 廢棄 hook（刪 session-start-gitnexus-sync.json def + gitnexus-sync.sh script，hooks defs 9→8）；audit-checklists 自審項同步（docs 29→28、slack-principles 6→8 節、multi profile 改標為組合器非缺漏）

## 1.11.1

### Patch Changes

- refactor(claude): 配置整合優化(2/n) — 刪過時 gitnexus-integration.md（GitNexus 廢棄+無引用）；修矛盾：08 MEMORY hot index ≤10→≤15 行對齊 config-map、audit-checklists API 格式/分頁改「依專案契約」消除與 api-and-data 衝突；config-map 同步 vue-nuxt paths(+css/scss)/docs 29→28/系統參考 9→8

## 1.11.0

### Minor Changes

- refactor(claude): 配置整合優化(1/n) — always-on 規則歸屬下沉條件載入：DS token/JSDoc/響應式/三態 從 03-code-standards 移至 rules/vue-nuxt+typescript（省常駐 context）；13-agent GitNexus+Understand-Anything 改寫為 code-review-graph（單一工具涵蓋符號依賴+業務流程，移除廢棄工具引用）；api-and-data Migration 段去重引用 migrations.md

## 1.10.7

### Patch Changes

- ci(release): pnpm run release 末段自動補 git tag + GitHub Release（post-release.mjs，private package changeset tag no-op 的補償；冪等 + execFileSync 防注入）

## 1.10.6

### Patch Changes

- docs(claude): config-map / audit-checklists 同步 rules 8→9（新增 php-codeigniter.md）+ typescript paths 補 .js

## 1.10.5

### Patch Changes

- fix(claude): 08-state-system 冷啟動讀 system-patterns.md 改條件式（檔不存在則跳過，勿視為錯誤）

## 1.10.4

### Patch Changes

- feat(claude): 規則內容統一下沉 rules/ — git-and-pr 補 commit 工作流/git 操作授權/push tracking/不標對齊；typescript 補 JSDoc-as-types Object 陷阱+boolean equality 並擴 paths 含 .js；新增 php-codeigniter.md；對應 memory 瘦身

## 1.10.3

### Patch Changes

- feat(claude): 新增巢狀 sub-agent 條件式優先編排規則（13-agent-orchestration 調度規則第 5 條）

## 1.10.2

### Patch Changes

- a99129c: feat(claude): 新增復用/分層/解耦工程原則規則 + 配置一致性修復

  - 新增 `rules/reuse-and-decoupling.md`（條件載入，編輯程式碼檔時注入）：復用優先搜尋鏈、DRY 分層抽取（Rule of Three + 職責去處表）、解耦原則（單一職責 / 依賴方向單向 / 元件薄 / 面向介面 / 副作用隔離 / 最小公開面）、反向氣味清單
  - `claude-md/03-code-standards.md`：新增「復用 · 分層 · 解耦」核心原則小節（always-on 高層心智模型）；修復失效的 `rules/code-quality.md` 斷鏈指標 → 改指向實際存在的 typescript / vue-nuxt / barrel-exports / reuse-and-decoupling
  - `commands/plan.md`：回填 runtime 較新版本（含 `EXECUTE_COMMAND:` 自動派發 + Mandatory Post-Execution Hooks + Done When）
  - docs 同步：`config-map.md` rules 7→8 檔、`audit-checklists.md` 審查清單同步；個人規則版本標記統一 v1.7.2

## 1.10.1

### Patch Changes

- fix(zsh): 修復模組重複載入 — symlink 清理 + module guard

  **問題根因**：舊版架構（`zsh/.zshrc.d/conf/` 實體檔）升級為 symlink 架構後，`d:setup` 多次執行導致 `conf/` 出現 ` 2.zsh` / ` 3.zsh` 重複 symlink，各模組被 source 三次，fnm `chpwd` hook 累積三份，換目錄時出現三行 `Using Node xxx`。

  **`install.sh`**：

  - 部署前清除 `<name> [0-9].zsh` 重複 symlink（空格 + 數字命名，由舊版 `ln` 行為產生）
  - 清除非 symlink 實體檔（舊版複製遺留），確保 `ln -sf` 等冪

  **zsh modules（4 個）加 module-level guard**，防重複 source：

  - `00-env.zsh`：避免重複 `eval fnm env`（fork 子進程）
  - `10-history.zsh`：避免重複呼叫 `_update_project_history`
  - `60-tools.zsh`：避免重複 `eval zoxide init`（fork 子進程）
  - `90-plugins.zsh`：避免重複 `eval starship init`（fork 子進程）

## 1.10.0

### Minor Changes

- 93ecb15: feat: d:setup 交易化安裝 — 快照+全量回滾防配置失效

  新增 `libs/install/transaction.mjs` 交易模組，讓 d:setup 在任何 mutation 前先快照
  mutable roots（~/.claude 配置目錄、zsh 模組、settings.json 等），全部成功才 commit，
  中途 crash 或取消則自動還原至安裝前狀態。

  **核心改動**

  - `transaction.mjs`：`beginTransaction / commitTransaction / rollbackTransaction` 狀態包裝 +
    `snapshotTargets / restoreFromSnapshot / removeCreated` 純函式（可注入 targets 供測試）
  - `backup.mjs` `cpDir`：新增 `opts.skipNames`（`Set<string>`），命中 basename 整支 subtree 跳過；
    解決 `sheldon/repos/**/.git/objects` 數千小檔觸發 macOS `ETIMEDOUT` 的問題
  - `DEFAULT_TARGETS`：`~/.zshrc.d` 由整 dir 改為 per-file（`conf/` + `.prefs.zsh` + `sheldon/plugins.toml`），
    sheldon repos git cache 完全排除於快照範圍
  - `setup.mjs`：`beginTransaction()` 包 `withSpinner`，消除 UI hang；8 個接線點覆蓋
    crash / 取消 / 核心缺檔詢問 / commit 全路徑
  - 17 個單元測試（含 skipNames、per-file zshrc.d、best-effort rollback）

## 1.9.0

### Minor Changes

- feat(d:setup): preferences 持久化系統 + BACK Symbol 全鏈路修補

  **preferences-store（新模組）**

  - 新增 `libs/core/preferences-store.mjs`：`~/.claude/.ab-tao/preferences.json` 永久偏好存儲
  - 支援 17 個 promptId，覆蓋 9 個接線檔（scan / features / zsh / plugins / claude-base / repos / project-install / slack / tech-select）
  - 原子寫入（tmp→rename）+ 獨立 preferences.lock 防並發損壞
  - `prefsRead / prefsWrite / prefsPatch / prefsGet / prefsRecordChoice / prefsReset / prefsMigrateFromSession`
  - 隱私聲明：含 Slack Channel ID + 私有 repo 名稱，user-private，不參與 iCloud 同步

  **BACK Symbol 全鏈路修補**

  - `libs/pipeline/tech-select-ui.mjs`：補 BACK import + 2 處 BACK 短路（首輪審查遺漏的接線檔）
  - `libs/phases/phase-adjust.mjs`：`adjustGlobalSettings` 補 `if (slackEnv === BACK) return`
  - `libs/features/claude-base.mjs`：`configure` 補 `if (slackEnv === BACK) return BACK`
  - 確保 ESC 不因 try/catch 靜默吞噬或 truthy 比較推進錯誤分支

  **測試基礎建設**

  - 新增 `__tests__/preferences-store.test.mjs`（7 個測試）
  - 新增 `__tests__/prompts-wrappers.test.mjs`（4 個 wrapper × 多情境）
  - 12 個既有測試檔：`from 'vitest'` → `from 'node:test'`（零修改通過）
  - `rules-whitelist.test.mjs` whitelist 更新為 7 個規則檔（含 barrel-exports）

  **文件同步**

  - `claude/docs/config-map.md`：.ab-tao/ 樹狀圖補 preferences.json + preferences.lock（⚠️ user-private）
  - `docs/sync-setup.md`：.chezmoiignore 補隱私說明，注意事項補 preferences.json 禁止 sync 規則
  - `libs/core/preferences-store.mjs` / `libs/external/ab-async.mjs`：頭部文件完整化

## 1.7.2

### Patch Changes

- feat(zsh): gitnexus aliases 搬移至 30-aliases.zsh 並補齊全套指令

  - 將 gitnexus alias 從 `60-tools.zsh` 搬至語義正確的 `30-aliases.zsh`
  - 原有 6 個 alias 擴充為 23 個，覆蓋所有 gitnexus CLI 指令
  - 新增：`gnidx` `gnrm` `gndr` `gnui` `gnmcp` `gnq` `gnctx` `gnimp` `gncy` `gndc` `gnpub` `gngrp` `gngrpl` `gngrps` `gngrpi` `gngrpq` `gnsetup`

## 1.6.0

### Minor Changes

- feat: v1.6.0 Greenfield Release — AI Dispatcher、Chain Commands、Federated Memory

  **M1 Foundation**

  - commons-loader 讀 `_ab-tao-paths.json` manifest，動態解析各 source 安裝路徑
  - `P.abTao` 子目錄命名空間正式化（runtime/memory/corrections/metrics/logs/schemas）
  - 殘留清理：deprecated skill dirs、plugin 重分類（6 → 4 enabled，2 改 on-demand）

  **M2 Core Features**

  - 9 source `SOURCES_CONFIG` 加入 `curatedResources` 精選清單 + `installMode`（copy/plugin）欄位
  - 5 個新 CLI：`d:profile` / `c:plugin` / `c:metrics` / `c:memory` / `c:skills:curated`
  - `state.json` 加入 4 個 sub-schema：federated / failurePatterns / intentCache / metricsSnapshot
  - `FEATURE_REGISTRY` + `d:uninstall --feature` 精細移除
  - `settings.json._abTao` 區段（voiceTrigger / costRouting / tddStrictMode / securityMode）

  **M3 AI Dispatcher & Chain Commands**

  - `/ai` rule-based dispatcher — 39 條 intent 映射，自動路由到對應命令 / agent
  - `/chain-product` / `/chain-tdd` Chain commands
  - Federated memory CLI 三件套
  - Console 17 view scaffold + 8 SSE channel（即時推送）
  - M3.6：session-end failure-collect hook、voice-trigger hook、cost-aware routing hook

  **Bug Fixes（AI sources sync）**

  - `ai-source-select` needSync 改用 .versions.json sha 判斷，spinner 顯示真實計數
  - `sync-sources` 移除 skills-mp，git clone 錯誤改串接 stderr
  - 新增 `source-meta.mjs` 集中管理 icon/label map（消除三處重複）
  - `prune-orphans` KNOWN_SOURCES 改從 SOURCES_CONFIG 自動派生

### Patch Changes

- Updated dependencies
  - @ab-tao/commons@1.1.0
- feat(claude/rules): `claude-md/04-verification.md` 新增 Figma MCP 規格擷取強制規則 — 禁止單靠 `get_screenshot` 實作；`get_design_context` 為主要工具

## 1.5.0

### Minor Changes

- feat(dotfiles): ccline → claude-hud 遷移 + 互動選單 UX 改進

  - 移除 CCometixLine（ccline）整合，改為 claude-hud plugin
  - 新增 claude-hud wrapper 腳本與配置（config.json、hud-wrapper.sh）
  - CLAUDE.md 安裝預設由 keep 改為 install
  - 所有互動選單 hint 欄位合併至 label（選擇前即可見完整說明）
  - 選項標題與說明之間的 「—」分隔符改為單一空格

### Patch Changes

- Updated dependencies
  - @ab-tao/commons@1.0.3

## 1.4.0

### Minor Changes

- v1.4.0 — Slack 規範庫符號學化重構 + Icon 體系強化

  ### Breaking Changes

  - **`slack-templates.md` 廢棄並改名為 `slack-principles.md`**：15 個硬編碼場景模板（T01~T15）全部移除，改為符號學式規範（Slack 語法紅線 + Icon 語義字典 + 4 層骨架），讓 Claude 自主組裝而非填空。若有外部工具硬編碼 `slack-templates.md` 路徑，需同步更新至 `slack-principles.md`。

  ### 新增

  - `slack-principles.md` Section 7 **視覺節奏**：`>` quote 與 code block 使用時機、5 層視覺強度層次、排版節奏硬規則
  - `slack-principles.md` Section 8 **場景 Icon 快查**：4 大類 11 個場景的 icon 組合起點（事件管理 / 開發日常 / 進度管理 / 架構與決策）
  - Icon 語義字典擴充 16 → 29 個（新增 🔍 ⚡ 🔐 📦 🗂️ 🏷️ ✨ 🧹 🌐 💥 🔑 📉 等）
  - 4 層骨架各層標題加對應 icon（📌 💡 📊 🔧）
  - Icon 使用密度原則：目標每條訊息 5-10 個 icon，明確首行 / 層標題 / 關鍵 bullet 三級規則

  ### 變更

  - `slack-audience-profiles.md` 重寫 v2.0.0：廢除 7 張「完全保留 / 壓縮 / 移除」表格，改為 reader mental model + 3 條決策原則，讓 Claude 自主判斷
  - `commands/slack.md` A2 / A2.5 指引更新（載入規範庫 → 自主組裝）
  - `audit-checklists.md` + `config-map.md` 同步更新

  ### 部署

  ```bash
  pnpm run d:setup
  ```

## 1.3.2

### Patch Changes

- Worklog 半自動化（draft + confirm + MCP submit）

  - SessionEnd hook 自動抓 session metadata 寫入 worklog-drafts.jsonl（≥60s session、解析 branch→ticketKey、收集 commits）
  - Console 新增 Worklog Drafts tab：列表 / 編輯 / 批次略過
  - `/worklog` slash command：per-draft [d]/[m]/[c:]/[t:]/[n]/[x] 確認 → MCP 批次提交至 Jira
  - `libs/core/worklog.mjs` 新增：JSONL reader/writer（readDrafts / dismissDrafts / updateDraft）
  - `paths.mjs` 新增 sessionState、worklogDrafts 兩個路徑 entry

## 1.3.1

### Patch Changes

- v1.3.1 — Slack 區塊化輸出 + 結構強化 + Description 深化

  ### 新增

  - Multi-audience 區塊化輸出：指定 ≥2 audience → 自動拼裝為單一訊息（每區塊各一 audience + 統一 TL;DR）
  - `ued` audience profile：UI/UX Designer 專用視角（UI 表現、fallback 設計、設計時程）
  - 統一發送目標確認：所有訊息呈現 [d]/[m]/[c:]/[t:] 4 選一，無預設
  - 結論先行強制：所有模板首行必為「結論行」+ status icon
  - 4 層通用結構：結論 → 原因 → 表現 → 方案
  - Icon Palette：嚴重度 / 狀態 / audience / 動作統一 icon
  - 8 強制規則 section（結論先行 / 4 層 / 區塊分隔 / 強調 / Icon / Mention / URL / 長度）
  - 5 個新場景模板（design review、tech debt、cross-team、dependency change、multi-audience incident）
  - 場景關鍵字 → 模板 ID 對照表（A1 場景判斷強制查）
  - Anti-Patterns section（常見錯誤示範）

  ### 變更

  - 移除 `exec` audience（使用者組織不存在）
  - Channel 推斷從「自動套用」降為「提示確認」（顯式 audience 永遠優先）
  - Audience-first 識別：context 推斷 > channel hint

  ### Description 深化

  - root `package.json` description 更新（提及 Slack / Hooks / Skills / AI 資源）
  - `apps/dotfiles/package.json` description 更新（提及 Slack audience 區塊化）
  - `packages/share/package.json` description 補完
  - `CLAUDE.md` 新增「v1.3.x 智能能力」section

  ### 部署

  ```bash
  pnpm run d:setup
  ```

## 1.3.0

### Minor Changes

- v1.3.0 — Slack audience-aware 輸出 + claude-md 精簡 + Slack 全鏈路加固

  新增：

  - Slack audience-aware 輸出：根據對象（rd / pm / mkt / qa / ops / exec / mixed）動態調整訊息詳細度、用詞、強調點
  - Slack 自主判斷四維度：audience / channel / type / thread_ts 自動推斷 + 信心分級（high/medium/low）
  - Thread reply 自動識別：使用者貼 Slack permalink → 自動切 thread reply 模式
  - 新增 `docs/slack-audience-profiles.md`（7 profile + channel mapping + Channel ID 前綴對照）
  - 新增 `claude-md/15-self-correction.md`（8 條自我糾正規則）
  - commands/slack.md Step A1.5（4 維度識別）+ A2.5（套用 profile）+ A4.0（信心閘門）+ 升級 A4.2 UI
  - docs/slack-templates.md 25 個模板各加 audience 變體 footer

  修改：

  - claude-md 03/07/09/10/13 精簡（去除冗餘，保留核心紅線）
  - 04-verification：新增「何時不需要 web search」
  - 05-security：新增 bypassPermissions 風險揭露
  - commands/slack.md：廢棄 ab-slack，新命名 v4.0.0 + Step A2 強制 Read
  - docs/audit-checklists.md：補全 Slack / docs / claude-md 16 個 section 等檢查項；4 → 5 個 docs；G+H 系列 audience 檢查項
  - docs/config-map.md：更新至 v1.3.0 結構
  - scripts/build-claude-dev-plugin.sh：新增 docs/\* glob 部署
  - mcp.yml：新增 @modelcontextprotocol/server-slack

  移除：

  - docs/pua-opt-in.md（Pua plugin 殘留）
  - docs/project-tags.md（Pua 殘留）

## 1.2.1

### Patch Changes

- 4f94926: **v1.2.1 — 3 個 HIGH 問題修復**

  ### 修復

  - **state.mjs lock silent write**：`stateWrite` 在鎖逾時（`_lockGloballyFailed`）時現在正確跳過寫入，避免多 session 競態（先前 fast-fail flag 有設但寫入路徑沒檢查）
  - **docs-freshness 測試誤報**：移除將 `d:doctor` 標記為過時命令的黑名單條目（d:doctor 已是 v1.2.0 正式命令）
  - **agents/ 補 ab- prefix**：`architect.md` → `ab-architect.md`、`debugger.md` → `ab-debugger.md`，兌現 v1.2.0 release notes「all ab-tao resources standardized with ab- prefix」承諾；同步更新 `13-agent-routing.md`、`14-dag-parallel-execution.md`、`config-map.md`、`config-classifier.mjs`、`auto-plan.mjs`

  ### 升級提示

  安裝 v1.2.1 後需手動清除舊 agent 檔案，否則 `~/.claude/agents/` 會同時存在舊版（`architect.md`、`debugger.md`）與新版：

  ```bash
  rm -f ~/.claude/agents/architect.md ~/.claude/agents/debugger.md
  pnpm run d:setup
  ```

## 1.2.0

### Minor Changes

- v1.2.0：Setup UX 全面修復 + Doctor CLI + Memory Index

  **Setup 互動流程修復**

  - Slack 通知設定移至 configure() 階段，在 spinner 啟動前完成詢問，修復 UX 倒序問題
  - 移除 Slack User ID 配置（DM 發送改由 Slack MCP 自動獲取使用者）
  - 修復 d:setup lock spam（80+ 鎖逾時警告）：updateStateJson 改批次寫入 + fast-fail flag
  - 修復 d:doctor 未在 root package.json 註冊（ERR_PNPM_NO_SCRIPT）
  - 修復 pua plugin 安裝名稱錯誤（marketplace: pua vs installName: pua-skills）

  **Doctor CLI**

  - `pnpm run d:doctor`：ghost entries / drift SHA / dead sync paths 診斷
  - `--fix` 旗標：自動清除 state.json ghost 條目與失效 sync 路徑

  **Memory Index**

  - memory-index.mjs 部署至 ~/.claude/.ab-tao/bin/
  - SessionStart hook 自動重建 MEMORY.md 索引

  **Plan 歸位**

  - SessionEnd hook 自動將 plan 依 frontmatter ticket/topic 歸位至正確路徑

  **資源命名標準化**

  - 所有 ab-tao 自管資源統一加上 ab- 前綴（commands/agents/rules/skills）
  - ab-slack command：分離模板庫至 slack-templates.md + 強制發送確認流程

### Patch Changes

- Updated dependencies
  - @ab-tao/commons@1.0.2

## 1.1.0

### Minor Changes

- 73bb9e6: ab-async 升級（E1-E4）：iCloud 雙向同步新增安全驗證、支援 `setup:from-icloud` 指令、preferences 偏好同步優化、`sync:push/pull/status` 子指令補齊
- v1.1.0：Console 全方位升級 + Dotfiles Hotfix

  ## @ab-tao/console — 重大功能升級

  **Batch A（資料層修復）**

  - Resources 來源 source-classifier 分類（ab-tao/ecc/anthropic/custom）
  - MCP 多源整合（servers + plugins）
  - settings.mjs hooks/permissions/settings PATCH/PUT 端點
  - ai-usage API（metrics.jsonl）

  **Batch B（IA 重整）**

  - 21 路由整合為 6 大區（Dashboard/Resources/Integrations/Configuration/Actions/About）
  - SectionTabs 組件統一 tab 切換 + URL ?tab= 深鏈
  - ConsoleLayout flat sidebar 6 項

  **Batch C（深度功能）**

  - ReposView role 分組折疊（main/temp/archived）
  - 所有圖表規範化：320px + autoresize + 四態（loading/error/empty/data）
  - 新增 AiUsageMultiBar / RepoTechStackHeatmap / HooksHealthRadar / McpServerTimeline
  - Actions dry-run toggle + retry 狀態機 + traceId

  **Bug Fixes**

  - /api/repos 資料源修正（改讀 last-report-data.json）
  - MemoryView 新增全局+專案聚合統計列
  - biome auto-fix 誤 rename template 綁定變數修復

  ## @ab-tao/dotfiles — Hotfix

  **F-1**：Slack 訊息傳送強制確認規則（05-security.md）
  **F-2+F-3**：permissions.allow preserve / deny union 非對稱策略，移除 extraKnownMarketplaces
  **F-4**：ccline 偵測改用 pnpm list -g，修復 chmod idempotency
  **F-5**：d:setup 後配置 drift 寫 marker，由 SessionStart hook 一次性消費
  **E-4**：SetupWizard dark mode / 響應式 / 節點 id 衝突修復
  **E-6**：d:setup 啟動時寫 state.lock + exit 清理
  **D（Batch D）**：\_abTao 加入 preserve-policy 白名單

- 73bb9e6: 修復 source-sync.mjs 覆寫 hooks.json 導致 ab-tao hook 全部失效的根本原因；修復 hook-handler.sh 佇列競態、install-claude.sh manifest python3 依賴、uninstall.mjs 刪除非 ab-tao hooks 等 P0 安全問題

### Patch Changes

- 2c8440d: 移除 phase-complete 的 mempalace 偵測與安裝邏輯，ENHANCERS 只保留 RTK
- Updated dependencies [2c8440d]
  - @ab-tao/commons@1.0.1
