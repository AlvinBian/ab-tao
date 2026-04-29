# adversarial-review

雙模型 adversarial plan review，以 Claude（提案方）+ OpenAI Codex CLI（挑戰方）對同一計畫執行對抗性審查，找出盲點與假設漏洞。

## 觸發場景

- 重大架構決策（如切換狀態管理方案、引入新依賴）需要第二視角驗證
- plan 文件撰寫完成後，在執行前執行 adversarial review 降低風險
- 團隊需要「紅隊」視角找出計畫中的反論與邊界案例

> **前置條件**：本機需安裝 `codex` CLI（OpenAI Codex CLI）
> 確認方式：`which codex`；安裝說明：`https://github.com/openai/codex`
> 若無 `codex` CLI，命令會收到「codex CLI not found」並中止。

## Usage

```bash
# 對指定 plan 文件執行 adversarial review（M3 CLI）
pnpm run c:adversarial --plan ~/.claude/plans/my-feature.md

# 指定挑戰強度（1–3，預設 2）
pnpm run c:adversarial --plan <file> --intensity 3

# 輸出 adversarial report 至指定路徑
pnpm run c:adversarial --plan <file> --output ./adversarial-report.md

# 只執行 Claude 自我挑戰（不依賴 codex CLI）
pnpm run c:adversarial --plan <file> --mode self-only

# 確認 codex CLI 是否可用
pnpm run c:adversarial --check-deps
```

adversarial review 流程：
1. Claude 讀取 plan 文件，提取核心假設（3–7 條）
2. Codex CLI 針對每條假設產生反論（challenge mode）
3. Claude 評估反論有效性，標記 `critical / moderate / minor`
4. 輸出合併報告，含修訂建議

挑戰強度說明：
- `1`：只挑戰明顯假設，約 3 條反論
- `2`（預設）：中度挑戰，約 5–7 條反論
- `3`：全力挑戰，包含邊界案例與惡意使用情境，約 10+ 條反論

## Troubleshoot

**`codex CLI not found`**
按前置條件安裝 codex CLI。若組織環境無法安裝，改用 `--mode self-only`（僅 Claude 自我挑戰，不需 codex）。

**adversarial report 結論互相矛盾**
Claude 與 Codex 可能對同一問題有不同預設。報告中 `critical` 標記的項目需人工判斷採納哪方觀點；`minor` 項目可選擇性忽略。

**plan 文件過長導致 timeout**
建議 plan 文件控制在 500 行以內。超長 plan 先拆分為多個子 plan，分批執行 adversarial review。

## Uninstall

```bash
pnpm run d:uninstall --feature adversarial-review
```

移除後：`c:adversarial` 命令停用；codex CLI 本身不受影響。
