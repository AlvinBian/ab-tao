# 本地工具安裝指引

本機需手動安裝的外部服務與工具。
各服務狀態可透過 `pnpm run c:locals --status` 查看。

## A. LM Studio + Milvus（claude-context 必需）

> **⚡ 快速路徑**：完成 LM Studio + Milvus + `.env.local` 三項前置後，
> 直接 `pnpm run d:setup` 勾選「🔍 語義代碼搜尋」即可全自動寫入 MCP；
> 失敗時再回到下方手動逐步驟。

### 前置需求
- macOS M1/M2/M3（RAM ≥ 16GB；LM Studio + Milvus + Claude Code 同跑約 14–15GB）
- OrbStack（推薦）或 Docker Desktop 4.x+（Milvus standalone 必需）
  ```bash
  brew install orbstack   # 啟動後自動提供 docker / docker compose
  ```
- Node.js 20/22（`@zilliz/claude-context-mcp@latest`）

### 1. 安裝 LM Studio

```bash
brew install --cask lm-studio
```

啟動後：
1. 搜尋並下載 `nomic-embed-text-v2-moe`（GGUF，約 600MB）
2. 在 Local Server 頁面啟動 server → port 1234
3. 確認：`curl http://127.0.0.1:1234/v1/models | jq '.data[].id'`

> ⚠️ **LM Studio 為非官方路線**（官方只驗證 Ollama）。若 embedding 報錯，
> 改 Ollama fallback：`brew install ollama && ollama pull nomic-embed-text`，
> 同時把 `.env.local` 中 `CLAUDE_CONTEXT_PROVIDER=Ollama` 並移除 `CLAUDE_CONTEXT_BASE_URL`。

### 2. 啟動 Milvus standalone（Docker Compose）

```bash
mkdir -p ~/.ab-tao/milvus && cd ~/.ab-tao/milvus
curl -Lo docker-compose.yml \
  https://github.com/milvus-io/milvus/releases/download/v2.4.0/milvus-standalone-docker-compose.yml
docker compose up -d
# 等待約 30s 後確認：
curl -sf http://127.0.0.1:9091/healthz && echo "Milvus OK"
```

> Milvus standalone 端口：19530（gRPC）+ 9091（HTTP health）。
> 多台機器各自需執行以上步驟；collection（索引）不會跨機器同步。

### 3. 設定環境變數 + 寫入 MCP server

複製 `apps/dotfiles/.env.example` → `.env.local`，填入實際值：

```bash
cp apps/dotfiles/.env.example apps/dotfiles/.env.local
# 編輯 .env.local，填入以下 8 個變數：
# CLAUDE_CONTEXT_PROVIDER=LMStudio
# CLAUDE_CONTEXT_MODEL=nomic-embed-text-v2-moe
# CLAUDE_CONTEXT_API_KEY=lm-studio
# CLAUDE_CONTEXT_BASE_URL=http://127.0.0.1:1234/v1
# CLAUDE_CONTEXT_EMBEDDING_DIM=768
# CLAUDE_CONTEXT_MILVUS_ADDRESS=http://127.0.0.1:19530
# CLAUDE_CONTEXT_COLLECTION_NAME=code_chunks
# CUSTOM_EXTENSIONS=.vue,.svelte
```

然後執行：

```bash
pnpm run d:setup
# → 在 feature 選單勾選「🔍 語義代碼搜尋」
# → setup 會自動驗證 env、檢測 LM Studio + Milvus 可達、寫入 ~/.claude/settings.json mcpServers
```

驗證：

```bash
cat ~/.claude/settings.json | jq '.mcpServers."claude-context"'
# 應顯示 command/args/env 完整 8 個 CLAUDE_CONTEXT_* 變數
```

### 4. 初次建立代碼索引

首次裝完後，在當前 repo 的 Claude Code session 中說：

```
「初始化 claude-context」 / 「幫我建立代碼索引」
```

→ 觸發 `claude-context-init` skill 執行 `index_codebase(cwd)`
→ 大型 repo 約 1–5 分鐘
→ 進度查詢：在 session 中說「查 claude-context 索引狀態」

> ⚠️ skill **不會**在 session-start 自動觸發（hooks 無法載 skill）；
> 每次新 repo 第一次需顯式說「初始化代碼索引」。

### 5. 多機設置

每台機器需獨立：
1. 安裝 LM Studio + 下載模型
2. 執行 Milvus docker-compose up
3. 說「初始化代碼索引」建立 collection（命名為 `code_chunks_<pathHash>`）

### 6. 失敗排錯（claude-context 常見問題）

**症狀 1：search_code 永遠回傳空陣列**
→ 說「查 claude-context 索引狀態」確認 `get_indexing_status`：
  - `not_indexed` → 沒跑過索引；說「初始化代碼索引」
  - `indexing` → 還在跑，等
  - `indexed` 但搜不到 → 進入症狀 2

**症狀 2：embedding dim mismatch**
→ Milvus collection 的 dim 與 LM Studio model 的 dim 不一致
→ 解法：說「清除 claude-context 索引」後重建；確認 `.env.local` `CLAUDE_CONTEXT_EMBEDDING_DIM=768`（nomic-embed-text-v2-moe 是 768）
→ 換 model 必須先 clear_index

**症狀 3：search_code 報 "MILVUS connection refused"**
→ Milvus 沒起：`docker ps | grep milvus-standalone`
→ 健康確認：`curl -sf http://127.0.0.1:9091/healthz && echo "OK"`（注意是 9091 非 19530）
→ 重啟：`pnpm run c:locals --start` 或 `cd ~/.ab-tao/milvus && docker compose restart`

**症狀 4：LM Studio port 1234 連不上**
→ LM Studio GUI 未啟動 server（要按下 "Start Server"）
→ 或被別的程式佔用：`lsof -i :1234`

**症狀 5：d:setup 勾選 🔍 語義代碼搜尋但被略過**
→ envCheck 失敗；檢查順序：
  1. `grep CLAUDE_CONTEXT_ apps/dotfiles/.env.local` — 8 個 var 是否齊全
  2. `curl -sf http://127.0.0.1:1234/v1/models` — LM Studio 是否回應
  3. `curl -sf http://127.0.0.1:9091/healthz` — Milvus 是否回應（HTTP port 9091）
  4. 任一缺失 → d:setup log 顯示對應 missing message

**症狀 6：多機 collection 不同步**
→ 已知限制：collection 用 path hash 命名，每台機器各自 index
→ 沒有跨機同步機制；每台機器獨立說「初始化代碼索引」

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
