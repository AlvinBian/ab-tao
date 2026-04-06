# ab-tao dotfiles v3 升級方案

> 綜合 Anthropic 官方文檔、Claude Code Academy、ECC (142K⭐)、GSD (48K⭐)、
> 知乎最佳實踐、社區方案、GitHub Issues 分析，從 7 個維度彙總。

## 現狀數據

| 項目 | 數量 | 每次 session 注入方式 |
|------|------|----------------------|
| Rules（~/.claude/rules/） | 8 個 · 441 行 · 27KB | **全量注入** system prompt |
| Commands（~/.claude/commands/） | 86 個 · 460KB | 名稱 + 描述（~4KB） |
| Agents（~/.claude/agents/） | 53 個 · 284KB | 名稱 + 描述（~8KB） |
| Hooks（~/.claude/hooks.json） | 11 個事件 | 零 context 消耗 |
| CLAUDE.md（per repo） | ~2KB | **全量注入** |
| Auto Memory（MEMORY.md） | 前 200 行 | 自動注入 |

**每個 session 基礎 token 消耗 ≈ 40-45KB**（rules 27KB + commands 描述 4KB + agents 描述 8KB + CLAUDE.md 2KB + memory ~3KB）

---

## 維度一：Token 優化（影響最大）

### 問題分析

| 來源 | 問題 | 浪費量 |
|------|------|--------|
| 官方文檔 | CLAUDE.md < 200 行；Rules 全量注入 | Rules 27KB 每次都載入 |
| 官方 Costs 文檔 | 專業指令應放 Skills（按需載入） | Rules 內容不按需 |
| 官方 Memory 文檔 | HTML 註釋自動剝離 | 未利用 |
| 知乎文章 | CLAUDE.md 瘦身：刪掉 Claude 已知的 | 通用規範佔位 |
| ai-codex 方案 | 預索引壓縮 50K→3K | 無預索引 |
| GitHub #44045 | skill_listing 未進 cache → 每次 resume cache miss | 重複計費 |

### 行動項

#### T1.1 Rules 遷移（-21KB/session）

**現狀**：8 個 rules 全量注入

| Rule | 大小 | 處理方式 |
|------|------|----------|
| README.md | 4.6KB | **刪除** — 純文檔，不是規範 |
| agents.md | 1.6KB | **刪除** — Claude 從 ~/.claude/agents/ 已知 |
| coding-style.md | 2KB | **→ CLAUDE.md 模板** — 按項目技術棧生成 |
| testing.md | 1.2KB | **→ CLAUDE.md 模板** — 按項目測試框架生成 |
| git-workflow.md | 0.7KB | **→ CLAUDE.md 模板** — 通用 |
| patterns.md | 1.4KB | **→ Skills** — 按需載入 |
| performance.md | 1.6KB | **→ Skills** — 按需載入 |
| hooks.md | 0.7KB | **刪除** — hooks.json 已是執行層 |

**結果**：Rules 從 27KB → ~6KB（保留有 `paths` 條件載入的技術棧規則）

#### T1.2 Agent 描述精簡

**現狀**：前 10 個 agent 描述超 230 字（最長 298 字），官方上限 250 字截斷

**行動**：所有 agent 描述 ≤ 150 字（一句話 what + 一句話 when to use）

#### T1.3 Skill 分類標記

| 標記 | 效果 | 適用 Skills |
|------|------|-------------|
| `disable-model-invocation: true` | 描述不進 context + 防誤觸 | deploy、commit、pr-workflow、changeset |
| `context: fork` | 在 subagent 中執行 | code-review、security、test-coverage |
| `paths: ["**/*.ts"]` | 只在匹配時載入 | 技術棧相關 skills |

#### T1.4 Hook 預處理大輸出

```json
{
  "PreToolUse": [{
    "matcher": "Bash",
    "hooks": [{
      "type": "command",
      "command": "~/.claude/hooks/filter-output.sh"
    }]
  }]
}
```
偵測 test/build 命令，只保留 ERROR/FAIL 行，省數萬 token。

#### T1.5 預索引生成（ai-codex 模式）

