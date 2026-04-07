# ab-tao Report & Status 完整優化方案

> 為 ab-tao 的配置管理中心（Report HTML 報告 + Status CLI 互動）提出全面升級計畫。
> 文檔日期：2026-04-06 | 優先級標記：P0（阻斷）/ P1（必要）/ P2（增強）/ P3（可選）

---

## 執行摘要

**現狀**：status.mjs 提供終端互動、renderer.mjs 產出 HTML 報告，但功能相對獨立，缺乏深度分析。

**目標**：
- 統一 CLI 和 HTML 的數據源
- 補齊 10+ 個缺失的分析維度
- 提供圖表可視化 + 智能建議
- 支持批量操作 + 配置導出
- 與 Token 消耗、性能診斷整合

---

## A. Report（HTML Dashboard）完整功能清單

### A.1 已有功能

#### Tab 導航（5 個頁籤）
- **概覽 Overview** — 安裝數據、pie/bar 圖、Token 分佈、清理機會、推薦 plugin
- **技術棧 Tech Stacks** — 全量技術列表、使用頻率柱狀圖（Top 20）
- **專案 Repos** — 各 Repo 角色、CLAUDE.md 狀態、技術棧分布、搜尋過濾
- **安裝 Install** — Commands/Agents/Rules/ZSH 模組清單、ECC Source 融合
- **審計 Audit** — 審計日誌、備份位置

#### 圖表引擎
- ECharts 5 整合（pie、bar、doughnut）
- 概覽頁籤自動初始化（healthRing、sessionChart）
- 延遲初始化（技術棧 Tab 切換時）
- Tab 切換事件監聽 + 響應式布局

#### 交互功能
- 搜尋框（.repo-card 按名稱/分類過濾）
- 過濾提示（Found X matches）
- 徽章分類（core/ecc/user 配色方案）

#### 數據聚合
- 配置狀態 + 使用統計合併
- Session 日計數（last 7 days）
- 項目分類（main/temp/tool 角色）
- 安裝/ECC/核心資源來源區分

---

### A.2 缺失功能（需新增）

#### 1. 總覽面板深化 **[P1]**

**缺失項**：
- [ ] **配置健康度評分** —— 0-100 分制，基於以下維度：
  - 已安裝項目使用率（commands/agents）——  40 分
  - Rules 啟用率 —— 15 分
  - Hooks 有效配置 —— 10 分
  - 環境變數完整性 —— 10 分
  - 備份可用性 —— 10 分
  - CLAUDE.md 覆蓋率 —— 5 分
  - 建議：頁面顯示不同分數段的診斷信息

- [ ] **清理機會面板**（已有骨架，需完善）
  - 統計 30 天未使用的 commands/agents
  - 預估 token 節省（已實現 estimateTokenSavings）
  - 跳轉至詳情 UI（可視化清理列表）
  - **一鍵清理按鈕** —— 生成 shell script 或調用 CLI

- [ ] **配置版本時間線**
  - 最近安裝日期 — 每個 command/agent 的 mtime
  - 今年新增項目統計
  - 時間段分布（如 1-3 個月、3-6 個月、6+ 個月）
  - 可視化：條形圖展示不同時間段的項目數

- [ ] **Token 消耗詳細分解**（已有基礎圖表，需增加信息層）
  - 加載順序可視化 —— 哪些組件最先被載入
    - Context window 展示（8K/16K/32K/200K）
    - 當前配置的實際加載順序
    - 優化建議（如移除未使用的 rules 以騰出空間）
  - 每個組件的實時估算（Rules: XX KB, Commands: YY KB）
  - 與 context limit 的對比
  - 警告：若超過推薦閾值，顯示紅色警告

---

#### 2. Commands 面板 **[P1]**

**已有功能**：列表、使用次數、最後使用時間

**缺失項**：
- [ ] **來源標記優化**
  - 已有：core/ecc/user 顏色區分
  - 新增：按來源分組顯示（折疊/展開）
  - 新增：來源統計圖表（pie chart：各來源佔比）

- [ ] **使用頻率柱狀圖**
  - 按使用次數排序的水平柱狀圖
  - Top 15 commands 展示
  - Hover 時顯示詳情（上次使用、首次使用、使用模式）

- [ ] **Deprecated 標記**
  - 檢查 frontmatter `deprecated: true` 標籤
  - 紅色標記 + 警告 icon
  - 顯示替代命令（如有 `deprecated-by: xxx`）
  - 建議清理提示

