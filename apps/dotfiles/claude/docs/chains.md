# chains

cross-source chain command 說明，將多個 skill 串接為自動化工作流，以單一命令觸發完整的功能開發或 TDD 流程。

## 觸發場景

- 接到新功能需求後，以 `/chain-product <feature>` 一鍵完成「需求 → spec → 實作」三步流程
- TDD 嚴格模式下，以 `/chain-tdd <feature>` 強制走「spec → test → 實作 → 驗證」四步流程
- 評估 chain 執行路徑時，先用 `--dry-run` 確認每步驟的 skill 映射再執行

## Usage

```bash
# chain-product：三步功能開發流程
/chain-product <feature-description>

# chain-tdd：四步 TDD 流程
/chain-tdd <feature-description>

# 預覽 chain 步驟（不執行）
/chain-product <feature> --dry-run
/chain-tdd <feature> --dry-run

# 從指定步驟恢復執行（中斷後繼續）
/chain-product <feature> --resume-from 2
```

`/chain-product <feature>` 三步流程：
1. **Step 1 → `/specify`**：輸入 feature 描述，產生結構化 spec（AC + non-goals）
2. **Step 2 → `/plan`**：基於 spec 產生實作計畫（DAG 拆分、Wave 切分）
3. **Step 3 → 執行計畫**：按 plan 執行，完成後觸發 `/check` 品質閘門

`/chain-tdd <feature>` 四步流程：
1. **Step 1 → `/specify`**：產生結構化 spec（含測試條件）
2. **Step 2 → `/test --stub`**：先生成 stub test（紅燈狀態）
3. **Step 3 → 實作**：補完實作讓測試通過（綠燈）
4. **Step 4 → `/verify`**：反向驗證 spec AC 覆蓋率，確認不低於 90%

chain 中間步驟失敗時，自動暫停並顯示失敗原因；使用 `--resume-from <step>` 從失敗步驟重試。

## Troubleshoot

**chain 在 Step 2 後停止（plan 未自動執行）**
`/chain-product` 在 plan 產生後會詢問確認再繼續執行。輸入 `y` 或 `yes` 繼續；若不想每次確認，在 `settings.json._abTao` 加 `"chainAutoConfirm": true`（謹慎使用，會跳過人工審核 plan）。

**`/chain-tdd` 在 Step 4 回傳覆蓋率不足（< 90%）**
補充缺失的 test case，再手動執行 `/verify` 確認。不建議降低覆蓋率閾值；若功能邊界案例確實無法測試，在 spec 中標注 `[untestable]` 並說明原因。

**`--resume-from` 後重複執行了已完成步驟**
chains 會讀取 `~/.claude/.ab-tao/runtime/chain-state.json` 確認已完成步驟。若 state 檔損壞，刪除後重新從頭執行：
```bash
rm ~/.claude/.ab-tao/runtime/chain-state.json
```

## Uninstall

```bash
pnpm run d:uninstall --feature chain-product
pnpm run d:uninstall --feature chain-tdd
```

移除後：`/chain-product` 與 `/chain-tdd` 命令停用；組成 chain 的個別 skill（`/specify`、`/test`、`/verify`）不受影響。
