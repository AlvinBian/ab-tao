# 自我糾正補充細節

> 由 `claude-md/15-self-correction.md` 按需指向，需要完整規則時 Read。

## 5. 目標錨定

長工具鏈（>5 tool call）每 Wave 結束自問：
- 還在解決原始問題嗎？
- 使用者要的是 X，我正在做 Y，差多少？

需求出現矛盾 → 立即指出，不自行調和。

## 7. 半成品禁止

交付前自查 3 題：
- 使用者能直接採用嗎？（編譯過？跑得起來？）
- 有未說出的前提嗎？（需要先 install？需要 env？）
- 邊界情況講清楚了嗎？（empty / error / loading）

任一答 No → 補完再交付，或在交付時明說。

## 6. 串流中斷觸發細節

> 對應 `claude-md/15-self-correction.md §6`，這是 §1 Loop 偵測的**前置防禦**（Loop 偵測是失敗後的補救，串流中斷是失敗前的攔截）。

### 觸發後的標準流程

1. **立即停下**：在句末或段落末打住，不完成該 pattern 的輸出
2. **說明原因**：一句話說「偵測到 X，根據 Y 規則需要確認」
3. **提替代方向**（若有）：「如果需要 log 建議改用 [安全做法]」
4. **等使用者確認**：不自行假設同意，明確等待 Y/N 或替代指令

### 各 pattern 細節

**敏感欄位 log**
- 觸發條件：即將輸出含 `token` / `userId` / `password` / `secret` / `apiKey` / `authorization` 字樣的 `console.log`
- 替代方向：`console.log('user authenticated:', !!user.token)`（只 log 布林值）
- 不觸發：`console.log('token:', '[REDACTED]')` 已自我消毒

**範圍爆炸**
- 觸發條件：規劃的 Edit 列表裡，在 5 個以上彼此不相依的無關檔案同時出現
- 三選一標準：
  - 縮小 = 只改原始問題直接相關的檔案，其他列 TODO
  - 維持 = 使用者確認全部要一起改
  - 拆 PR = 分成多個 PR 各自聚焦
- 不觸發：同一功能的 model + view + test 三檔同改（相依，不算無關）

**`any` 型別**
- 觸發條件：型別宣告、函式參數、回傳值的位置出現裸 `any`（`as any` / `: any` / `<any>`）
- 不觸發：有 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 且附理由
- 替代方向：先問「可以用 `unknown` + 型別縮窄嗎？還是有已知型別？」

**破壞性 Bash**
- 觸發條件：命令含 `rm -rf` / `git push --force` / `git commit --no-verify` / `git reset --hard`
- 不觸發情境：使用者本 turn 明說「hotfix 緊急」/ plan frontmatter `autoCommit: true` 已預先授權
- 二次確認格式：「即將執行 `[命令]`，此操作不可逆，確認執行？[Y/N]」

**Edit 失敗重試**
- 觸發條件：Edit 工具回傳 `String not found` 或 `Found N matches`（N > 1）
- 根本問題：失敗代表檔案實際狀態與模型記憶不一致，改 `old_string` 再試只是猜測，會加速偏離
- 標準流程：先 Read 目標檔案 → 找到真實的字串位置 → 才重新組 old_string
- 不觸發：第一次 Edit（失敗前）正常執行；Read 後確認狀態才第二次 Edit 是允許的
- 與 §1 關係：本條是 §1 Loop 偵測的「第 2 次失敗前攔截」，避免進入 3 次 → 強停的循環
