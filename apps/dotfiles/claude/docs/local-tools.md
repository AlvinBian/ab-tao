# 本地工具安裝指引

本機需手動安裝的外部服務與工具。
各服務狀態可透過 `pnpm run c:locals --status` 查看。

## A. CodeRAG — 本地語義/向量代碼搜尋（取代已退役的 claude-context）

`Neverdecel/CodeRAG`（231★）。本地優先、zero-key 的語義代碼搜尋，**無 Docker / 無 Milvus / 無 PyTorch / 無雲 API**（fastembed ONNX + Lance 嵌入式向量庫，全 in-process）。取代原 LMStudio+Milvus 那套 ~14GB 重方案。

### 安裝（一次）
```bash
brew install pipx   # 若無
pipx install "coderag[mcp] @ git+https://github.com/Neverdecel/CodeRAG"
```
MCP 已寫入 `settings.template.json` mcpServers（`coderag mcp --watched-dir ${PWD}`，cwd 動態，仿 serena/crg）→ `d:setup` 自動同步；重啟 CC 後 `/mcp` 見 coderag。

### 用法
- **MCP（Claude 自動用）**：session 內問「語義搜尋 X」→ 走 coderag MCP，回 file:line + 相似度
- **CLI**：`coderag index --watched-dir <repo>`（首次建索引）｜`coderag search "query" --watched-dir <repo>`｜`coderag watch <repo>`（即時增量）
- 索引存 `<repo>/.coderag/`（**記得加進 .gitignore**）；增量靠 content-hash + mtime 跳過未改檔

### 能力與 caveat
- Embedding：`BAAI/bge-small-en-v1.5`（本地 ONNX，首次下 ~130MB，CPU 即可，無 GPU）
- symbol-aware chunking：**TS/TSX/JS/Go/Rust/Java 符號級** ✅；⚠️ **Vue / PHP 退化為 line-window**（仍可用，粒度較粗）
- hybrid BM25 + 向量 → 補通用 embedder 在代碼精確 identifier 上的弱點
- 隱私：全本地，KKday 私有碼**不出機**（勝過 claude-context 的雲 embedding 選項）

> **三範式分工（claude-context 退役後）**：**serena**=LSP 精準符號/rename ｜ **code-review-graph**=依賴圖/blast-radius/業務流 ｜ **CodeRAG**=語義「按意思找代碼」。多機各自 `pipx install` + 首次 `coderag index`。

## B. browser-harness（瀏覽器自動化，預設啟用）

### 前置需求
- Python 3.11+：`python3 --version`
- uv（Python 套件管理，比 pip 快 10-100x）

### 1. 安裝 uv

```bash
brew install uv
```

### 2. 建立 browser-harness venv

```bash
mkdir -p ~/.ab-tao/browser-harness
cd ~/.ab-tao/browser-harness
uv venv .venv --python 3.11
source .venv/bin/activate
pip install browser-use playwright
playwright install chromium   # ~300MB，只需安裝一次
```

### 3. Chrome 隔離（避免與 chrome-devtools MCP 衝突）

browser-harness 使用獨立 Chrome profile，不會干擾正常 Chrome 或 chrome-devtools MCP：

```bash
# browser-harness 啟動時自動帶入以下 args
# --user-data-dir=$HOME/.ab-tao/browser-harness/profile
# CDP port 隨機（不固定 9222）
```

### 4. 何時用 browser-harness vs chrome-devtools MCP

→ 詳見 `skills/browser-automation-router/SKILL.md`

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

## E. Serena LSP MCP（Symbol-level 搜尋，取代 grep+Read）

Serena 透過 LSP（Language Server Protocol）提供 symbol-level 搜尋，可大幅削減 grep+Read 組合的 token 消耗（大 repo 預期 50-99%）。

**資料依據**：單一 KKday session 實測 grep 362 次 + Read 511 次 = 884 次 search/read 呼叫，正是 Serena 的目標取代場景。

### 前置需求

- uv（已隨 brew install uv 安裝，d:setup 前置步驟）
- 至少一個語言的 LSP server（按需安裝，不需全部）

### 1. 安裝語言 LSP server（按專案語言安裝）

```bash
# TypeScript / JavaScript（KKday 主要語言）
npm i -g typescript-language-server typescript

# Vue（Nuxt 3 / Vue 3 專案）
npm i -g @vue/language-server

# Python（選擇性）
pip install python-lsp-server
```

### 2. MCP server 透過 d:setup 自動寫入

`settings.template.json` 已加入 `serena` MCP 條目。執行 `pnpm run d:setup` 後，serena 會自動寫入 `~/.claude/settings.json`。

無需手動安裝 serena package — `uvx` 會在首次呼叫時自動 fetch。

### 3. 驗證

```bash
# 開新 KKday session 後，問：
# 「找 useOrderDetail 這個 composable 的所有呼叫點」
# 預期：Claude 走 Serena symbol search，非 grep + Read 組合
```

### 4. 使用方式

Serena 在新 session 自動生效。主要能力：

