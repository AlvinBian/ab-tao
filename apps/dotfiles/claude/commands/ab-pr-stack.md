---
name: ab-pr-stack
description: 顯示當前堆疊 PR 狀態並提示下一動作
---

讀取當前 git 狀態，執行以下步驟：

1. 偵測使用工具（觀察 `pr-stack` dispatcher banner — gh-stack 或 gs）
2. 列出當前 stack 結構（執行 `pr-stack log` 或 `gs log short`，取決於工具）
3. 依當前分支狀態提示下一動作：
   - 在 trunk 上 → 建議執行 `pr-stack-init` 建立 PR-1
   - 在 leaf 上且 parent 已過時 → 建議執行 `pr-stack-sync`
   - 在 leaf 上且 ready to merge → 建議執行 `pr-stack-land`
4. 如有 PR 尚未開啟 → 列出待開 PR 清單與對應 base branch
5. 對照 `docs/audit-checklists.md` 【審查 PR】checklist 逐項提示狀態
