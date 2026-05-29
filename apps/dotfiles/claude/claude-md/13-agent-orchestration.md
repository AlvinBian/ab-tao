<agent_orchestration>

## Harness 設計原則（提煉自 omp）

| 原則 | 含義 |
|---|---|
| **Harness > Model** | 工具呼叫格式品質決定 model 能力上限 |
| **Schema > Prose** | Subagent 回傳結構化資料，禁止依賴散文解析 |
| **Pattern-trigger > Pre-instruction** | 遇具體 pattern 立即停下，優於通用前置指令 |
| **Curate > Wait** | 主動記憶勝於等使用者說「記住這個」|
| **Preview > Apply** | 預覽確認後再執行，不自動 apply 破壞性操作 |

## 資源速查表

| 需求 | 使用 |
|---|---|
| 架構設計 / 審查 | `architect` agent |
| 除錯 / 修復 | `debugger` agent |
| 複雜計畫 | `/plan` mode 或 `Plan` subagent |
| 程式碼審查 | `/code-review` |
| 廣域探索 | `Explore` subagent |
| 需求結構化 / spec | `/specify` command |
| spec AC 反向驗證 | `/verify` command |
| 找 skill / 補 skill | `find-skills` skill（auto-trigger + 手動 `pnpm run c:skills --find`）|
| **GitNexus 知識圖譜** | 見下方「GitNexus 整合」章節 |
| **Understand-Anything（語義層）** | 見下方「融合工作流」章節 |

## GitNexus 知識圖譜整合

GitNexus 為 repo 建立符號圖，透過 MCP 暴露工具。PreToolUse hook 自動增強 Grep/Glob/Bash 搜尋結果。

### 任務 → Skill 映射

| 任務 | Skill | 典型觸發語 |
|---|---|---|
| 架構探索 / 理解代碼 | `gitnexus-exploring` | "How does X work?", "Show me the auth flow" |
| **Blast radius / 改了什麼會 break** | `gitnexus-impact-analysis` | "Is it safe to change X?", "What depends on this?" |
| Trace bug / 錯誤根因 | `gitnexus-debugging` | "Why is X failing?", "Trace this error" |
| Rename / Extract / Split | `gitnexus-refactoring` | "Rename this safely", "Extract to module" |
| PR 改動影響範圍 | `gitnexus-pr-review` | "Review PR #N", "Blast radius of this PR?" |
| Index / reindex / CLI | `gitnexus-cli` | "Index this repo", "Reanalyze codebase" |
| Tool / schema 查閱 | `gitnexus-guide` | "What GitNexus tools are available?" |

> MCP 工具速查 / Hook 行為 / Index 管理 → Read `~/.claude/docs/gitnexus-integration.md`（架構探索、blast radius 任務時）

## GitNexus × Understand-Anything 融合工作流

兩層互補：**技術層**（GitNexus，符號圖 + blast radius，Claude 推理用）+ **語義層**（Understand-Anything，業務流程可視化，人類理解用）。

### 任務 → 雙層工具映射

| 任務 | 語義層（先） | 技術層（後） |
|---|---|---|
| 理解新 repo / 陌生模組 | Understand-Anything 生成業務 diagram | `gitnexus-exploring` 確認符號依賴 |
| 改動安全性確認 | 確認業務流程無斷點 | `gitnexus-impact-analysis` blast radius |
| Debug 根因追蹤 | 從 diagram 定位業務層失效點 | `gitnexus-debugging` trace 技術符號鏈 |
| Refactor / Rename | 確認業務邊界不被破壞 | `gitnexus-refactoring` 符號安全重命名 |
| PR 改動影響 | 確認 user flow 完整性 | `gitnexus-pr-review` 技術依賴影響 |

### 三條使用原則

1. **新 repo / 陌生模組**：先跑 Understand-Anything 建立業務心智模型，再用 GitNexus 深入符號層
2. **改動後雙層確認**：semantic diagram 確認業務流完整 → impact analysis 確認技術依賴無斷鏈
3. **Debug 入口**：從語義層定位「哪個業務流失效」→ GitNexus 追蹤「哪個符號鏈斷了」

> Understand-Anything 安裝：Claude Code 插件，`claude plugin install understand-anything` 或 VS Code marketplace 搜尋。

## 調度規則（強制）

**1. 併發優先**：多個獨立任務必須 parallel 同時啟動，禁止串行等待。
單一 message 可併發多個 Agent tool call；無依賴者必須同一輪送出。

**2. Background 強制使用**：不阻塞主流程的任務（搜索、分析、探索）用 `run_in_background: true`。
僅結果直接影響下一步決策的 agent 才以 foreground 執行。

**3. 禁止低效模式**：
- 禁止一個 agent 完成後再啟動下一個（串行等待）
- 禁止主對話重複 agent 已在做的搜索
- 禁止只啟動 1 個 agent 處理明顯可拆分的多方向任務

**4. Subagent 分層**：搜索密集、重 I/O 工作下放 subagent；主對話專注決策與整合。

## 何時**不要** spawn agent

- 使用者問題 1–2 個工具能直接回答 → 主對話自己做
- 已知檔案路徑要讀 / 改 → 直接 Read / Edit，不要 Explore
- 純 yes/no / 概念性問題 → 直接答，不要 research agent
- 為了「看起來在做事」而 spawn → 禁止

agent 適用情境：搜尋密集、多檔案 cross-reference、結果需獨立第二意見、可平行的多方向探索。

