# Recipe：從模糊需求到結構化 Spec

## 1. 目標

透過 `/specify` → reviewer agent 審查 → `/verify` 的完整流程，將模糊的功能需求轉化為含 AC（Acceptance Criteria）的結構化 spec，消除實作歧義。

## 2. 前置條件

- 已有初步需求描述（一句話或 PM 文件片段均可）
- 知道功能涉及的主要使用者角色（user / admin / guest 等）
- 了解非目標範圍（non-goals），避免 spec 過度膨脹

## 3. 步驟

1. **執行 `/specify` 產生 spec 草稿**

   在 Claude Code 中輸入：

   ```
   /specify <功能名稱或描述>
   ```

   範例：

   ```
   /specify 訂單明細頁新增退款按鈕，已退款訂單顯示退款狀態
   ```

   Claude 會進行六逼問（What / Who / When / Why / How / Non-goals），產出結構化 spec，包含：
   - 功能目標（1 句話）
   - 使用者角色
   - AC 清單（每條可測試）
   - Non-goals（明確排除項）
   - 技術約束（選填）

2. **確認 spec 內容無歧義**

   檢查每條 AC 是否符合 SMART 原則（具體、可測、有時效）。
   如有模糊項，直接在對話中補充說明，Claude 自動更新 spec。

3. **透過 reviewer agent 進行第二意見審查**

   輸入：

   ```
   請用 reviewer agent 審查這份 spec，重點檢查 AC 完整性與邊界條件
   ```

   reviewer agent 會標出：
   - 遺漏的 AC（error / empty / loading 三態是否涵蓋）
   - 過度寬泛的 AC（需細化）
   - Non-goals 是否足夠明確

4. **根據審查意見修訂 spec**

   逐條處理 reviewer 的回饋，確認最終版 spec。

5. **執行 `/verify` 確認 AC 完整**

   ```
   /verify
   ```

   此時尚無實作，`/verify` 用於確認 spec 本身的結構完整性（所有 AC 格式正確、無重複、可追蹤）。

6. **儲存 spec 至計畫目錄**

   ```bash
   # spec 自動儲存於（路徑由 ab-tao paths.mjs 管理）
   .claude/plans/<ticket>-spec.md
   ```

## 4. 驗證

- spec 文件存在，含目標、角色、AC 清單、Non-goals 四個必要段落
- 每條 AC 有明確的「可以 / 不可以 / 當...時」格式
- reviewer agent 無未解決的 ❌ 問題
- `/verify` 輸出 `Spec structure: valid`

## 5. 相關資源

- [`docs/walkthroughs/`](../walkthroughs/) — 完整操作教學
- [`commands/specify.md`](~/.claude/commands/specify.md) — `/specify` 六逼問框架
- [`commands/verify.md`](~/.claude/commands/verify.md) — `/verify` 反向驗證說明
- [`agents/reviewer.md`](~/.claude/agents/reviewer.md) — reviewer agent 使用方式
