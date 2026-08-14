# metrics.jsonl 事件欄位說明

所有事件寫入 `~/.claude/.ab-tao/metrics.jsonl`，每行一個 JSON 物件。

## 必要欄位
- `ts` — ISO 8601 timestamp
- `event` — 事件類型（見下表）

## 事件類型

| event | 觸發點 | 關鍵欄位 |
|---|---|---|
| `cross_source_chain_invocation` | chain-product/chain-tdd 執行尾端 | `chain`, `sources[]`, `steps_completed` |
| `composed_skill_invocation` | skill SKILL.md 執行尾端 | `skill`, `duration_ms` |
| `cost_routing_decision` | pre-tool-cost-router.sh | `model_selected`, `prompt_length` |
| `dispatcher_hit` | commands/ai.md 命中分支 | `intent`, `command` |
| `dispatcher_miss` | commands/ai.md 未命中分支 | `intent`, `fallback` |
| `tdd_block` | pre-tool-edit-tdd.sh 攔截 | `file`, `reason` |
| `failure_pattern_added` | session-end-failure-collect.sh | `trigger`, `pattern_count` |
| `adversarial_invocation` | c:adversarial CLI | `plan`, `models` |
| `skill_invocation` | session-end hook 統計 | `skill`, `duration_ms` |
| `coderag_search` | CodeRAG 語義搜尋觸發（planned，尚無 emitter）| `query`, `results_count`, `duration_ms` |
| `browser_harness_run` | browser-harness 任務執行（planned，尚無 emitter）| `task`, `success`, `duration_ms` |
| `awesome_ai_pedia_search` | awesome-ai-search skill 觸發（planned，尚無 emitter）| `query`, `results_count` |
| `integration_used` | 任意整合被呼叫（planned，尚無 emitter）| `integration`, `action` |

## v1.7+ 升級觸發閾值

| 欄位 | 閾值 | 用途 |
|---|---|---|
| `chain_invocations` / 月 | ≥ 10 | chain-sdlc 升級觸發 |
| `adversarial_invocations` 累積 | ≥ 5 | /codex 升級觸發 |
| `skill_invocation_rate` | ≥ 20% | 全 SDLC 升級觸發 |
| `dispatcher_miss` 累積 | ≥ 30 | LLM dispatcher 升級觸發 |