setup 時為每個 repo 生成壓縮索引（掛 pre-commit hook 自動更新）：
```
.claude/
  index/
    api-routes.md      # API 端點列表
    components.md      # 組件樹
    schema.md          # 資料庫 schema
    exports.md         # 公開 API
```
CLAUDE.md 用 `@.claude/index/api-routes.md` 引用，按需載入。

**預估效果**：50K→3K token per repo（來源：ai-codex 實測數據）

---

## 維度二：配置架構

### 問題分析

| 來源 | 洞察 |
|------|------|
| 官方 Memory 文檔 | CLAUDE.md 層級：企業 > 項目 > 用戶 > 子目錄，按需載入 |
| 官方 Skills 文檔 | Skills = 按需載入的知識膠囊；Commands 已合併入 Skills |
| 官方 Best Practices | CLAUDE.md 只寫 Claude 猜不到的；像代碼一樣維護 |
| Academy 配置指南 | 八大模塊：工作流 > 質量紅線 > 編碼標準 > 安全 > 技術棧 > 測試 > Git > 溝通 |
| ECC (142K⭐) | instincts 系統（帶信心評分的自動學習） |
| GSD (48K⭐) | PROJECT.md + STATE.md + CONTEXT.md 三層記憶 |

### 目標架構

```
~/.claude/
├── CLAUDE.md                    # 全局個人偏好（<50 行）
├── rules/                       # 只保留有 paths 的條件規則
│   └── csharp.md               # paths: ["**/*.cs"] — 條件載入
├── settings.json                # 權限 + hooks + env
├── hooks.json                   # 事件驅動自動化
├── commands/                    # → 遷移到 skills/（保留相容）
├── skills/                      # 按需載入的知識 + 工作流
│   ├── code-review/SKILL.md    # context: fork
│   ├── pr-workflow/SKILL.md    # disable-model-invocation: true
│   └── ...
├── agents/                      # 專業子代理（描述 ≤150 字）
└── projects/
    └── {org}/{repo}/            # ← 已實現 org/repo 命名
        ├── CLAUDE.md            # 項目級配置
        └── memory/MEMORY.md     # 自動記憶

{repo}/
├── CLAUDE.md                    # 團隊共用（八大模塊）
├── CLAUDE.local.md              # 個人偏好（gitignore）
├── .claudeignore                # ← 已實現自動生成
└── .claude/
    ├── rules/                   # 項目級條件規則
    ├── skills/                  # 項目級技能
    └── index/                   # 預索引（壓縮 .md）
```

### CLAUDE.md 模板升級（八大模塊）

```markdown
# {project-name}
{一句話描述}。技術棧：{stacks}。

## 核心工作流程
**每個任務必須遵循：RESEARCH → PLAN → IMPLEMENT**
1. 研究：檢查現有代碼，搜索相關實現
2. 計劃：列出文件清單 + 方案 + 風險，**獲確認後才編碼**
3. 實現：遵循風格 + 完整錯誤處理 + 同步寫測試

## 質量紅線
- **絕不**提交未通過測試的代碼
- **絕不**使用 TODO/FIXME 作為最終代碼
- **絕不**跳過錯誤處理或吞掉異常
- **絕不**硬編碼密鑰或敏感資訊

## 構建與測試
- 安裝：`{install_cmd}`
- 測試：`{test_cmd}`
- Lint：`{lint_cmd}`
- 類型檢查：`{typecheck_cmd}`

## 編碼標準
{根據技術棧動態生成}

## 架構
{根據 AI 分析 + 預索引生成}

<!-- 以下為人類備註，不消耗 token -->
<!-- 生成時間：{timestamp} -->
<!-- 技術棧：{stacks} -->

## 壓縮指令
When compacting, preserve: 修改過的文件列表、測試結果、未完成任務
```

---

## 維度三：Setup 流程

### 問題分析

| 來源 | 洞察 |
|------|------|
| 官方 `/init` | 新版支持互動式多階段：CLAUDE.md + Skills + Hooks |
| 架構審查 | setup.mjs 827 行，8+ 職責，過度複雜 |
| 用戶反饋 | spinner 輸出令人困惑；HOME 未定義（已修復） |
| GSD | 循環式提問 → 收斂需求 → 執行 |

### 簡化方案

