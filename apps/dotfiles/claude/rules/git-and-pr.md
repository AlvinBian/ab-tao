---
name: git-and-pr
description: Git commit / PR 命名 / 堆疊 PR / force push 紅線（含 gh pr merge 禁用）。
paths:
  - "**/.github/**"
  - "**/CHANGELOG*"
  - "**/PULL_REQUEST_TEMPLATE*"
  - "**/COMMIT_EDITMSG"
---

## Git 與 PR 規範

### Commit
- 採用 Conventional Commits（繁體中文 message）
  
### PR Title 命名
- 標準格式：`[TICKET][PROJECT] 主PR描述`
  - `TICKET`：票號（VM-1482 / KKDAY-1234）
  - 範例：`[VM-1482][M] 新訂單明細頁`

### 堆疊 PR（Stacked PR）
- 同一票號拆多支 PR 時，主標題後接 ` - PR-N 子描述`
- 編號從 `PR-1` 起，依依賴順序遞增；子描述需明確切分職責
- 範例：
  - `[VM-1482][M] 新訂單明細頁 - PR-1 BFF base + eventCollection + hotfix B4/B6/B10`
  - `[VM-1482][M] 新訂單明細頁 - PR-2 前端骨架 + 路由 + i18n`
  - `[VM-1482][M] 新訂單明細頁 - PR-3 業務邏輯 + 單元測試`
- PR description 須註明：依賴 `#PR-N`、合併順序、是否含 DB migration

### 分支建立流程（強制）

❗ **新 branch 必須從 `origin/<base>` 建出，禁止從本地 base branch 狀態建立**：

```bash
git fetch origin
git checkout -b <new-branch> origin/<base-branch>
```

**Why:** 本地 base branch 可能落後 origin，直接從本地建會導致 base 缺少他人最新提交，產生多餘 merge commit 或衝突。

### 分支命名
- trunk：`feat/<TICKET>-<slug>/main`（例：`feat/VM-1482-m-new-order-detail/main`）
- leaves：`feat/<TICKET>/{N}-<slug>`（例：`feat/VM-1482/1-bff-base`）
- backup：`backup/<original-branch>`（force push / rebase 前必建）

| 工具 | leaves 自動命名 | trunk 處理 |
|---|---|---|
| git-spice (gs) | 沿用 `feat/<TICKET>/{N}-<slug>` | 需手動 `gs branch create` |
| gh-stack | `<user>/<TICKET>-pr-{N}` | trunk = main，無需自建 |

### 強制規則（違反即破壞 stack）

❌ 禁止 `gh pr merge`（任何 PR、任何情境）
❌ 禁止開啟 GitHub auto-merge
❌ 禁止在 stack 中段直接 `git rebase main`（必走 `git-spice repo sync`）
❌ 禁止 force push 前未建 `backup/<branch>`

✅ PR merge 唯一方式：在 GitHub UI 手動點擊（PR-N merge 後才能 merge PR-N+1）
✅ 每次 merge 後立即執行 `git-spice repo sync` 同步下游

### Stack PR 細節

git-spice / gh-stack 完整指令、誤 merge 救援、metadata 驗證 → 跑 `/pr-stack` command。
本檔只記紅線：禁 `gh pr merge`、禁 GitHub auto-merge、force push 前先 `backup/<branch>`。
