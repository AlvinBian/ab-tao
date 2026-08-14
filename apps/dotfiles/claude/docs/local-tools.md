# 本地工具安裝指引

本機需手動安裝的外部服務與工具。
各服務狀態可透過 `pnpm run c:locals --status` 查看。

## A. codebase-memory-mcp — 代碼智能一把抓（語義 + 結構圖，取代 CodeRAG + crg + serena）

`DeusData/codebase-memory-mcp`（26.4k★，MIT，arXiv:2603.27277）。**單一 node 套件、零重依賴**（內建 nomic-embed-code 向量，無 PyTorch/Docker/雲 API），一個工具同時提供**語義搜尋 + 完整依賴圖 + blast-radius + 複雜度 + route 追蹤**，158 語言。

### 為何取代三個工具（本 repo 實測背書）
| 舊工具 | 職責 | codebase-memory 對應 |
|---|---|---|
| CodeRAG | 語義搜尋 | `search_graph`（**符號級**，勝過 CodeRAG 的 window 級）|
| code-review-graph | 結構圖/blast-radius | `query_graph` / `get_architecture` / `trace_path` + CALLS/IMPORTS 邊 |
| serena | LSP 找 caller | Hybrid LSP 型別解析 + CALLS 邊 ⚠️（安全 rename 不含）|

實測（ab-tao/apps/dotfiles ~360 檔）：索引 **2s**（vs CodeRAG 450s / mvs 88s）、查詢 **0s**、5737 nodes/8360 edges + 795 function 向量、JS/.mjs 零 parse 錯。

### 安裝 + MCP（每台機）
```bash
npm install -g codebase-memory-mcp     # 或 curl 官方 installer / go install
# MCP 已入 .claude.json user scope（穩定路徑 = fnm default node bin,避 multishell 臨時路徑）
claude mcp add codebase-memory-mcp -s user -- "$(npm root -g)/../bin/codebase-memory-mcp"
```
⚠️ **fnm 陷阱**：`command -v` 可能回 `fnm_multishells/…` 臨時路徑，新 session 失效 → MCP command 必須指 **fnm default node 的穩定 bin**（`~/.local/share/fnm/node-versions/<default>/installation/bin/`）。

### 用法
- **MCP（Claude 自動用）**：問「語義搜尋 X」→ `search_graph`；「改 X 影響什麼」→ `query_graph`/`detect_changes`（blast-radius）；「架構總覽」→ `get_architecture`
- **CLI**：`codebase-memory-mcp cli index_repository '{"repo_path":"<repo>"}'` 建索引（每 repo 首次，或 `config set auto_index true`）
- 14 工具 · 索引存各 repo `.mcprules`/內部 · 多專案用 project 名區隔

> 三範式分工終結：**codebase-memory=語義+結構一把抓** ｜ ripgrep=文字/正則 ｜ chrome-devtools=前端 debug + 量測（互動 / console / network / Lighthouse / CWV / performance trace / heap snapshot，見下方 B）。claude-context / CodeRAG / mcp-vector-search / code-review-graph / serena **皆已退役**（實測對比見 git 歷史）。


## B. 瀏覽器調試

**目標瀏覽器一律 Google Chrome**（2026-08-04 拍板）。預設 chrome-devtools MCP（互動 / console / network / 量測全包）；需要「以本人身分」操作真實登入帳號才退回 claude-in-chrome；本專案 dev server 預覽走 Browser pane。三選一決策樹見 `skills/browser-automation-router/SKILL.md`。

### 非 Chrome 瀏覽器（Tabbit 等）— 已完全退出（2026-08-04）

- **決策**：瀏覽器調試不再涉入任何非 Chrome 瀏覽器。原 `tabbit-browser` MCP（第三方 `southportns/tabbit-browser`）已從 `.claude.json` 移除註冊，其安裝目錄（曾位於 `tools/` 下）也已刪除，含本地未推上游的 macOS launch patch。
  > 註：此處刻意不寫出完整的 `~/.claude/...` 路徑——config-lint R2 會把它當成「引用了不存在的路徑」而誤報。退場記錄描述的是已刪除的東西，不是活引用。
- **為什麼**：維護單一瀏覽器的專用 MCP + profile 複製方案（登入態快照、Keychain 解密、獨立 user-data-dir）成本高於價值，且 Tabbit 封鎖 `chrome://` 命名空間導致 autoConnect 這類官方省事路徑都不適用。統一 Chrome 後路由從四選一收斂為三選一。
- **若日後需要重建**：上游 repo 尚在（`southportns/tabbit-browser`，唯一依賴 ws），但 macOS launch 的平台判斷 + 獨立 `--user-data-dir` patch 需重做——先確認需求真實存在再評估，不預先復原。
- **claude-in-chrome 本來就只認 Google Chrome**：CLI 瀏覽器偵測硬編碼（chrome/brave/arc/edge/chromium/vivaldi/opera），非 Chrome 瀏覽器即使裝了 extension + NativeMessagingHosts manifest 也接不上——這是它的設計，不是缺陷。

## C. claude-trace（Token 歸因觀測）