```
現有流程（5 層選擇）：
  功能 → repos → 角色 → 分析 → 計畫 → 執行

簡化流程（3 步）：
  Step 1: 選 repos（預選有貢獻的）        ← 已優化
  Step 2: 確認計畫（推薦配置 + 一鍵確認）
  Step 3: 安裝（並行執行 + .claudeignore） ← 已加入
```

### 新增步驟整合

| 步驟 | 現有 | 新增 |
|------|------|------|
| 分析 | 技術棧偵測 + AI 分類 | + 預索引生成 |
| 執行 | Claude 配置 + ZSH + Slack | + .claudeignore（✅已做） |
| 完成 | Report + Session | + 官方 Plugin 推薦安裝 |

---

## 維度四：Report 升級

### 需要包含的所有內容

| 區塊 | 現有 | 新增 |
|------|------|------|
| 總覽 | ✅ 健康度環形圖 | Token 消耗估算 |
| Commands | ✅ 使用統計 | 30 天未使用標記 + 一鍵清理 |
| Agents | ✅ 使用統計 | 30 天未使用標記 |
| Rules | ✅ 狀態 | 條件載入 vs 全量注入標記 |
| Hooks | ✅ 事件分佈 | 觸發頻率統計 |
| Skills | ❌ 缺失 | 載入方式（按需/常駐/禁用） |
| Plugins | ❌ 缺失 | 已安裝 + 推薦安裝 |
| .claudeignore | ❌ 缺失 | 覆蓋 repo 數 + 規則條數 |
| 預索引 | ❌ 缺失 | 覆蓋 repo 數 + 壓縮率 |
| Token 估算 | ❌ 缺失 | 優化前/後對比 |
| 清理機會 | ❌ 缺失 | 可刪除項 + 預估節省 |

### 圖表規劃

| 圖表 | 類型 | 數據 |
|------|------|------|
| Token 消耗分佈 | 環形圖 | Rules/Commands/Agents/CLAUDE.md/Memory |
| 使用頻率 TOP 20 | 柱狀圖 | Commands + Agents 使用次數 |
| 7 天 Session 趨勢 | 折線圖 | ✅ 已有 |
| 30 天未使用 | 表格 | Commands + Agents 列表 |
| 清理效果預估 | 對比條 | 優化前 vs 優化後 token |

---

## 維度五：Status 升級

### 現有功能

- 健康度 bar + 分數
- Claude 配置（Commands/Agents/Rules/Hooks/Settings）
- ZSH 模組
- Slack 通知
- 互動式調整（重裝/重新生成）

### 新增功能

| 功能 | 描述 | 實現方式 |
|------|------|----------|
| **使用監控** | 每個 command/agent 的調用次數 + 最後使用時間 | 讀取 session .jsonl |
| **30 天未使用** | 標記 + 批量清理 | usage-scanner 增強 |
| **一鍵移除** | 選中後直接 rm | 已有 manageConfig |
| **Token 估算** | 當前配置的 token 消耗 | 計算文件大小 |
| **Plugin 管理** | 已安裝列表 + 推薦 | 讀取 enabledPlugins |
| **清理建議** | 「刪除 N 個未用 skill 可省 ~XKB」 | 自動計算 |

---

## 維度六：Plugin 生態

### 官方 Plugin 系統

```
.claude-plugin/
├── plugin.json          # 清單（name, version, description）
├── skills/              # 技能
├── agents/              # 子代理
├── hooks/hooks.json     # 事件鉤子
├── commands/            # 舊式命令（相容）
├── .mcp.json            # MCP 配置
├── .lsp.json            # LSP 配置
├── bin/                 # CLI 工具（加入 PATH）
└── settings.json        # 預設配置
```

### ab-tao 整合方案

1. **build-plugin.sh 適配官方格式**：產出 `.claude-plugin/plugin.json`
2. **setup 推薦安裝清單**：

| Plugin | 功能 | 推薦條件 |
|--------|------|----------|
| code-review (官方) | 多 agent 並行審查 | 所有項目 |
| hookify (官方) | 自動生成 hooks | 所有項目 |
| ralph-wiggum (官方) | 會話自動恢復 | 長任務 |
| feature-dev (官方) | 7 階段開發流程 | 新功能開發 |
| LSP (按語言) | 代碼智能跳轉 | TypeScript/Python/Go |
| ECC (社區) | 156 skills + 36 agents | 可選 |

