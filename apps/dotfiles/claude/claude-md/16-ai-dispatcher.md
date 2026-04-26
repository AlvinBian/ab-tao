# 16-ai-dispatcher

`/ai <intent>` rule-based dispatcher 使用說明，讓使用者以自然語言輸入意圖，dispatcher 自動映射至對應命令。

## 觸發方式

在任何 prompt 中以 `/ai "<意圖描述>"` 格式輸入，dispatcher 解析意圖並路由至對應命令。
intent-cache.json 命中時直接執行，未命中時展示候選清單並詢問確認。

```
/ai "PR review"       → /verify
/ai "釐清需求"        → /specify
/ai "unit test"       → /test
/ai "build 壞了"      → /check
/ai "部署計劃"        → /deploy-plan
/ai "發 Slack"        → /slack
```

## 30+ Intent 映射表

| 輸入意圖 | 映射命令 | 說明 |
|---------|---------|------|
| PR review / 審查 PR | `/verify` | spec AC 反向覆蓋驗證 |
| 釐清需求 / spec / 寫 spec | `/specify` | 需求 → 結構化 Spec |
| unit test / 寫測試 / 補測試 | `/test` | 測試生成與覆蓋率分析 |
| build 壞了 / 編譯錯誤 / build fix | `/check` | 構建修復 |
| 品質閘門 / quality gate | `/check --gates` | 9-gate 完整審查 |
| PR stack / stack 狀態 | `/pr-stack` | 堆疊 PR 狀態 |
| 部署計劃 / deploy plan | `/deploy-plan` | 部署計劃生成 |
| 發 Slack / Slack 草稿 | `/slack` | Slack 訊息助手 |
| worklog / 工作記錄 | `/worklog` | Worklog 草稿審查 |
| db migration / 資料庫遷移 | `/db-migration` | 資料庫遷移全流程 |
| 監控 / SLO / alert | `/observe` | SLO + Dashboard + Alert |
| 安全審查 / security review | `/security-review` | 安全審查 |
| 代碼審查 / code review | `/review` | PR 代碼審查 |
| 初始化 / init CLAUDE.md | `/init` | 初始化 CLAUDE.md |
| 需求功能開發 / feature | `/chain-product` | 三步功能開發 chain |
| TDD / test-driven | `/chain-tdd` | 四步 TDD chain |
| 架構設計 / 設計方案 | `architect` agent | 架構設計 agent |
| 除錯 / debug / 找 bug | `debugger` agent | 除錯 agent |
| 並行任務 / parallel | `dispatching-parallel-agents` skill | 並行 agent 調度 |
| 記憶搜尋 / 找記憶 | `memory-search` skill | 記憶語義搜尋 |
| 找 skill | `find-skills` skill | 搜尋社群 skill |
| 簡化代碼 / refactor | `simplify` skill | 代碼簡化審查 |
| 後端架構 / API 設計 | `backend-patterns` skill | 後端架構 pattern |
| Vue / Nuxt / SSR | `nuxt4-patterns` skill | Nuxt 4 pattern |
| Laravel / PHP | `laravel-patterns` skill | Laravel pattern |
| 測試驅動 / TDD | `test-driven-development` skill | TDD skill |
| 系統除錯 / 系統性分析 | `systematic-debugging` skill | 系統性除錯 |
| 執行計劃 / 按計劃執行 | `executing-plans` skill | 計劃執行 |
| 狀態快照 / session 狀態 | `status-anchor` skill | Session 狀態快照 |
| SLO / observability | `observe` skill | 可觀測性設計 |
| 腦力激盪 / brainstorm | `brainstorming` skill | 創意發想 |

## 未命中行為

意圖未在映射表中找到時：
1. dispatcher 展示 3 個最接近的候選命令（BM25 相似度排序）
2. 詢問使用者確認或自行輸入命令名稱
3. 未命中記錄至 `~/.claude/.ab-tao/runtime/intent-cache.json` 的 `unmatched` 陣列

## v1.7+ 升級條件

當 `intent-cache.json` 的 `unmatched` 陣列在 30 天內累積 ≥ 30 條不重複意圖時，ab-tao 自動提示：
> 「偵測到 30+ 個未命中意圖，建議升級至 v1.7（含機器學習輔助映射）。執行 `pnpm run d:setup --upgrade` 了解升級選項。」
