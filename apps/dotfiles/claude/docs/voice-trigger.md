# voice-trigger

中文自然語言 prompt 前置 rewrite hook，將口語化或語音輸入的 prompt 自動重寫為結構化指令，提升 Claude 理解精準度。

## 觸發場景

- 使用語音輸入（Whisper / 系統語音轉文字）後，原始文字含口語停頓詞或語義模糊
- prompt 為流水帳描述（「然後去改一下那個...的邏輯，順便也把測試補一下」）需要結構化
- 非母語使用者輸入夾雜語法錯誤的中英文混合 prompt

> **注意：voice-trigger 目前為 M1.4 PoC 狀態**
> 已實作基礎 rewrite 邏輯，但語義邊界識別仍需人工驗證。
> 建議使用後確認 rewrite 結果是否符合原意，再按確認執行。
> 如發現 rewrite 偏差，請回報至 `issue-tracker` 協助改進規則。

## Usage

hook 自動運作，無需手動觸發。每次 prompt 進入 Claude 前，voice-trigger hook 評估是否需要 rewrite。

```bash
# 臨時關閉 voice-trigger（當前 session）
# 在 prompt 開頭加上 [raw] 前綴：
[raw] 我要的是原始輸入不要 rewrite

# 永久關閉 voice-trigger
# 在 settings.json 設定：
# "_abTao": { "voiceTrigger": false }

# 查看最近 10 次 rewrite 紀錄
cat ~/.claude/.ab-tao/runtime/voice-rewrites.jsonl | tail -10

# 手動測試 rewrite（不執行指令，只預覽 rewrite 結果）
pnpm run d:hooks --test voice-trigger --input "然後去改那個登入的邏輯"
```

rewrite 範例：

輸入（語音轉文字）：
```
然後去改一下那個訂單詳情頁的 loading 邏輯，順便也把測試補一下，要三態那種
```

rewrite 後：
```
目標：修改訂單詳情頁的 loading 邏輯，並補充三態（loading / empty / error）測試。
範圍：
  1. 修改 loading 邏輯（OrderDetail 組件）
  2. 補充 Vitest 三態測試（loading / empty / error state）
```

`settings.json` 設定：
```json
{
  "_abTao": {
    "voiceTrigger": true,
    "voiceTriggerMode": "auto"
  }
}
```

`voiceTriggerMode` 可選值：
- `"auto"`（預設）：自動判斷是否需要 rewrite
- `"always"`：永遠 rewrite（適合全語音輸入工作流）
- `"confirm"`：rewrite 後先顯示結果並詢問確認

## Troubleshoot

**rewrite 後語意偏差（改變了原意）**
立即在下一個 prompt 中說明：「上一條 rewrite 不正確，原意是 X」。voice-trigger 會記錄此次偏差至 `failure-patterns.md`。同時切換至 `"confirm"` 模式，每次 rewrite 手動確認。

**hook 未觸發（prompt 未被 rewrite）**
確認 hook 已啟用：`pnpm run d:hooks --list | grep voice-trigger`。若狀態為 disabled，執行 `pnpm run d:hooks --enable voice-trigger`。

**英文 prompt 也被 rewrite（不預期）**
voice-trigger 預設只處理含中文字元的 prompt。若英文 prompt 被觸發，可能是 prompt 混合了中文標點。在 `settings.json._abTao` 加 `"voiceTriggerLang": "zh-only"` 強制限制。

## Uninstall

```bash
pnpm run d:uninstall --feature voice-trigger
```

移除後：所有 prompt 直接送至 Claude，不經 rewrite；`voice-rewrites.jsonl` 紀錄保留，不自動刪除。
