# pua Plugin 使用指南（opt-in）

> **⚠️ 必讀**：pua 安裝後會改變 Claude 在特定 keyword 觸發時的行為，與 ab-tao 核心原則存在衝突。請完整閱讀後再決定是否啟用。

## 概覽

pua 是由 tanweai 開發的第三方 Claude Code plugin，提供：
- 17 個 commands、11 個 skills、3 個 agents、9 個 hooks
- 「高能動性」訓練模式：偵測挫折關鍵字後升級 pressure level
- Session loop 檢測：防止 Claude Code 陷入重複錯誤模式

**預設狀態**：`enabled: false`（需手動 opt-in）

---

## 啟用方式

### 方式 A：修改 plugins.yml（推薦）

```yaml
# apps/dotfiles/claude/plugins.yml
pua:
  enabled: true   # 改為 true
```

然後執行 `pnpm run d:setup`，marketplace 預先已註冊，會自動安裝並執行 mandatorySetup。

### 方式 B：直接安裝（marketplace 已預註冊）

```bash
claude plugin install pua@tanweai/pua
```

**安裝後必須立刻確認 mandatorySetup 已執行**：

```bash
cat ~/.pua/config.json
# 應輸出：{"always_on": false}
```

若不存在，手動建立：

```bash
mkdir -p ~/.pua && echo '{"always_on": false}' > ~/.pua/config.json
```

---

## ⚠️ 衝突說明

### 1. UserPromptSubmit 中文 keyword 高頻誤觸

pua 的 `frustration-trigger.sh` 監聽以下 keyword，觸發後注入 `<EXTREMELY_IMPORTANT>` 壓力升級 block，在 `always_on: true` 時無需使用者確認：

| 高頻誤觸詞 | 常見情境 |
|---|---|
| 加油 | 一般鼓勵 |
| 再試試 | 請求重試 |
| 換個方法 | 方向調整 |
| 不對 | 糾錯 |
| 繼續 | 繼續執行 |
| 試試看 | 嘗試請求 |
| 沒有 | 否定回應 |
| 不行 | 限制聲明 |
| 重試 | 明確重試 |
| 再來一次 | 重複請求 |
| 好吧 | 接受建議 |

**與 ab-tao 原則衝突**：
- `12-exceptions.md`：「禁止靜默切換技術棧 / 隱藏問題」→ pua 在未明確授權時改變行為
- `09-task-system.md`：「禁止自行填補假設」→ pressure escalation 是填補行為

**防禦措施**：維持 `~/.pua/config.json: {"always_on": false}`，由使用者手動觸發 pua 模式。

### 2. Hook 並列執行風險

pua 的 9 個 hooks 寫在 `~/.claude/plugins/pua/hooks/hooks.json`（不在 settings.json），由 Claude Code plugin loader 直接載入，與 ab-tao 7 個 hooks 並列：

| Event | ab-tao hook | pua hook | 風險 |
|---|---|---|---|
| PreCompact | pre-compact.sh | (prompt injection) | 雙注入 |
| SessionStart | session-start.sh | (prompt injection) | 雙注入 |
| Stop | stop.sh | pua-loop-hook.sh **⚠️ no timeout** | Stop 可能被延遲 |
| SubagentStop | — | (prompt injection) | 無衝突 |
| UserPromptSubmit | — | frustration-trigger.sh | keyword 誤觸 |

**pua-loop-hook.sh 無 timeout 風險**：若 `~/.claude/pua/loop-*.md` state file 存在，每次 Stop event 都會被此 hook 延遲。監控殘留：

```bash
ls -la ~/.claude/pua/loop-*.md 2>/dev/null
```

清理殘留（超過 1 小時的 state file）：

```bash
find ~/.claude/pua -name "loop-*.md" -mmin +60 -delete 2>/dev/null
```

---

## 監控與診斷

```bash
# 顯示所有 hooks（含 pua，標 source label 與 ⚠️ no timeout）
pnpm run d:hooks

# 健康診斷（偵測 loop 殘留、config.json 狀態、pua 安裝確認）
pnpm run d:doctor

# 確認 kill switch 狀態
cat ~/.pua/config.json
```

---

## 完整卸載流程

```bash
# 1. 停用 plugin（由 claude CLI 管理）
claude plugin uninstall pua

# 2. 清除 pua 資料目錄
rm -rf ~/.pua

# 3. 清除 pua session state files
rm -rf ~/.claude/pua

# 4. 驗證（應顯示 0 pua 相關問題）
pnpm run d:doctor
```

---

## 與 ab-tao 核心規則的邊界

| pua 行為 | ab-tao 規則 | 狀態 |
|---|---|---|
| 偵測 keyword 後升級 pressure | `12-exceptions.md`：禁止靜默切換 | **衝突** → 須 `always_on: false` |
| Stop 事件注入 loop-check | `09-task-system.md`：明確任務邊界 | **潛在衝突** → 監控 loop-*.md |
| 自動提示重試策略 | `12-exceptions.md`：禁止自行填補假設 | **衝突** → 須 `always_on: false` |
| Session builder-journal 寫入 `~/.pua/` | — | 無衝突 |