> 多 phase 並行排程（DAG 切分 / Wave gate / 衝突處理）→ Read `~/.claude/docs/agent-dag-parallel.md`（任務含 ≥3 phase 時）。

## Subagent 回傳結構規範（Schema > Prose）

啟動 subagent 時 **prompt 必須明確指定回傳 schema**，禁止接受純 prose 後再自行解析。

**研究 / 探索類**（Explore / general-purpose research）：
```
findings: [{path, line, confidence: ✅|⚠️|❓, summary}]
conclusion: 一句話結論
```

**審查類**（reviewer / architect / pr-test-analyzer / silent-failure-hunter / type-design-analyzer）：
```
issues: [{severity: P0|P1|P2|P3, confidence: high|medium|low, location, fix}]
verdict: SHIP | BLOCK | NEEDS-DISCUSSION
```

**執行類**（debugger / planner）：
```
changes: [{file, before, after, verify}]
done: boolean
verdict: PASS | FAIL | NEEDS-REVIEW
```

**Done-gate Critic（強制）**：`done: true` 必須伴隨 `verdict`。收到 FAIL 或 NEEDS-REVIEW 時：
- 主對話**禁止**標 task complete
- **必須** spawn `reviewer` agent 回頭驗（prompt 明確指出 changes 清單與失敗理由）
- 僅 `verdict: PASS` 才可標完成

> 完整 schema 範例 / prompt 模板 / 與 agents/*.md 的對應表 → `~/.claude/docs/agent-typed-result.md`

## Review 入口決策表

| 需求 | 工具 | 備註 |
|---|---|---|
| **PR review（預設入口）** | **`/code-review`** | 自動分流 quick/standard/deep；`--effort` flag 覆寫；見下方分流規格 |
| 第二意見 / quick 單獨呼叫 | `reviewer` agent | quick 模式固定組件；亦可獨立呼叫取第二意見 |
| PR 測試覆蓋率 | `pr-test-analyzer` agent | 行為覆蓋 + 漏洞防護 |
| 無聲失敗 / 錯誤吞噬 | `silent-failure-hunter` agent | 專項分析 |
| 型別設計 | `type-design-analyzer` agent | 不變量 + 封裝 |
| 架構深度審查 | `architect` agent | 5 維度評分 |

## Review 深淺分流規格

### 自動判定 Tier

| 層級 | 觸發條件 | 耗時 |
|---|---|---|
| **quick** | 行數 ≤ 80（stacked +50%）＆ 檔案 ≤ 3 ＆ 無強制升級訊號 | < 90s |
| **standard** | 80–300 行 / 4–10 檔 / 命中 standard 升級訊號 | ~5 min |
| **deep** | > 300 行 / > 10 檔 / 命中 deep 升級訊號 | ~8 min |

**stacked PR**：偵測 git-spice stack（base ≠ main）時，quick 上限 +50%（≤ 120 行）。

### 強制升級訊號

**→ deep**（path allowlist）：
`**/migrations/**` / `**/schema.prisma` / `**/*.sql` / `**/middleware/auth*` / `**/guards/**` / `**/policies/**` / `**/permissions/**` / `**/payment/**` / `**/billing/**` / `**/charge*` / `**/.env*` / `**/config/secrets*` / `**/crypto*` / `**/hash*`

**→ standard**（path allowlist）：
`**/cron*` / `**/scheduler*` / `**/queue*` / `**/cors*` / `**/csp*` / `**/cookie*` / `package.json` dependencies|scripts 段

**→ standard**（risk keyword scan）：
`SECRET` / `SALT` / `PRIVATE_KEY` / `DROP TABLE` / 動態程式碼求值 / React raw HTML 注入屬性 / `child_process` / `bcrypt` / `jwt.sign` / `Math.random`（安全 context）/ diff 含 `^- *if ` 開頭位於 auth 路徑

**→ standard**（diff 形狀）：純刪除 PR `+0/-N` / `.env.example` 改動 / featureFlag default 翻轉

**行數計算排除**：`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `*.snap` / `dist/**` / `*.generated.*` / `*.min.*`

**優先級**：allowlist > keyword > shape > 行數。降級需 4 條全清。

### Quick 模式能力組合

| 能力 | 觸發條件 |
|---|---|
| Diff 正確性檢視 | always |
| typecheck | always |
| lint | always |
| `reviewer` agent | always |
| `silent-failure-hunter` | diff 含 try / catch / `.catch(` / swallow |
| `type-design-analyzer` | diff 含 `.ts` / `.tsx` / `.d.ts` |
| `pr-test-analyzer` lite | prod code 改 ＆ test 未改 |

**覆寫**：`--effort=quick|standard|deep`；`--effort=quick --force` 需附 justification。

## 多 session 監看

啟動 `/bg`、`ralph-loop` 或背景 agent 後，主對話可用 `claude agents` 一覽所有 session 狀態 / 耗時 / 退出原因，無需逐一切換。

## 瀏覽器自動化分流

遇到任何瀏覽器操作需求，先套用 `browser-automation-router` skill 決策：

| 場景 | 工具 |
|---|---|
| session 內互動 / Lighthouse / 記憶體分析 | chrome-devtools MCP |
| 長任務 / self-healing / domain helper 沉澱 | browser-harness |

> browser-harness 預設啟用（d:setup 自動安裝）；停用：`c:locals --stop browser-harness`。

</agent_orchestration>
