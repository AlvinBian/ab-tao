---
name: git-and-pr
description: Changeset 建立規範 + Git/PR 慣例指針（動作語義內容住 docs/git-pr-conventions.md）。
paths:
  - "**/.changeset/**"
  - "**/.github/**"
  - "**/CHANGELOG*"
  - "**/PULL_REQUEST_TEMPLATE*"
  - "**/COMMIT_EDITMSG"
---

## Changeset（編輯 .changeset/ 時的規範）

❗ **僅當 PR 直接 merge 到主幹（develop / rc / master）時才需要 changeset**。

- stacked PR 內部（base 為 feature integration branch `feat/<TICKET>-<slug>/main`，非主幹）→ **不需** changeset；待最終 trunk → develop 的那支 PR 才建
- **生成時機**：PR 開好、取得 PR 連結**之後**才建 — 描述末尾須加該 PR 的 `#<PR號>`；禁止提前建（會缺 PR 號）
- 描述格式對齊 PR 標題的平台標籤（`[TICKET][SSR][PC][M]`）
- 範例：
  ```md
  ---
  'kkday-member-ci': minor
  ---

  feat: [VM-1545][M] M 新訂單明細頁預覽 #12403
  ```

## Git / PR 慣例（指針）

commit message 規範、PR title 命名、堆疊 PR、分支建立/命名、stack 強制規則、git 操作授權
→ Read `~/.claude/docs/git-pr-conventions.md`（commit / 發 PR / 開分支時；05-security 亦有同款指針）。

紅線速記（本體在 05）：禁 `gh pr merge` / auto-merge；force push 前先 `backup/<branch>`；stack 中段禁直接 `git rebase main`。