| 任務 | Serena tool | 替代 |
|---|---|---|
| 找 symbol 定義 | `find_symbol` | grep + Read 多個檔 |
| 找所有 caller | `find_referencing_symbols` | grep -r + Read |
| 重命名安全性確認 | `find_referencing_symbols` | 手動搜尋 |
| 探索 class 成員 | `find_symbol` | Read + 手動解析 |

### 5. 每個 session 需指定 project root

Serena 需知道 project 路徑。d:setup 使用 `${PWD}` 作為動態值；若在多個 repo 間切換，重啟 Claude Code 時 Serena 會自動偵測當前 cwd。

### 6. 排錯

**Serena 未回應** → 確認 `uvx` 存在：`which uvx`；首次執行需 fetch（~30s）

**LSP 報錯** → 確認對應 language server 已全局安裝：`which typescript-language-server`

**symbol 找不到** → Serena 依賴 LSP index 建立，新開 session 後等 ~10-30s LSP warmup

## F. code-review-graph（知識圖譜 MCP，符號依賴 + blast radius + 業務流程）

持久增量知識圖譜（MIT，SQLite，支援 PHP / Vue / TS / JS 等 30+ 語言），透過 MCP 暴露 30 個工具，涵蓋符號級依賴、blast radius、業務流程可視化。與 serena（LSP）、claude-context（向量）三範式互補。

### 前置需求
- Python 3.11+
- CLI：`~/.local/bin/code-review-graph`（v3.4.0）；首次 `pip install code-review-graph`

### 1. MCP server（已寫入 settings.template.json）
```json
"code-review-graph": {
  "command": "${HOME}/.local/bin/code-review-graph",
  "args": ["mcp", "--repo", "${PWD}"]
}
```
d:setup 自動寫入 `~/.claude/settings.json`；**需在專案目錄開 Claude（`${PWD}` 動態）+ 重啟 session** 才載入。

### 2. 建圖譜（每個專案首次）
```bash
cd <repo> && code-review-graph build          # 含 postprocess（flows + communities + FTS）
code-review-graph status                       # 確認 nodes/edges
```

### 3. daemon 自動增量更新（不再變 dead data）
```bash
code-review-graph daemon add "$PWD" --alias <name>  # 檔案 + git 事件
code-review-graph daemon start                 # launchd 開機自啟見下
```
切 branch / commit 自動 update（秒級），不需 git hooks。

### 4. launchd 開機自啟
`~/Library/LaunchAgents/com.code-review-graph.daemon.plist`（RunAtLoad，登入拉起 daemon）。

### 5. 語義搜尋（選用）
```bash
pip install 'code-review-graph[embeddings]'    # sentence_transformers
code-review-graph embed --repo <repo>          # 啟用 semantic_search_nodes_tool
```

### 6. 視覺化
```bash
code-review-graph visualize                    # 生成 graph.html（D3.js 互動圖）
```

### 7. 多機
配置（settings / CLAUDE.md）跨機同步；**圖譜 graph.db 不同步**（~2GB + SQLite 鎖衝突）。新機各自 `build` + `daemon add`。

### 8. 排錯
| 症狀 | 解 |
|---|---|
| Claude 沒調用、走 grep | 在專案目錄開 Claude + 重啟 session；`/mcp` 確認 connected |
| 工具 404 | 完整名含 `_tool` 後綴（`get_architecture_overview_tool`）|
| build 卡住 | daemon 在 watch → 先 `daemon stop` |
| 圖譜過期 | `daemon status` 查 alive；`update --brief` |
| 驗證是否生效 | 問「用 get_hub_nodes_tool 列最多依賴的 5 個符號」→ 看調用 `mcp__code-review-graph__*` 還是 grep |

## G. Understand-Anything（業務流程視覺化 dashboard，互補 code-review-graph）

Claude Code plugin（MIT，[Lum1104/Understand-Anything](https://github.com/Lum1104/Understand-Anything)，已裝 v2.7.5），把 codebase 變互動知識圖譜 + React dashboard，主打**業務流程可視化**與**新人導覽**。與 code-review-graph **互補非取代**。

### 定位：按 audience 分工（與 code-review-graph 零冗餘）
| | code-review-graph | Understand-Anything |
|---|---|---|
| 給誰 | **Claude**（MCP 查依賴 / blast radius）| **人**（dashboard 視覺探索）|
| 介面 | MCP 工具 `*_tool` | React dashboard（domain view / tour）|
| 儲存 | `.code-review-graph/` SQLite | `.understand-anything/knowledge-graph.json` |
| auto-update | daemon（免費背景，檔案+git 自動）| commit hook → Claude 增量（fingerprint，**耗 token**）|

> 口訣：**Claude 要查 → crg ｜ 你要看 → UA**。

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
UA auto-update 跑 LLM agents 做語義分析，**結構變更時花 token**（cosmetic 改動 fingerprint 偵測零成本）。建議：**只在常做 onboarding / 需視覺探索的專案開 `--auto-update`**（如 member-ci）；其他專案要看時手動 `/understand`。crg 則 13 專案全開（免費背景）。

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

> 圖資料隨 git 走，跨機/多 branch 用 hash-based ID（`bd-a1b2`）防合併衝突。與 code-review-graph（符號依賴）、memory（決策）三者不重疊：beads=**任務**層。

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
