# 流程圖 v3 最佳化分析

根據 phase-execute.mjs + build-plugin.sh 代碼分析，發現以下可簡化的流程。

## 1. 重複步驟問題

### [1a] + [1b] 備份邏輯重複
**現狀**：
- phase-execute.mjs lines 96-125：備份 Claude 配置（commands/agents/rules/hooks.json/settings.json）
- phase-execute.mjs lines 571-586：備份 ZSH 配置（.zshrc/.zshrc.local/.zsh/modules/.ripgreprc）
- 兩者都使用同一套 `backupIfExists()` 邏輯

**建議**：
- 合併成單一「統一備份」步驟
- 參數化備份項目清單
- 減少 Listr2 層級嵌套

### [5] CLAUDE.md 驗證掉落
**現狀**：
- phase-execute.mjs lines 509-552：[5] 生成 CLAUDE.md，輸出到 ~/.claude/projects/{encoded}/CLAUDE.md
- phase-execute.mjs lines 704-713：[10] 驗證時確實檢查了 CLAUDE.md，但輸出訊息較簡略

**建議**：
- 驗證步驟加入「repo 根目錄 CLAUDE.md」檢查（新增功能）
- 驗證時分別統計「本機路徑 → 有 CLAUDE.md」的覆蓋率

---

## 2. 可並行的步驟（目前串列）

### [4b] Stacks + [6] Plugin 可並行
**代碼證據**：
- phase-execute.mjs lines 304-351：[6] Plugin 打包，執行 build-claude-dev-plugin.sh + build-slack-plugin.sh
- phase-execute.mjs lines 373-506：[4] ECC + Stacks，並行執行（concurrent: true, line 505）
- **但** [6] Plugin 在 Group 1 的 concurrent: false 序列中（line 353）

**分析**：
- Plugin 打包依賴：無特定依賴，只需要 repo 目錄檔案
- Stacks 生成依賴：同上，scan.mjs --init 獨立執行
- ECC 融合依賴：同上，只需讀寫 ~/.claude/

**建議**：
- [4] 內部改為：
  ```
  Task 4-1: ECC 融合（不阻塞）
  Task 4-2: Stacks 生成（不阻塞）
  Task 4-3: Plugin 打包（不阻塊，與 4-1/4-2 並行）
  ```
- 或改為：
  ```
  Group A: [1a] → [2] → [3] → [4a] ECC（等待）
           ↓
       [5] CLAUDE.md（依賴 [4a]）
           ↓
       [4b] Stacks（可獨立）
       [6] Plugin（可獨立）
  ```

### [8] .claudeignore + [9] 預索引可合併
**現狀**：
- phase-execute.mjs lines 626-639：[8] 部署 .claudeignore
- phase-execute.mjs lines 640-652：[9] 生成預索引

**分析**：
- 兩者都是「per-repo 迭代」邏輯
- 都依賴同一份 repos 清單
- 都輸出到不同目錄

**建議**：
- 合併為單一「預生成」步驟
- 批量處理 repos，同時產生 .claudeignore + 索引
- 減少兩次迭代的開銷

---

## 3. 多餘的步驟或流程

### build-plugin.sh spinner 重複輸出
**代碼證據** (scripts/build-plugin.sh):
- Line 45-71：定義 `_spin_start()` 和 `_spin_stop()`
- `_spin_stop()` 內部已呼叫 `success()` 或 `warn()` 輸出結果（line 68 & 69）
- 但調用方再次呼叫 `success()` 或 `skip()`

**例子**：
```bash
# Line 86-95
_spin_start "連線 GitHub，檢查更新..."
if git fetch origin "$REPO_BRANCH" --quiet 2>/dev/null; then
  _spin_stop "ok"        # ← 內部已輸出一次 ✔ 連線...
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$REPO_BRANCH")
  if [[ "$LOCAL" != "$REMOTE" ]]; then
    _spin_start "拉取最新版本"
    git pull origin "$REPO_BRANCH" --quiet
    _spin_stop "ok"      # ← 內部已輸出一次 ✔ 拉取...
    success "已拉取最新版本（$(git log -1 --format='%h %s')）"
    # ← 這裡再次輸出！造成重複
```

**影響**：
- 每個 spinner 操作會輸出 2 行訊息
- 視覺混亂，難以追蹤進度

**建議**：
- 方案 A：`_spin_stop()` 只清除 spinner，不輸出
  ```bash
  _spin_stop() {
    kill "$_SPIN_PID" 2>/dev/null
    wait "$_SPIN_PID" 2>/dev/null || true
    printf "\r\033[2K"  # 只清除，不輸出
    unset _SPIN_PID _SPIN_MSG
  }
  ```
- 方案 B：`_spin_stop()` 接受輸出內容參數
  ```bash
  _spin_stop() {
    local msg="${1:-$_SPIN_MSG}"
    local status="${2:-ok}"
    kill "$_SPIN_PID" 2>/dev/null
    wait "$_SPIN_PID" 2>/dev/null || true
    printf "\r\033[2K"
    [[ "$status" == "ok" ]] \
      && echo -e "  ${GREEN}✔${NC} $msg" \
      || echo -e "  ${YELLOW}⚠${NC} $msg"
    unset _SPIN_PID _SPIN_MSG
  }
  ```

---

## 4. 最佳化建議優先順序

### 高優先（立即實施）
1. **build-plugin.sh spinner 重複輸出修復** — 代碼質量問題
2. **[8]+[9] 合併為預生成步驟** — 減少 I/O 迭代次數，提升效能

### 中優先（v3.1 計畫）
1. **[1a]+[1b] 備份邏輯統一** — 簡化代碼結構
2. **[4b] Stacks + [6] Plugin 並行化** — 削減整體耗時 20-30%

### 低優先（架構優化）
1. **重構 runTarget 邏輯** — 目前 [3] Claude 和 [7] ZSH 各調用一次，可統一
2. **預階段快取** — 預生成並快取 Stacks/索引，避免重複計算

---

## 5. 實施影響評估

| 最佳化項目 | 預期耗時節省 | 代碼改動 | 風險等級 | 測試覆蓋 |
|-----------|-----------|--------|--------|--------|
| spinner 修復 | 0%（視覺改進） | 10 行 | 低 | 手動測試 |
| [8]+[9] 合併 | 5-10% | 30 行 | 低 | 單元測試 |
| [1a]+[1b] 統一 | 2-5% | 50 行 | 中 | 集成測試 |
| [4b]+[6] 並行 | 10-20% | 40 行 | 中 | 集成測試 |
| runTarget 統一 | 5% | 100 行 | 高 | 全量測試 |

---

## 6. 流程圖更新總結

### phase-execute.mmd
✅ 更新至 v3 架構，展示 4 大執行組：
- **Group A**：Claude Code + 專案配置（寫 ~/.claude/）
- **Group B**：ZSH 環境（與 A 併行，寫 ~/.zsh/）
- **Group C**：驗證 + 預索引（順序執行，依賴 A+B）

並標記可並行步驟 ✓

### setup-main.mmd
✅ 更新：
- Splash 改為 ab-tao（非 ab-dotfiles）
- 功能選擇移除 Gmail
- 加入 AI 來源選擇步驟

### feature-map.mmd
✅ 更新：
- 移除 Gmail 功能
- CLAUDE.md 加入 .claudeignore 自動生成
- ECC 加入 Skills 分類標記
- 標示新 v3 功能（綠色）