- [ ] **批量操作工具**
  - ✓ 已有：生成 rm 腳本
  - 新增：
    - 勾選框 + 全選/反選 —— 支持按來源過濾後選擇
    - 「刪除」、「禁用」、「導出」按鈕
    - 實時更新腳本預覽

---

#### 3. Agents 面板 **[P1]**

同 Commands，另加：

- [ ] **Capability 標籤**（from frontmatter `capabilities: [...]`）
  - 顯示：code-generation / analysis / research / automation 等
  - 按 capability 過濾

- [ ] **使用場景建議**
  - 根據 frontmatter `suggested-use-cases` 顯示
  - 快速跳轉到相關 commands/rules

- [ ] **Agent 調用鏈分析**
  - 統計 @agent 的相互調用關係
  - 可視化：力導向圖（force-directed graph）
  - 檢測環形依賴 ⚠️

---

#### 4. Rules 面板 **[P1]**

**已有功能**：列表、啟用/禁用狀態

**缺失項**：
- [ ] **條件載入標記**
  - 檢查 frontmatter `conditional: true / false`
  - 顯示加載條件（如 `conditional-on: file.md`）
  - 警告：未滿足條件的 rules 會被忽略

- [ ] **全量載入模式指示**
  - 標記哪些 rules 必定在初始化時加載
  - 哪些延遲載入（按需）
  - 評分：系統為 N 條必加載 rules 提前預留空間

- [ ] **每個 Rule 的 Token 估算**
  - 文件大小 → token 數
  - 在「Token 分析面板」中詳細展示
  - 標記「大型 rules」（>10KB）

- [ ] **Rule 的相互依賴**
  - 檢查 frontmatter `requires: [rule1, rule2]`
  - 可視化依賴圖

- [ ] **批量操作**
  - 按狀態批量啟用/禁用
  - 按來源過濾後批量刪除

---

#### 5. Skills 面板 **[P2]**

**缺失**：目前完全沒有 skills 管理面板

**新增項**：
- [ ] **技能列表**
  - 來源：~/.claude/skills/ 目錄
  - 顯示：frontmatter `category / tags / difficulty`

- [ ] **載入方式指示**
  - 常駐載入（autoLoad: true）
  - 按需載入（autoLoad: false）
  - 禁用（disabled: true）
  - 圖標區分

- [ ] **Frontmatter 狀態**
  - 檢查 metadata 完整性
  - 缺失字段警告

- [ ] **使用統計**（需擴展 usage-scanner）
  - 統計 `/skill xxx` 命令調用
  - 顯示上次使用時間

---

#### 6. Hooks 面板 **[P1]**

**已有功能**：事件列表、sub-hooks 計數

**缺失項**：
- [ ] **事件分佈圖**
  - 餅圖：各事件類型的 hooks 數量分布
  - 如：PostToolUse (15) / BeforeSave (8) / AfterCompile (5)

- [ ] **觸發頻率統計**
  - 掃描 .claude/.audit 或 hooks 日誌
  - 展示最常觸發的 hooks
  - Hover 時顯示最近觸發時間

- [ ] **超時統計**
  - 檢查 hooks 的 timeout 設定
  - 標記「可能超時」的 hooks（如 dotnet build）
  - 建議合理的 timeout 值

- [ ] **Hook 詳細信息**
  - 展開事件卡片，顯示每個 sub-hook 的詳情
  - 執行命令、超時配置、條件判斷

---

#### 7. Plugins 面板 **[P2]**

**缺失**：目前只顯示已構建的 .plugin 文件

**新增項**：
- [ ] **已安裝列表**
  - 來源：~/.claude/plugins/
  - 檢查 plugin.json 的 metadata
  - 顯示版本、依賴、大小

- [ ] **推薦安裝**（已有模板列表，需動態化）
  - 根據用戶的 rules/commands/agents 智能推薦
  - 如：檢測到有 `code-review` 規則 → 推薦 code-review plugin
  - 一鍵安裝按鈕

- [ ] **Plugin 依賴分析**
  - 檢測 plugin 之間的依賴衝突
  - 可視化依賴圖

---

#### 8. Token 分析面板（新增頁籤） **[P1]**

**完全缺失** —— 重要且複雜，獨立成一個面板

