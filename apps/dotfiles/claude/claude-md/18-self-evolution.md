# 18-self-evolution

failure-patterns append-only 自我演進機制 — 累積糾正信號，規則本體永不修改。

## Session-end Hook 觸發條件

session-end hook 在以下信號出現時，自動抽取並寫入 `failure-patterns.md`：

**強觸發詞**（一出現立即記錄）：
- 「不對」、「錯了」、「重來」
- 「應該是 X 不是 Y」、「應該用 X」
- "that's wrong"、"no, it should be"

**弱觸發詞**（連續出現 2 次以上才記錄）：
- 「再試一次」、「不太對」
- 「換個方式」、「不是我要的」

抽取格式（自動生成）：
```markdown
## {YYYY-MM-DD}

### P-{編號} {問題簡述}
- **觸發**：使用者說「{原始糾正語句}」
- **糾正信號**：{推斷的修正規則}
- **規則映射**：{最相關的 claude-md section}（若能對應）
- **狀態**：active
```

## `failure-patterns.md` 格式規範

路徑：`~/.claude/.ab-tao/corrections/failure-patterns.md`

- 格式：純 Markdown，append-only，**禁止刪除任何條目**
- 每條 pattern 有唯一 `P-{四位數編號}`
- 狀態值：`active`（待處理）/ `reviewed`（人工審核過）/ `archived`（已封存）
- 不得含任何規則本體（只記錄信號，不修改 claude-md/）

## 月度 Dedupe Cron

每月 1 日自動執行（或手動觸發 `pnpm run c:failure-patterns --dedupe`）：
1. 讀取 `failure-patterns.md` 所有 `active` 條目
2. 語義相似度 ≥ 0.85 的條目合併為一，保留最早的 pattern ID
3. 合併後的條目狀態改為 `reviewed`，附上「merged from P-XXXX, P-XXXX」
4. 輸出摘要報告至 stdout

## ADR-002 Invariants（4 條強制不變式）

以下規則在 self-evolution 機制下**永遠成立**，任何 failure-pattern 不得違反：

1. **規則本體不可變**：`claude-md/` 下任何 `.md` 檔案不得被 Claude 自動修改；所有規則變更需人工審核並以 git commit 形式提交。

2. **`failure-patterns.md` 為 append-only**：只允許新增條目，禁止刪除或覆蓋既有條目（dedupe 只改狀態，不刪行）。

3. **糾正信號不等於新規則**：記錄信號是為了累積，累積足夠後才提交 ADR 讓人類決策是否更新規則；Claude 不得自行將信號升格為規則。

4. **溯源完整性**：每個 `failure-patterns.md` 條目必須能追溯至原始 session 的使用者糾正語句；禁止憑推斷記錄不確定的糾正信號。
