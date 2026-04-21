<code_standards>

## 技術傾向（冷啟動參考）

- Vue 2 / Vue 3（並存）、Nuxt 3、TypeScript、Vite
- Vuex（Vue 2 專案）/ Pinia（Vue 3 專案）
- Node.js、PHP、Tailwind CSS
- iOS / Android WebView、移動端 H5

有明確上下文時以實際代碼為準；無上下文時以此為預設傾向，並於輸出前確認。
需求超出上述技術棧時，先列出棧內最接近替代方案，確認後再輸出跨棧方案。

## 版本管理

涉及 Vue 2/3、Vuex/Pinia、Options/Composition API、PHP/Laravel 版本差異時：
- 優先從 `package.json`、`nuxt.config.ts` 等自動判斷
- 無法判斷時**停止並詢問**，禁止假設
- 禁止版本未確認即輸出版本特定 API，禁止混用不同版本語法
- 推斷時標註：「以下基於上下文推斷，請確認是否符合實際專案」
- 版本特定 API 代碼頂部標註：`// Requires: Vue 3.x / Nuxt 3.x`

## 程式碼規範

1. 完整性：完整可運行代碼，含 import、interface、類型定義，不丟失上下文
2. 類型安全：TypeScript 嚴格 interface/type，禁用 any，優先泛型
3. 異常處理：內建完整錯誤處理與 loading / empty / error 三態
4. 依賴管理：不隨意引入新套件；若必須引入，需說明版本、理由、優缺點與風險
5. 禁止輸出：demo 代碼、過時 API、有安全漏洞的實現、邏輯不完整的片段
6. API 規範：統一回傳 `{ code, message, data }`；分頁統一使用 cursor-based

## 收到代碼的工作流

- **既有代碼**：先分析（說明問題或改進點）→ 確認意圖（修復 / 重構 / 擴充）→ 輸出；禁止直接覆蓋
- **新需求**：確認意圖與範圍 → 需求模糊時主動追問，禁止自行填補假設 → 確認後進入實作

## Git 與 PR 規範

### Commit
- 採用 Conventional Commits（繁體中文 message）

### PR Title 命名
- 標準格式：`[TICKET][PROJECT] 主PR描述`
  - `TICKET`：票號（VM-1482 / KKDAY-1234）
  - `PROJECT`：專案 tag（→ 完整對照見 docs/project-tags.md）
  - 範例：`[VM-1482][M] 新訂單明細頁`

### 堆疊 PR（Stacked PR）
- 同一票號拆多支 PR 時，主標題後接 ` - PR-N 子描述`
- 編號從 `PR-1` 起，依依賴順序遞增；子描述需明確切分職責
- 範例：
  - `[VM-1482][M] 新訂單明細頁 - PR-1 BFF base + eventCollection + hotfix B4/B6/B10`
  - `[VM-1482][M] 新訂單明細頁 - PR-2 前端骨架 + 路由 + i18n`
  - `[VM-1482][M] 新訂單明細頁 - PR-3 業務邏輯 + 單元測試`
- PR description 須註明：依賴 `#PR-N`、合併順序、是否含 DB migration

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

### git-spice 日常指令

```bash
# 查看 stack 狀態
git-spice log short

# 建立新 leaf 分支（自動 base 在當前分支）
git-spice branch create feat/<TICKET>/{N}-{slug}

# 開發完，建立 PR（自動設定 base + 更新 spice metadata）
git-spice branch submit

# 上游 PR merge 後，cascade rebase 所有下游分支
git-spice repo sync

# 推送整個 stack 所有分支的 PR
git-spice branch submit --stack
```

### PR merge 後標準動作

```bash
# 1. 在 GitHub UI 手動 merge PR-N
# 2. 同步 stack（cascade rebase 下游）
git-spice repo sync
# 3. 確認下游分支 base 已更新
git-spice log short
```

### 誤 merge 救援程序

當 PR-N+1 被意外 merge 進 PR-N 的 base branch 時：

```bash
# Step 1：建備份（必做）
git branch backup/{base-branch}-post-merge origin/{base-branch}

# Step 2：找回 pre-merge commit hash
git log --oneline -20 origin/{base-branch}

# Step 3：reset + force push（需 ! 前綴繞過 hook 攔截）
git checkout {base-branch}
git reset --hard {pre-merge-hash}
! git push --force origin {base-branch}

# Step 4：重推 head branch（若被刪除）
git push origin {head-branch}

# Step 5：修復 git-spice metadata（清除舊 PR 綁定）
# 移除 refs/spice/data 中的 change.github.pr 欄位後重建
git push origin refs/spice/data

# Step 6：重建 PR
git-spice branch submit
```

### git-spice metadata 驗證

```bash
# 確認分支綁定了正確的 PR number
git show refs/spice/data:branches/feat/<TICKET>/{N}-{slug}
# 應包含："pr": { "number": XXXXX }

# 若用 gh pr create 建 PR（非 git-spice branch submit）
# → 需手動把新 PR number 寫入 refs/spice/data 再 push
```

### Claude Code 操作限制

| 操作 | 限制 | 解法 |
|---|---|---|
| `git push --force` | pre-tool-bash.sh hook 攔截 | 對話框輸入 `! git push --force ...` |
| `git reset --hard` | Claude Code 確認框 | 彈出確認框時點「允許」 |
| `gh pr merge` | 強制規則禁止 | 永遠不執行 |

### 失敗回復
- stack 衝突 → `git-spice repo sync`（cascade rebase）+ 從 `backup/<branch>` 救援
- pre-push 測試 fail → 修復後再 push；`--no-verify` 僅限 hotfix，常態必過

### 堆疊 PR 工具（優先級 + 自動 dispatch）

優先級（Claude 與開發者皆遵守）：
1. gh-stack（若 PATH 命中，即組織已授權安裝）
2. git-spice (gs)（預設備援，OSS 無授權限制）
3. ghstack + token shim（偏好 commit-based metadata 才用）

統一入口 `pr-stack` 由 ab-tao 部署至 `~/.zshrc.d/conf/40-git.zsh`，自動 dispatch。

</code_standards>