**主要內容**：
- [ ] **Context Window 負荷儀表** —— 量度條/環形圖
  - 當前配置預估 token 消耗
  - Context 限制（8K/16K/32K/100K/200K）
  - 已用 / 總計 + 百分比
  - 顏色：綠（<50%）/ 黃（50-80%）/ 紅（>80%）
  - 警告：若超過某個模型的限制

- [ ] **加載順序可視化** —— 階層時間軸
  - System prompt / Rules / Commands / Agents / CLAUDE.md / Memory
  - 每層的 token 消耗 + 文件數
  - 累進條形圖（堆疊型）

- [ ] **組件詳細表**
  - 各組件的大小、文件數、token 估算
  - 表格排序（按 token 降序）
  - 動作：展開查看具體文件 / 移除此組件估算節省

- [ ] **優化建議引擎** —— AI 驅動
  ```
  ⚠️ 當前配置預估 80K tokens，已超過 GPT-4 建議上限。
  建議：
  1. 禁用 5 個未使用 rules（節省 ~15K）
  2. 清理 3 個 unused commands（節省 ~3K）
  3. 啟用條件載入模式（rules 按需載入）
  ```

- [ ] **成本估算**（可選）
  - 基於 AI_MODEL 設定推算每次 API 調用的成本
  - 展示成本趨勢（若有日誌數據）

---

#### 9. ZSH 面板（優化現有） **[P2]**

**已有功能**：模組狀態 checkbox

**新增項**：
- [ ] **模組狀態詳情**
  - 已安裝 / 未安裝 / 已禁用
  - 版本信息（從 module 的 header 提取）
  - 大小

- [ ] **啟動時間分析**
  - 如有 profiling 數據（`zsh -x -i -c 'exit'`）
  - 展示各模組的載入耗時
  - 標記「慢加載」的模組

- [ ] **插件狀態**
  - 掃描 $ZSH_CUSTOM/plugins/
  - 列出已安裝的第三方插件

- [ ] **Aliases & Functions 統計**
  - 解析已安裝模組，統計 alias / function 數量
  - 提示「可能的命名衝突」

---

#### 10. 專案面板（優化現有） **[P1]**

**已有功能**：Repo 卡片、技術棧、CLAUDE.md 狀態

**新增項**：
- [ ] **CLAUDE.md 覆蓋率儀表**
  - Repos 總數 / 有 CLAUDE.md 的 Repos
  - 百分比 + 趨勢（較上周）
  - 顯示未覆蓋的 Repos 列表
  - 一鍵生成覆蓋報告

- [ ] **.claudeignore 覆蓋率**
  - 同上，統計已配置 .claudeignore 的 Repos

- [ ] **預索引覆蓋**
  - 統計有 .claude/index.json 的 Repos
  - 顯示索引大小、更新時間

- [ ] **CLAUDE.md 質量審計**
  - 掃描每個 CLAUDE.md，檢查：
    - 是否有 frontmatter
    - 是否包含技術棧信息
    - 是否包含 project structure
  - 評分：綠（完整）/ 黃（部分）/ 紅（缺失）

---

#### 11. 趨勢面板（新增頁籤） **[P2]**

**完全缺失** —— 需要時間序列數據存儲

**新增項**：
- [ ] **7 天 / 30 天 session 趨勢線圖**
  - X 軸：日期
  - Y 軸：session 數
  - 趨勢線 + 同比數據

- [ ] **成本趨勢**（需 audit 數據）
  - Token 消耗趨勢
  - API 成本折線圖
  - 預測：下月預估消耗

- [ ] **使用模式分析**
  - 最活躍的時段（小時分布）
  - 最常用的 commands / agents
  - 項目熱度排序（session 數）

- [ ] **性能指標**（if 有 hooks 審計）
  - 平均 hook 執行時間
  - P95 / P99 延遲
  - 慢 hook 告警

---

#### 12. 診斷面板（新增頁籤） **[P2]**

**缺失**：目前沒有系統性診斷

**新增項**：
- [ ] **環境檢查清單**（已有終端版，需 HTML 版）
  - [ ] 必需環境變數
  - [ ] 推薦環境變數
  - [ ] 可選特性

- [ ] **配置衝突檢測**
  - 檢查 frontmatter 衝突（同名 rules）
  - 檢查 permission 過度許可
  - 檢查環形依賴（rules / agents / commands）

