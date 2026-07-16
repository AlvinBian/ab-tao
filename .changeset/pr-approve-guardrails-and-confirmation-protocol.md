---
'@ab-tao/dotfiles': minor
---

PR review 嚴格護欄自動 approve 機制 + 用戶確認協議 + 常駐瘦身收尾

**PR review / auto-approve**
- `gh pr review --approve` 嚴格護欄：6 條件全滿足才自動執行（verdict 僅採信本輪自審、非 deep-tier 敏感路徑、mergeable 非衝突、CI 非失敗態、完成閘門綁定當前 head sha）+ 他人 CHANGES_REQUESTED 安全閥；只 approve 不 merge
- `13-agent-orchestration.md`：review PR 前先查 `~/Kkday/projects/` 對應本地倉庫，找到則 fetch + `git show` 讀 PR-head 實際 source 深度驗證，取代純讀 GitHub diff 的淺 review

**用戶確認協議（新 `claude-md/14-confirmation.md`）**
- 二值決策走 inline `[Y/N]`、多值（3+ 選項）走 AskUserQuestion 彈窗，禁止用連續 Y/N 疊問替代多值決策
- 全域觸發清單（對外通訊 / git-PR / 破壞性操作 / 程式碼品質偏離 / 範圍設定）+ 授權豁免邊界 + Preview>Apply 呈現規範

**其他收尾**
- 修復 §05 斷引用（「見 §13 deep allowlist」該清單實際不存在，改為 §05 自足定義）
- 瀏覽器工具路由收斂為四選一（claude-in-chrome 預設）；Mixpanel `Get-Business-Context` 反制規則（僅分析任務呼叫，避免對話提及縮寫誤觸發）
- always-on 常駐內容瘦身、context-budget hook JSON 化、skills 盤點整併、audit-checklists 結構對齊、3 個靜默失效的 context 注入修復
