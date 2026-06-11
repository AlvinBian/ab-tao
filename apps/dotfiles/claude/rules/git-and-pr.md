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
- **不標對齊來源**：commit message 與代碼註釋禁寫「對齊 iOS / Android / Figma / kkday-xxx」等來源備註 — 對齊是默認要求（過程非結果），標出來是噪音。保留技術說明（如 `scale 0.1→1`、`fill:currentColor 驅動變色`），去掉來源句；描述對齊方式的技術詞（如 text 右對齊）不受限。

### Commit 工作流（強制）
- **改後不直接 commit**：任何 Edit / Write 後，先呈現 ① 變更摘要（哪些檔、改什麼）② 驗證清單，等使用者明確確認才 `git commit`（`git add` 同理，非必要不主動 stage）。
- **驗證清單三段**：① 自動化（lint / build / test 指令）② 手動目視（哪個畫面 / 行為）③ Edge case（特殊型別、空資料等）。
- **Wave 串行**：上一個 commit 未獲確認前，禁止開始下一個 Wave 的任何實作；即使後續程式碼已知也須等批准，Wave 間不得並行。
- **Why:** 每個 commit 須是已驗證的 working state；串行防止在未驗證基礎上疊加改動致 rollback 困難。
  
### PR Title 命名
- 標準格式：`[TICKET][SSR][PC][M] 主PR描述`
  - `TICKET`：票號（VM-1482 / KKDAY-1234），必填
  - 平台標籤依**實際改動範圍**附加，順序固定 `SSR → PC → M`：
    - `[SSR]`：**僅 b2c-web 類專案**（PHP server-side render 架構，如 controller 注入 `init_state`）改到 SSR 時加；純前端 / 無 PHP SSR 的 repo 不用此標籤
    - `[PC]`：改動涉及 PC 端（`resources/pc/` production）時加
    - `[M]`：改動涉及 M 端（`resources/mobile/` production）時加
    - 涉及多端則並列（PC + M 都改 → `[PC][M]`）；判定看「動了哪一端的 production 檔」，純共用 helper / 向後兼容擴充不算另一端
  - 範例：
    - `[VM-1482][M] 新訂單明細頁`（純 M）
    - `[VM-1716][SSR][M] Tour 行前/中關懷 — BeforeGo 卡`（PHP SSR + M）
    - `[KKDAY-1234][PC][M] 共用元件升級`（PC + M 皆改）

### Changeset
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

**建立後立即設 tracking**：第一個 commit 後（或開發前）`git push -u origin <branch>` 建立 upstream — 確保 remote backup + PR 推送目標明確；commit 前以 `git branch -vv` 確認有 `[origin/...]` 標示。

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

### Git 操作授權（補 05-security 未列項）

05-security 已規範 `commit` / `push` / `force push` / `gh pr merge` 紅線。此處補其餘破壞性操作：
- `git reset --hard` / `git reset HEAD~N` / `git rebase` / `git stash` / `git stash pop` → 須先呈現指令、等使用者明確確認才執行。
- **本地 merge vs GitHub PR merge（不可混淆）**：
  - ✅ `git merge <branch>`（stack 內分支同步，本地操作）— 使用者說「恢復 merge」「merge 分支」即授權，可執行
  - ❌ `gh pr merge` / 關閉 GitHub PR — 永遠禁止自動執行，只能呈現指令由使用者在 GitHub UI 手動點

### Stack PR 細節

git-spice / gh-stack 完整指令、誤 merge 救援、metadata 驗證 → 跑 `/pr-stack` command。
本檔只記紅線：禁 `gh pr merge`、禁 GitHub auto-merge、force push 前先 `backup/<branch>`。