- [ ] **性能基準**
  - 目標：識別配置中的效率瓶頸
  - 如：「Rules 較多（>30）可能降低初始化速度」
  - 建議：條件載入 / 分離出常駐/按需

---

## B. Status（CLI 互動）完整功能清單

### B.1 已有功能

#### 主菜單選項
1. **📋 查看詳情** — 展開 15 個分類（commands/agents/rules/hooks/zsh/permissions/claudemd/plugins/slack/ai/sessions/cleanup/env/disk）
2. **⚙️ 管理配置** — 增刪啟用 6 個分類（commands/agents/rules/hooks/zsh/permissions/claudemd）
3. **📊 生成 HTML 報告** — 啟動瀏覽器
4. **🔄 重新掃描** — 更新數據
5. **👋 退出**

#### 詳情查看
- 每個分類的列表展示（帶著色 / 統計信息）
- 清理機會特化功能（30 天未使用檢測、估算節省）
- 環境變數健康檢查

#### 管理操作
- Commands / Agents：刪除 / 從 ECC 新增
- Rules：啟用/禁用 / 刪除 / 從 ECC 新增
- Hooks：移除事件
- ZSH：安裝/卸載模組
- Permissions：新增/刪除規則
- CLAUDE.md：刪除

---

### B.2 缺失功能（需新增）

#### 1. 分面板的管理互動 **[P1]**

**目標**：讓 HTML 面板中的操作都能在 CLI 中完成

- [ ] **Commands / Agents 管理擴展**
  - ✓ 已有：刪除、新增
  - 新增：
    - 批量刪除（勾選多個）
    - 批量禁用（新增 `.disabled` 後綴約定）
    - 搜尋/過濾（按來源、使用率）
    - 導出清單（JSON / CSV）

- [ ] **Rules 管理擴展**
  - ✓ 已有：啟用/禁用/刪除/新增
  - 新增：
    - 查看 rule 詳情（frontmatter + 首行摘要）
    - 批量操作（如「禁用所有 ECC rules」）

- [ ] **Skills 管理**（新增）
  - 列出已安裝 skills
  - 切換載入模式（常駐 / 按需 / 禁用）
  - 查看技能詳情

- [ ] **Plugins 管理**（新增）
  - 列出已安裝 plugins
  - 安裝推薦 plugins（一鍵）
  - 卸載 plugins
  - 檢查依賴衝突

---

#### 2. Token 實時顯示 **[P1]**

**目標**：在 CLI 中展示 token 消耗預估

- [ ] **當前配置 Token 統計**（新菜單項）
  ```
  當前配置 Token 消耗預估
  ─────────────────────────
  Rules      : 45.2 KB (~11,300 tokens)
  Commands   : 12.5 KB (~3,125 tokens)
  Agents     : 28.0 KB (~7,000 tokens)
  CLAUDE.md  : 5.3 KB (~1,325 tokens)
  Memory     : 3.1 KB (~775 tokens)
  ─────────────────────────
  總計       : 94.1 KB (~23,525 tokens)
  
  Context 利用率：23,525 / 200,000 (11.8%) ✓ 安全
  
  建議：啟用條件載入，減少初始化時間
  ```

- [ ] **模型特定的警告**
  - 基於 AI_MODEL 環境變數
  - 如 claude-haiku：warning if > 50K tokens
  - 如 claude-opus：safe up to 150K tokens

---

#### 3. 配置評分 + 自動修復建議 **[P1]**

**目標**：智能診斷配置問題並提出修復建議

- [ ] **配置評分詳情**（新菜單項）
  ```
  配置健康度詳細評分
  ─────────────────────────
  [████████░] 80/100  良好
  
  細項評分：
  ✅ Commands 使用率       : 65% (+25 分)
  ✅ Agents 使用率         : 70% (+20 分)
  ✅ Rules 啟用率          : 100% (+15 分)
  ⚠️  Hooks 配置完整度      : 60% (+6 分)
  ✅ 環境變數完整          : 100% (+10 分)
  ❌ 備份狀態              : 3 天未備份 (-5 分)
  ⚠️  CLAUDE.md 覆蓋        : 45% 項目 (+2 分)
  
  修復建議：
  1️⃣ 清理 8 個 30 天未使用的 commands/agents（節省 ~8KB）
  2️⃣ 啟用剩餘 2 個 rules（無成本，改進覆蓋）
  3️⃣ 執行備份：pnpm run d:backup
  ```

