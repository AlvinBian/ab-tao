# Recipe：PR 提交前 AC 覆蓋驗證

## 1. 目標

使用 `/verify` 確認所有 Acceptance Criteria 已被程式碼覆蓋，並透過 `/check --gates` 通過品質閘門，確保 PR 可安全提交。

## 2. 前置條件

- 已透過 `/specify` 產生結構化 spec（含 AC 清單）
- 本地 branch 已完成功能實作，工作樹乾淨（`git status` 無未提交變更）
- `pnpm install` 完成，依賴無缺失

## 3. 步驟

1. **確認 spec 與 AC 清單完整**

   ```bash
   # 查看當前 spec 檔（路徑視專案而定）
   cat .claude/plans/<ticket>-spec.md
   ```

2. **執行 lint 與測試**

   ```bash
   pnpm run lint && pnpm run test
   ```

3. **執行 spec 反向驗證**

   在 Claude Code 中輸入：

   ```
   /verify
   ```

   Claude 會逐條比對 spec 中的 AC，標記覆蓋狀態（✅ 已覆蓋 / ⚠️ 部分覆蓋 / ❌ 未覆蓋）。

4. **補齊缺口**

   針對 ❌ 或 ⚠️ 的 AC，補充實作或測試後重新執行步驟 2–3。

5. **執行 9-gate 品質閘門**

   ```
   /check --gates
   ```

   確認所有 gate 通過（型別、安全、效能、bundle size 等）。

6. **提交並推送**

   ```bash
   git add -A
   git commit -m "feat(<scope>): <繁體中文描述>"
   git push origin <branch>
   ```

## 4. 驗證

- `/verify` 輸出中所有 AC 狀態為 ✅
- `/check --gates` 輸出 `All gates passed`
- `pnpm run test` 全綠，無失敗測試

## 5. 相關資源

- [`docs/walkthroughs/`](../walkthroughs/) — 完整操作教學
- [`commands/verify.md`](~/.claude/commands/verify.md) — `/verify` 指令說明
- [`commands/check.md`](~/.claude/commands/check.md) — `/check --gates` 9-gate 定義
- [`commands/specify.md`](~/.claude/commands/specify.md) — `/specify` spec 產生流程
