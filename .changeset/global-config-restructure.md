---
"@ab-tao/dotfiles": minor
---

全域配置重整：同步閉環修復 + 死配置清除 + 常駐瘦身

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