- [ ] **自動修復工具**
  - 提示「是否自動執行建議？」
  - 逐步確認（Y/n）
  - 執行後顯示修復結果

---

#### 4. 批量操作增強 **[P1]**

**目標**：支持複雜的多選和批量操作

- [ ] **多層過濾選擇**
  ```
  管理 Commands
  ─────────────────────────
  過濾選項：
  按來源 (c)ore / (e)cc / (u)ser / (a)ll: [a]
  按使用率 (u)nused / (l)ow / (m)edium / (a)ll: [u]
  
  [選擇結果：8 個 commands]
  
  操作：(d)elete / (d)isable / (e)xport / (c)ancel: [d]
  
  確認刪除 8 個 commands 並備份到 dist/backup/？(y/n)
  ```

- [ ] **批量導出功能**
  - JSON 格式：便於版本控制 / 團隊分享
  - CSV 格式：便於 Excel 分析
  - Markdown 格式：便於文檔

---

#### 5. 配置快照導出 **[P1]**

**目標**：保存完整的配置狀態，便於恢復 / 對比 / 分享

- [ ] **導出當前配置**（新菜單項）
  ```
  導出配置快照
  ─────────────────────────
  快照名稱 [config-2026-04-06]: config-after-cleanup
  
  包含內容：
  ✓ Commands (12/50)
  ✓ Agents (8/20)
  ✓ Rules (25/40 啟用)
  ✓ Hooks (3 個事件)
  ✓ ZSH 模組 (6/10)
  ✓ Permissions (8 rules)
  
  快照已保存：dist/snapshots/config-after-cleanup.json
  ```

- [ ] **恢復配置**
  - 列出可用快照
  - 顯示差異預覽（+- 對比當前）
  - 確認恢復

---

#### 6. 與開發者配置對比 **[P2]**

**目標**：支持團隊標準配置對標

- [ ] **對比選項**
  ```
  對比配置
  ─────────────────────────
  對比對象：
  (1) 標準配置 (shared config)
  (2) 團隊平均配置
  (3) 另一個快照文件
  
  選擇：[1]
  ```

- [ ] **對比結果展示**
  ```
  差異分析 vs 標準配置
  ─────────────────────────
  缺失項（標準但你沒有）：
    - 3 個 rules
    - 1 個 agent
  
  額外項（你有但標準沒有）：
    + 5 個自訂 commands
    + 2 個自訂 rules
  
  使用率差異：
    Commands：65% (團隊平均：72%)
    Agents：   70% (團隊平均：68%)
  
  建議：考慮添加 x/y/z 3 個標準 rules
  ```

---

#### 7. 智能清理模式 **[P2]**

**目標**：比現有清理更智能、更細粒度

- [ ] **清理策略選項**
  ```
  清理配置
  ─────────────────────────
  選擇清理範圍：
  (1) 激進：刪除所有未使用項 (30 天+)
  (2) 平衡：刪除長期未使用項 + 警告舊項目
  (3) 保守：僅提示，不自動刪除
  (4) 自訂：手動選擇項目
  
  選擇：[2]
  ```

- [ ] **清理預覽 + 成本/收益分析**
  ```
  清理預覽 [平衡模式]
  ─────────────────────────
  待刪除：
    ✓ 5 個 commands（最後使用：60+ 天前）
    ✓ 2 個 agents（最後使用：45+ 天前）
  
  成本/收益：
    節省 Token：~8.5 KB (~2,125 tokens)
    節省磁碟：~850 B
    風險：低（這些項目 6 個月未使用）
  
  執行清理？(y/n)
  ```

---

## C. 圖表規劃（ECharts 5）

### C.1 現有圖表

| 圖表 ID | 類型 | 位置 | 數據源 | 交互 |
|--------|------|------|--------|------|
| healthRing | doughnut | 概覽右側 | overview.healthPct | hover 提示 |
| sessionChart | bar | 概覽 Sessions 卡片 | sessions.dailyCounts | click 鑽進日期 |
| chart-overview-pie | pie | 概覽左 | 安裝項目統計 | click legend 篩選 |
| chart-overview-bar | bar | 概覽右 | 項目數量統計 | 同上 |
| chart-tech-freq | bar | 技術棧 Tab | 頻率排序 Top 20 | click 過濾 repos |
| chart-token-distribution | pie | 概覽 Token 卡片 | token 消耗 | hover 顯示百分比 |
| chart-ecc-install | pie | 安裝 Tab | ECC source 融合 | 同上 |