觀測每個 tool call 的 token 消耗，揭露哪個 Bash / Read 最貴。

```bash
npm install -g @vexor/claude-trace
# 基本使用（讀 ~/.claude/projects/*.jsonl）：
claude-trace --tools       # per-tool token 歸因
claude-trace --reads       # 最貴的 Read 呼叫
claude-trace --reflect     # 推薦 CLAUDE.md 優化建議
```

搭配 `CLAUDE_CODE_ENABLE_TELEMETRY=1`（已加入 settings.template.json）可啟用 1h prompt cache TTL。

## D. Awesome-AI-Pedia（AI 知識庫）

透過 `c:ai-sync --source awesome-ai-pedia` 自動同步，不需手動操作。
同步後內容在 `~/.ab-tao/external/awesome-ai-pedia/`。

```bash
pnpm run c:ai-sync --source awesome-ai-pedia
# 同步後搜尋：
# skills/awesome-ai-search/SKILL.md 提供 grep-based 查詢
```

> **更新提示**：d:doctor 會檢查 awesome-ai-pedia 最後更新時間，超過 30 天會警告。
> 多台機器各自執行 c:ai-sync 以取得最新版本。

## E. ~~Serena LSP MCP~~（已退役 → 見 §A codebase-memory-mcp）

serena（LSP symbol search / find-callers）已於 2026-07 退役,其找 caller/references 能力併入 **codebase-memory-mcp**（§A,CALLS/IMPORTS 邊 + Hybrid LSP 型別解析）。⚠️ 唯一未覆蓋:**LSP 安全 rename**（willRenameFiles）—— 需 rename 改用 IDE。

## F. ~~code-review-graph~~（已退役 → 見 §A codebase-memory-mcp）

crg（結構知識圖譜）已於 2026-07 退役,其能力（依賴圖 / blast-radius / 業務流程）併入 **codebase-memory-mcp**（§A,一個工具兼語義+結構,更快更輕）。daemon / launchd / 各 repo `.code-review-graph` graph DB 已全清。

## G. Understand-Anything（業務流程視覺化 dashboard，互補 codebase-memory-mcp）