3. **ab-tao 自身發布為 Plugin**：上 marketplace

---

## 維度七：學習系統

### 現有

- Auto Memory（MEMORY.md 前 200 行自動注入）
- Session .jsonl 持久化

### 借鑑 ECC 的 Instincts 系統

```
會話中的修正/模式
        ↓ Stop hook 提取
    Instinct（信心 0.0-1.0）
        ↓ 累積 + 評估
    信心 ≥ 0.8 → 升級為 Skill
    信心 < 0.3 → 自動刪除
```

### 借鑑 GSD 的 STATE.md

```markdown
# STATE.md — 跨會話決策記憶
## 決策鎖定
- ORM: Drizzle（不是 Prisma）— 2026-04-01 確認
- 測試框架: Vitest — 項目初始化時決定

## 阻礙
- Redis 連接在 CI 中不穩定 — 待解決

## 進度
- [x] 用戶認證
- [ ] OAuth 整合
```

---

## 實施路線圖

### Sprint 1（Week 1）— Token 優化 + 配置架構

| 日 | 任務 | 工時 | 效果 |
|----|------|------|------|
| D1 | T1.1 Rules 遷移（刪除 + 搬到 CLAUDE.md 模板） | 2h | **-21KB/session** |
| D1 | T1.2 Agent 描述精簡 ≤150 字 | 1h | 避免截斷 |
| D1 | T1.3 Skill 分類標記（disable-model-invocation + context:fork） | 1h | 描述省 token + 隔離 |
| D2 | CLAUDE.md 模板升級（八大模塊 + 壓縮指令） | 2h | 品質↑ |
| D2 | T1.4 Hook 預處理大輸出 | 1h | 省數萬 token |
| D3 | T1.5 預索引生成 + pre-commit hook | 3h | **-40K token/repo** |

**Sprint 1 成果**：每個 session 基礎 token 從 ~45KB → ~15KB（-67%）

### Sprint 2（Week 2）— Report + Status + Plugin

| 日 | 任務 | 工時 |
|----|------|------|
| D4 | Report 補全（Token 圖 + 清理面板 + Plugin 區塊） | 3h |
| D5 | Status 增強（使用監控 + 30天未用 + 一鍵清理） | 3h |
| D5 | Setup 整合官方 Plugin 推薦安裝 | 2h |

### Sprint 3（Week 3）— 學習系統 + Plugin 生態

| 日 | 任務 | 工時 |
|----|------|------|
| D6 | Instincts 提取（Stop hook + 信心評分） | 2h |
| D6 | build-plugin.sh 適配官方格式 | 2h |
| D7 | ab-tao 自身發布為 Plugin | 2h |
| D7 | 整合測試 + 文檔更新 | 2h |

### 總計

| 指標 | 數值 |
|------|------|
| 總工時 | ~24 小時 |
| Token 節省 | -67%（45KB → 15KB/session） |
| 配置精簡 | Rules 8→2, Agent 描述 -50% |
| 新功能 | Plugin 生態 + 使用監控 + 預索引 + 學習系統 |

---

## 風險與緩解

| 風險 | 機率 | 緩解 |
|------|------|------|
| Rules 遷移後 Claude 行為改變 | 中 | 內容搬到 CLAUDE.md 模板，語義不變 |
| Agent 描述截短導致匹配率下降 | 低 | 前置關鍵詞，保留核心 when to use |
| 預索引過時 | 中 | pre-commit hook 自動更新 |
| Plugin 格式變動 | 低 | 關注官方 changelog |

---

## 成功指標

| 指標 | 現狀 | 目標 |
|------|------|------|
| 基礎 token 消耗 | ~45KB/session | ≤15KB |
| CLAUDE.md 品質 | 無工作流/紅線 | 八大模塊完整 |
| 未使用配置 | 未追蹤 | 30天未用自動標記 |
| Plugin 覆蓋 | 0 | 3+ 官方 plugin |
| Report 完整度 | 70% | 100%（含 Token 圖 + 清理） |