---

### C.2 缺失圖表（需新增）

#### 1. Token 分析頁籤

**chart-context-load** | stacked bar | Token 面板頂部
- 堆疊柱：Rules / Commands / Agents / CLAUDE.md / Memory
- Hover：展示各層的具體數據
- 警告線：模型特定的推薦上限
- 數據源：estimateTokenSize 計算

**chart-token-waterfall** | waterfall | 可選
- 展示 token 累進消耗
- 實現難度 ⭐⭐

**chart-context-utilization** | gauge | Token 面板
- 儀表盤：當前 / 總計
- 顏色漸變：綠 -> 黃 -> 紅
- 數據源：當前配置 token / context limit

**chart-hook-distribution** | pie | Hooks 面板
- 各事件類型的 hooks 數量分布
- Click legend 展開該事件的詳細子 hooks

**chart-hook-frequency** | bar | Hooks 面板
- 最常觸發的 hooks 排序
- 需要額外的觸發日誌收集

---

#### 2. 專案面板

**chart-claude-md-coverage** | progress bar
- 簡單的進度條：已覆蓋 / 總計

**chart-repo-role-distribution** | pie
- 主力 / 臨時 / 工具的比例

---

#### 3. 趨勢頁籤

**chart-session-trend** | line
- 7 天或 30 天的 session 數趨勢線
- 同比參考線
- 預測線（optional）

**chart-command-usage-trend** | bar
- Top 10 commands 的週使用趨勢

---

### C.3 圖表交互約定

| 交互類型 | 實現 | 備註 |
|--------|------|------|
| Hover | echart tooltip | 統一配色 + 資訊輸出 |
| Click | 鑽進 / 篩選 | 如 click 技術棧 → 篩選 repos Tab |
| 響應式 | resize listener | 保證移動設備友好 |
| 動畫 | echarts animation | 頁面加載時過渡 |

---

## D. 實施路線圖

### 第一階段：基礎增強（P0/P1，預估 20 工時）

**目標**：完成最關鍵的功能，讓 HTML 報告和 CLI 更實用

**優先級排序**：

| 編號 | 功能 | 模組 | 工時 | 依賴 | 風險 |
|------|------|------|------|------|------|
| 1.1 | 配置健康度評分（0-100） | usage-scanner / renderer | 3h | - | 低 |
| 1.2 | Token 分析面板 | renderer / formatters | 4h | 1.1 | 低 |
| 1.3 | Commands / Agents 批量操作 CLI | status.mjs | 3h | - | 低 |
| 1.4 | 批量管理 UI（checkbox 全選） | renderer | 2h | - | 低 |
| 1.5 | Rules 條件載入指示 | renderer / formatters | 2h | - | 低 |
| 1.6 | 配置快照導出 | status.mjs | 2h | - | 低 |
| 1.7 | 清理建議引擎 | usage-scanner / status.mjs | 2h | 1.1 | 低 |

**交付物**：
- [ ] 健康度評分算法 + 文檔
- [ ] Token 分析 Tab 完整實現
- [ ] CLI 批量操作菜單
- [ ] 快照導出/恢復功能
- [ ] 清理建議引擎（文本提示）

**驗證**：
- `pnpm run d:status --report` 打開新面板，無 JS 錯誤
- `pnpm run d:status` 進行批量操作，成功導出 JSON
- Token 估算與實際負荷對齊（±10%）

---

### 第二階段：可視化增強（P1/P2，預估 15 工時）

**目標**：完成所有缺失的圖表，提高 HTML 報告的洞察力

| 編號 | 功能 | 圖表類型 | 工時 | 依賴 | 備註 |
|------|------|--------|------|------|------|
| 2.1 | Hook 分佈圖 | pie | 2h | - | 低 |
| 2.2 | Hook 觸發頻率圖 | bar | 2h | 需日誌 | 中 |
| 2.3 | 項目覆蓋率進度條 | progress | 1h | - | 低 |
| 2.4 | 趨勢線圖（7/30 天） | line | 2h | 數據存儲 | 中 |
| 2.5 | Command/Agent 使用頻率圖 | bar | 2h | - | 低 |
| 2.6 | Rule 依賴可視化 | directed graph | 3h | 解析 frontmatter | 高 |
| 2.7 | Agent 調用鏈圖 | force-directed | 3h | 同上 | 高 |

