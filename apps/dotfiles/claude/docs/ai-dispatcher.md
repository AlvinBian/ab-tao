# AI Dispatcher

`/ai <intent>` rule-based dispatcher — 輸入自然語言意圖，自動映射至對應命令或 agent。

## 觸發場景

- 使用者輸入 `/ai "PR review"` → dispatcher 映射至 `/verify`，自動執行
- 使用者輸入 `/ai "釐清需求"` → 映射至 `/specify`，進入需求結構化流程
- 使用者輸入 `/ai "unit test"` → 映射至 `/test`，自動偵測框架並生成測試

## 40+ Intent 映射表

| 輸入意圖 | 映射命令 | 說明 |
|---------|---------|------|
| PR review / 審查 PR | `/verify` | spec AC 反向覆蓋驗證 |
| 釐清需求 / spec / 寫 spec | `/specify` | 需求 → 結構化 Spec |
| unit test / 寫測試 / 補測試 | `/test` | 測試生成與覆蓋率分析 |
| build 壞了 / 編譯錯誤 / build fix | `debugger` agent | 根因定位 + 最小 diff 修復 |
| PR stack / stack 狀態 | `/pr-stack` | 堆疊 PR 狀態 |
| 部署計劃 / deploy plan | `/deploy-plan` | 部署計劃生成 |
| 發 Slack / Slack 草稿 | `/slack` | Slack 訊息助手 |
| worklog / 工作記錄 | `/worklog` | Worklog 草稿審查 |
| db migration / 資料庫遷移 | `/db-migration` | 資料庫遷移全流程 |
| 監控 / SLO / alert | `/observe` | SLO + Dashboard + Alert |
| 安全審查 / security review | `/security-review` | 安全審查 |
| 代碼審查 / code review | `/code-review` | PR 代碼審查（自動分流 quick/standard/deep） |
| 初始化 / init CLAUDE.md | `/init` | 初始化 CLAUDE.md |
| 需求功能開發 / feature | `/chain-product` | 三步功能開發 chain |
| TDD / test-driven | `/chain-tdd` | 四步 TDD chain |
| 架構設計 / 設計方案 | `architect` agent | 架構設計 agent |
| 除錯 / debug / 找 bug | `debugger` agent | 除錯 agent |
| 並行任務 / parallel | `dispatching-parallel-agents` skill | 並行 agent 調度 |
| 記憶搜尋 / 找記憶 | `memory-search` skill | 記憶語義搜尋 |
| 找 skill | `find-skills` skill | 搜尋社群 skill |
| 簡化代碼 / refactor | `/code-review` | 代碼簡化審查 |
| 後端架構 / API 設計 | `backend-patterns` skill | 後端架構 pattern |
| Vue / Nuxt / SSR | `nuxt4-patterns` skill | Nuxt 4 pattern |
| Laravel / PHP | `laravel-patterns` skill | Laravel pattern |
| 測試驅動 / TDD | `test-driven-development` skill | TDD skill |
| 系統除錯 / 系統性分析 | `systematic-debugging` skill | 系統性除錯 |
| 執行計劃 / 按計劃執行 | `executing-plans` skill | 計劃執行 |
| 狀態快照 / session 狀態 | `status-anchor` skill | Session 狀態快照 |
| SLO / observability | `observe` skill | 可觀測性設計 |
| 腦力激盪 / brainstorm | `brainstorming` skill | 創意發想 |
| **語義搜尋 / 按意思找代碼** | `codebase-memory-mcp` MCP `search_graph` | 符號級語義檢索 |
| **blast radius / 什麼會 break / 改了有什麼影響** | `codebase-memory-mcp` MCP `detect_changes` / `query_graph` | git diff→影響符號 + 風險 |
| **trace bug / 追蹤依賴鏈 / callers** | `codebase-memory-mcp` MCP `trace_path` / `query_graph` | 符號依賴鏈 + callers_of |
| **架構探索 / 代碼理解 / how does X work** | `codebase-memory-mcp` MCP `get_architecture` | 架構總覽 + hub 熱點 |
| **建 / 更新索引** | `codebase-memory-mcp cli index_repository` | 初次索引 2s 級 / reindex |
| **codebase-memory 工具 / 怎麼用** | `codebase-memory-mcp` MCP（14 tools）| 見 13-agent-orchestration 任務→工具映射 |

## Usage

```bash
# 基本意圖觸發（在 Claude Code 中直接使用）
/ai "PR review"         # → /verify
/ai "blast radius"      # → codebase-memory-mcp detect_changes
/ai "trace this bug"    # → codebase-memory-mcp trace_path / query_graph
/ai "語義搜尋 X"        # → codebase-memory-mcp search_graph
/ai "釐清需求"          # → /specify
/ai "unit test"         # → /test
/ai "stack PR 狀態"     # → /pr-stack
/ai "build 壞了"        # → debugger agent
/ai "部署計劃"          # → /deploy-plan
/ai "發 Slack"          # → /slack

# 查看 intent cache（30 天命中記錄）
cat ~/.claude/.ab-tao/runtime/intent-cache.json

# 清空 intent cache
pnpm run d:hooks --clear-intent-cache
```

intent-cache.json 位置：`~/.claude/.ab-tao/runtime/intent-cache.json`

## 未命中行為

意圖未在映射表中找到時：
1. dispatcher 展示 3 個最接近的候選命令（BM25 相似度排序）
2. 詢問使用者確認或自行輸入命令名稱
3. 未命中記錄至 `intent-cache.json` 的 `unmatched` 陣列

當 `unmatched` 在 30 天內累積 ≥ 30 條不重複意圖時，ab-tao 提示升級至 v1.7。

## Troubleshoot

**意圖未命中（unmatched）**
dispatcher 找不到對應命令時，回傳候選清單並詢問使用者確認。未命中累積至 `intent-cache.json` 的 `unmatched` 陣列；若 30 天內 ≥ 30 條，觸發 v1.7+ 升級提示。

**命令存在但未觸發**
確認 `~/.claude/.ab-tao/runtime/intent-cache.json` 是否可寫入（`ls -la ~/.claude/.ab-tao/runtime/`）。若目錄不存在，執行 `pnpm run d:setup` 重建 runtime 目錄。

**誤觸發至錯誤命令**
在 `settings.json._abTao.intentOverrides` 新增覆蓋規則：
```json
{
  "_abTao": {
    "intentOverrides": {
      "PR review": "/pr-stack"
    }
  }
}
```

## Uninstall

```bash
pnpm run d:uninstall --feature ai-dispatcher
```

移除後：dispatcher hook 停用，`/ai` 命令失效；intent-cache.json 保留於 `~/.claude/.ab-tao/runtime/`，不自動刪除。