Claude Code plugin（MIT，[Lum1104/Understand-Anything](https://github.com/Lum1104/Understand-Anything)，已裝 v2.7.5），把 codebase 變互動知識圖譜 + React dashboard，主打**業務流程可視化**與**新人導覽**。與 codebase-memory-mcp **互補非取代**。

### 定位：按 audience 分工（與 codebase-memory-mcp 零冗餘）
| | codebase-memory-mcp | Understand-Anything |
|---|---|---|
| 給誰 | **Claude**（MCP 查依賴 / blast radius）| **人**（dashboard 視覺探索）|
| 介面 | MCP 工具 `*_tool` | React dashboard（domain view / tour）|
| 儲存 | codebase-memory 內部 graph+向量 | `.understand-anything/knowledge-graph.json` |
| auto-update | daemon（免費背景，檔案+git 自動）| commit hook → Claude 增量（fingerprint，**耗 token**）|

> 口訣：**Claude 要查 → codebase-memory ｜ 你要看 → UA**。

### 命令（8 skills）
- `/understand` — 建知識圖譜（`--auto-update` 開 commit 自動更新；`--language zh-TW` 中文）
- `/understand-domain` — 抽業務領域（domains / flows / steps）
- `/understand-chat "How does X flow work?"` — 自然語言問流程
- `/understand-dashboard` — 開互動 dashboard
- `/understand-diff` — 改動影響 ｜ `/understand-explain` — 深入檔案 ｜ `/understand-onboard` — 新人導覽

### 啟用 auto-update（選定專案，注意成本）
```bash
cd <repo>
# Claude 說：/understand --auto-update --language zh-TW
# → 建 .understand-anything/knowledge-graph.json + autoUpdate:true
# → 之後 git commit 自動增量更新（plugin hooks.json PostToolUse 偵測 commit）
```

### ⚠️ 成本策略
UA auto-update 跑 LLM agents 做語義分析，**結構變更時花 token**（cosmetic 改動 fingerprint 偵測零成本）。建議：**只在常做 onboarding / 需視覺探索的專案開 `--auto-update`**（如 member-ci）；其他專案要看時手動 `/understand`。codebase-memory 則各 repo 首次 `cli index_repository`（2s，本地）。

### worktree 注意
PROJECT_ROOT 在 git worktree 時，UA 自動把輸出重導向主 repo root（worktree 是臨時的，`.understand-anything/` 寫那會隨 session 銷毀）。

## H. anysearch MCP（web 搜尋，token 走 env 不入 settings）

`settings.template.json` 的 anysearch MCP 用 `"Authorization": "Bearer ${ANYSEARCH_TOKEN}"`，**token 不寫進任何 settings*.json**（避免明文同步）。每台機器須自行提供 `ANYSEARCH_TOKEN`：

```bash
# ~/.zshrc.local（machine-local，~/.zshrc 末行自動 source，不同步）
export ANYSEARCH_TOKEN="as_sk_xxxxxxxx"
chmod 600 ~/.zshrc.local
```

⚠️ **注意事項**：
- CC 對 `settings.json`（非 `.mcp.json`）header 的 `${VAR}` 展開官方未明文保證（GH issue #4276）；改完**完全重啟 CC** → `/mcp` 確認 anysearch `Connected`。連不上先 `echo ${#ANYSEARCH_TOKEN}` 確認 shell 有 export。
- **從 GUI（Spotlight/Dock）啟動 CC 不會 source `~/.zshrc`** → 變數缺失 → anysearch 斷。請從 terminal 啟動，或將 export 改放 `launchctl setenv` / `~/.zprofile`。
- 變數未設時 CC 不降級回明文，直接連線失敗（parse error / 401）。

## I. cc-connect（Claude Code ↔ 微信遠端遙控，配對 Notification hook）

你的 fork（`AlvinBian/cc-connect`，原作 `chenhg5/cc-connect`）。把 CC session 綁到微信（或其他平台），**手機遠端查看/回覆 agent**。與 `Notification` hook 天作之合：hook 推「agent 待輸入/完成」→ 微信收到 → 手機直接遙控回覆。

```bash
brew install cc-connect          # 已裝於 /opt/homebrew/bin/cc-connect
cc-connect weixin setup          # 掃碼連微信（或選其他平台）
cc-connect daemon install        # 背景常駐
```

> 多機各自 `brew install cc-connect` + `weixin setup`（綁定不跨機同步）。與 `hooks/hook-handler.sh` 的 `Notification`（`agent_needs_input`/`agent_completed`）互補：桌面走 macOS 通知，遠端走 cc-connect。

## J. beads（bd）— agent 跨 session 任務依賴圖記憶

`steveyegge/beads`（Go 單檔，git-backed 4D graph issue tracker），解 agent「50 First Dates」失憶。補 ralph-loop / 多 agent **長任務跨 session** 缺口；與你的 markdown 三溫層記憶**互補**（beads=任務依賴圖 + 語意 memory decay 壓縮；memory=決策/偏好/踩坑）。

```bash
brew install beads               # 已裝 bd 1.0.5
bd init                          # 於 repo 初始化（產生 git-backed 資料）
bd create "任務描述"             # agent 可 JSON 輸出、依賴追蹤、auto-ready 偵測
```

> 圖資料隨 git 走，跨機/多 branch 用 hash-based ID（`bd-a1b2`）防合併衝突。與 codebase-memory-mcp（語義+結構）、memory（決策）三者不重疊：beads=**任務**層。

## K. ccusage — 成本 / burn rate 分析（因應 2026-03 rate-limit 收緊）

`ryoppippi/ccusage`（~16.1k★），讀本地 `~/.claude/projects/*.jsonl` 算跨 session 成本、燃燒率、活躍 block 剩餘時間。與 `claude-trace`（per-tool token 歸因，即時）**互補**：ccusage=歷史成本 + statusline。

```bash
npm install -g ccusage           # 已裝 20.0.14；或免裝 npx ccusage
ccusage                          # 每日成本彙總
ccusage blocks --live            # 即時 block 燃燒率
ccusage statusline               # 可掛 statusLine / claude-hud
```

> ⚠️ 本地 JSONL 估算為近似（guessed limits）；精確用量以 OAuth API 回傳的 utilization% 為準。多機各自本地統計。

## L. agnix — AI 配置檔 linter（SKILL.md / CLAUDE.md / hooks / MCP / agents）

`agent-sh/agnix`（作者 avifenesh）。ESLint 配錯會尖叫，SKILL.md 配錯鴉雀無聲 → agnix 把「啞巴 bug」變可見診斷。432 條規則含 **53 條 CC 專屬**，驗 CLAUDE.md / SKILL.md / AGENTS.md / `.mdc` / MCP / hooks / agents / settings.json。零安裝 `npx agnix`。

```bash
# ⚠️ 必須 scoped 到 authored source，否則噪音爆炸（archive/plugins/CC 合法欄位）
cd apps/dotfiles/claude && npx -y agnix .    # 只掃 ab-tao 你自己寫的配置
npx -y agnix --fix-safe .                      # 自動修可安全修的（frontmatter/引號/斷鏈）
```

**實測抓到的真 bug 類型**（本 repo 已修）：SKILL.md 缺 YAML frontmatter、`description:` 含未跳脫冒號致 YAML 無效、危險 skill 未設 `disable-model-invocation`、斷掉的 markdown 連結 / `@import`。

⚠️ **已知誤報（別當銀彈，單人專案）**：
- 自訂語義 XML 標籤（如 `<slack_format_rules>`）被當未閉合 XML
- command 的 `<feature-name>` / `<intent>` 佔位符被當 XML
- `model` / `version` / `user-invocable` 等 **CC 合法欄位**被報 info（非通用 Agent Skills 規範）
- **掃描範圍**：務必排除 `~/.claude/plugins/`（第三方）與 `.skills-archived-*/`（歸檔）；只對 `apps/dotfiles/claude/` 有意義。

> 定位：pre-commit / quality-gate 的**配置 lint**層，與 `c:validate`（結構驗證）互補。掛法見 `commands/check.md` 的 config-lint gate。