**交付物**：
- [ ] 7 個新圖表完整實現
- [ ] 圖表交互測試（hover/click/resize）
- [ ] 響應式適配（mobile/tablet）

**驗證**：
- 所有圖表在不同屏幕尺寸下正常渲染
- Echarts 實例無內存洩漏
- 圖表點擊事件正確觸發

---

### 第三階段：AI 智能化（P2，預估 12 工時）

**目標**：整合 AI 診斷、自動修復建議、性能預測

| 編號 | 功能 | 工時 | 依賴 | 風險 |
|------|------|------|------|------|
| 3.1 | 配置評分詳細診斷 CLI | 3h | 1.1 | 低 |
| 3.2 | 自動修復建議系統 | 3h | 3.1 | 中 |
| 3.3 | 成本預測（token/API） | 2h | 1.2 | 中 |
| 3.4 | 性能基準對標 | 2h | 2.5 | 中 |
| 3.5 | 團隊配置對比 | 2h | 1.6 | 低 |

**交付物**：
- [ ] 配置評分詳情頁面（HTML + CLI）
- [ ] 自動修復交互流
- [ ] 成本預測模型
- [ ] 對比功能完整實現

---

### 第四階段：插件/技能生態（P2/P3，預估 10 工時）

**目標**：完善 skills、plugins、hooks 的管理

| 編號 | 功能 | 工時 | 優先級 |
|------|------|------|--------|
| 4.1 | Skills 面板（HTML） | 2h | P2 |
| 4.2 | Skills 管理 CLI | 2h | P2 |
| 4.3 | Plugins 推薦引擎 | 3h | P2 |
| 4.4 | 依賴衝突檢測 | 2h | P2 |
| 4.5 | ZSH 啟動時間分析 | 1h | P3 |

**交付物**：
- [ ] Skills 面板完整實現
- [ ] Plugin 一鍵安裝
- [ ] 衝突檢測告警

---

### 第五階段：數據持久化和歷史（P3，預估 8 工時）

**目標**：支持趨勢分析、性能基準

| 編號 | 功能 | 工時 | 備註 |
|------|------|------|------|
| 5.1 | 審計日誌結構設計 | 2h | 定義 schema |
| 5.2 | 每日快照採集 | 2h | cron + 存儲 |
| 5.3 | 趨勢分析查詢 API | 2h | SQL / indexing |
| 5.4 | 成本趨勢圖表 | 2h | 基於快照 |

**交付物**：
- [ ] 審計日誌 schema
- [ ] 自動採集腳本
- [ ] 趨勢查詢工具

---

## E. 實施注意事項

### E.1 技術架構

#### 數據流
```
使用場景掃描 (usage-scanner)
         ↓
配置狀態收集 (config-status)
         ↓
聯合轉換 (collectFullStatus)
         ↓
├─ HTML 報告 (renderer + formatters)
├─ CLI 展示 (status.mjs 菜單)
└─ JSON 導出 (快照)
```

#### 新增模組
- `lib/report/token-analyzer.mjs` —— Token 估算和分析
- `lib/report/health-scorer.mjs` —— 配置評分引擎
- `lib/report/suggestion-engine.mjs` —— 修復建議
- `lib/core/audit-logger.mjs` —— 審計日誌（可選）

---

### E.2 代碼規範

#### 函數簽名約定
```javascript
// 分析類（返回對象，便於 HTML 和 CLI 共用）
export function analyzeTokens(data) => {
  commands: { kb, tokens, files },
  agents: { ... },
  rules: { ... },
  ...
}

// 渲染類（HTML 片段）
export function renderTokenPanel(analysis) => string

// CLI 類（Promise，返回用戶反饋）
export async function manageTokens(currentData) => changedData | false
```

#### 註釋規範
- 所有新函數須有 JSDoc 註釋
- 複雜算法（如評分）須有中文邏輯說明
- 魔數須解釋（如 threshold = 80）

---

### E.3 性能考慮

#### 掃描優化
- [ ] 使用 Map 而非 array.find（O(1) vs O(n)）
- [ ] 緩存 frontmatter 解析結果（避免重複正則）
- [ ] JSONL 掃描：大文件只讀最後 1000 行

