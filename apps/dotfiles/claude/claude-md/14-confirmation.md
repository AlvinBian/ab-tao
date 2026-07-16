<confirmation_protocol>

## 核心機制：二值走 inline、多值走彈窗

任何需要使用者拍板的決策，一律照「選項數量」分流；禁止自行揣測預設值後靜默執行。

| 決策型態 | 呈現方式 | 使用者回覆 |
|---|---|---|
| **二值**（是/否、做/不做、繼續/中止） | 對話中 inline 提問，末行 `👉 是否 XXX？[Y/N]` | `Y` / `Yes` / `y` / `是` = 確認；`N` / `No` / `n` / `否` = 否決 |
| **多值**（3+ 互斥選項，或需複選） | **必用 AskUserQuestion 工具彈出勾選**，禁止用連續 Y/N 疊問替代 | 於彈窗勾選後提交 |

**分流判定**
- 選項恰為 2 且互斥 → 二值 → inline `[Y/N]`（不彈窗，較輕）
- 選項 ≥3 互斥 → 多值 → AskUserQuestion 單選
- 多個非互斥項需同時取捨（如「要啟用哪些」）→ AskUserQuestion `multiSelect: true`
- 一題選項 >4 → 先分組或拆兩題（AskUserQuestion 單題上限 4）
- 有推薦選項 → 放第一個並標「(推薦)」，附一句理由

**回覆解讀（強制）**
- 僅 `Y` / `Yes` / `是` 系列視為確認；空白、含糊（「嗯」「你看著辦」「處理一下」）**≠ 確認** → 預設不執行，需要時再澄清
- 收到明確確認前，禁止執行被 gate 的動作；禁止「先做再問」
- 被否決（N）後：不重試同一方案，改問卡點或提**結構不同**的替代（呼應 §15 loop 偵測）

## 必須觸發確認的情境（全域，不限 Slack）

以下動作在**未預先授權**時一律先確認：

**對外通訊**
- Slack 傳送（任何 send 工具）→ 呈現完整草稿 + `[Y/N]`
- /feedback（附 session transcript，有外洩風險）→ 說明附帶內容後 `[Y/N]`
- 對外 email / PR comment / 任何發佈到外部服務的內容 → 預覽 + `[Y/N]`

**Git / PR**
- `git commit` / `git push` → 呈現 diff + `[Y/N]`
- Force push → 先 `git branch backup/<original>` 再 `[Y/N]`
- `gh pr merge` → **硬禁，無確認豁免**（唯一方式 = GitHub UI 手動）

**破壞性 / 敏感操作**
- 刪除、覆蓋「非本人建立或未讀過」的檔案 → 先看內容再 `[Y/N]`
- Bash 含 `rm -rf` / `--force` / `--no-verify`（非明說 hotfix）→ `[Y/N]`
- 支付、權限變更、資料刪除、DB migration → 二次確認

**程式碼品質偏離**
- 宣告 `any` 型別（無 `// eslint-disable` 附理由）→ 回問允許範圍
- 跳過型別檢查 / lint / 測試

**範圍與設定**
- 單次 Edit 觸及 5+ 無關檔（範圍爆炸）→ **多值**：AskUserQuestion（縮小範圍 / 維持範圍 / 拆 PR）
- 方案選型、技術棧取捨 → **多值**：AskUserQuestion，每選項附成本/風險
- 修改設定檔禁改清單（`settings.json`、`memory/`、`projects/`、`state.json`）→ 需使用者明確點名

## 授權豁免（已授權則不再問）

滿足任一即視為已授權，直接執行、不重複確認：
- 當前 turn 的動作語義已明示（「commit 這個」「發送這條 Slack」「刪掉它」）
- plan frontmatter（`autoCommit: true` 等）/ CLAUDE.local.md 預先聲明
- 自動化迴圈（/loop、ralph-loop、CI agent runs）

**邊界**
- 授權**僅限當前 context / 當前動作**，不外溢到下一個動作或下一個 context
- 含糊指令（「弄好它」「處理一下」「順便」）≠ 授權
- 起草 ≠ 發送；規劃 ≠ 執行

## 呈現規範（Preview > Apply）

- 破壞性 / 對外操作一律「先預覽、後執行」，禁止自動 apply
- **二值**：確認前附完整草稿 / diff / 影響清單，讓使用者看得到後果
- **多值**：每個選項附一句後果（成本 / 風險 / 適用場景），利於判斷

</confirmation_protocol>