#### 圖表渲染
- [ ] 延遲初始化（Tab 切換時才渲染）
- [ ] 限制圖表數據點（Top 20 而非全量）
- [ ] 防止內存洩漏：銷毀舊 ECharts 實例

---

### E.4 測試策略

#### 單元測試
```javascript
// lib/report/health-scorer.test.mjs
test('評分計算', () => {
  const data = { commands: [{ count: 10 }, { count: 0 }], ... };
  const score = scoreHealth(data);
  expect(score).toBeGreaterThan(0);
  expect(score).toBeLessThanOrEqual(100);
});
```

#### 集成測試
- [ ] `pnpm run d:status --report` 無 JS 異常
- [ ] Token 估算誤差 < 15%
- [ ] 各面板 50 個項目以下的性能 < 2s

#### 手動驗證清單
- [ ] 不同屏幕尺寸下的布局
- [ ] 深色/淺色主題（如適用）
- [ ] 導出文件的格式正確性

---

## F. 長期演進方向（Post-Phase 5）

### F.1 機器學習整合
- 基於歷史使用模式預測 command 廢棄
- 自動推薦 rules 條件載入時機

### F.2 團隊協作
- 支持多用戶配置對標
- 共享最佳實踐快照

### F.3 Cloud 可視化
- 遠程配置同步 + 對比
- 跨設備配置一致性

---

## G. 文件變更預計

### 新增文件
```
apps/dotfiles/lib/report/
  ├── token-analyzer.mjs      (Token 分析模塊)
  ├── health-scorer.mjs       (評分引擎)
  └── suggestion-engine.mjs   (修復建議)

apps/dotfiles/lib/core/
  └── audit-logger.mjs        (審計日誌，可選)

apps/dotfiles/docs/
  └── REPORT-STATUS-PLAN.md   (本文檔)
```

### 修改文件
```
apps/dotfiles/lib/report/
  ├── renderer.mjs            (+8 個新圖表、+2 個新面板)
  ├── formatters.mjs          (+8 個新渲染函數)
  └── index.mjs               (+3 個導出)

apps/dotfiles/lib/core/
  ├── usage-scanner.mjs       (+評分、+token 估算）
  └── config-status.mjs       (適配新字段)

apps/dotfiles/bin/
  └── status.mjs              (+4 個新菜單項、+批量操作)
```

---

## H. 成功指標

| 指標 | 目標 | 驗證方法 |
|------|------|--------|
| 報告加載時間 | < 3s（含掃描） | `time pnpm run d:status --report` |
| 配置評分準確度 | ±5% error | 人工評估 vs 機器評分 |
| Token 估算誤差 | < 15% | 實際 API 使用 vs 預估 |
| 圖表渲染性能 | < 500ms | 瀏覽器 DevTools |
| 用戶滿意度 | 3/5 以上 | 內部反饋問卷 |

---

## I. 相關資源

### 外部庫
- **ECharts 5** —— 已整合，無需新增
- **lodash-es** —— 已整合
- **clack/prompts** —— 已整合

### 內部模塊依賴
- `@ab-tao/commons/paths` —— ECC_DIR 等常量
- `config-classifier.mjs` —— ALL_COMMANDS 等列表
- `descriptions.mjs` —— command/agent/rule 描述

---

## J. 審批清單

- [ ] 方案架構確認（stakeholder review）
- [ ] 優先級排序確認
- [ ] 數據存儲方案確認（if Phase 5）
- [ ] 測試覆蓋率目標確認
- [ ] 交付時間表確認

---

## 附錄：術語定義

| 術語 | 定義 |
|------|------|
| **Token** | AI 模型輸入的最小單位，~4 字元 = 1 token |
| **Context** | 單次 API 請求的完整上下文，包括系統提示/規則/當前會話 |
| **Stale** | 30 天未使用的配置項 |
| **Frontmatter** | Markdown 文件頂部的 YAML 元數據 |
| **ECC** | External Configuration Commons —— ab-tao 提供的標準配置庫 |
| **Conditional Loading** | 按條件動態載入規則/命令（節省初始化時間） |
| **Hook** | Claude Code 事件回調（如 PostToolUse） |

---

**文檔版本**：v1.0  
**上次更新**：2026-04-06  
**下次評估**：Phase 1 完成時
