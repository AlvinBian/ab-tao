# Recipe：跨專案 Memory 查找歷史決策

## 1. 目標

透過 federated memory 機制，從其他專案的 memory 中查找歷史決策記錄，避免重複踩坑或重新發明已解決的方案。

## 2. 前置條件

- 目標專案（要查找的 memory 來源）已有 `memory/MEMORY.md`（`~/.claude/projects/<encoded>/memory/MEMORY.md`）
- 當前 ab-tao 已初始化（`pnpm run d:setup` 完成）
- 知道目標專案的本地路徑（例：`/Users/alvin/ab-projects/kkday-email-mjml`）

## 3. 步驟

1. **列出已註冊的 federated memory 來源**

   ```bash
   pnpm run c:memory:federated --list
   ```

   若尚未有任何來源，輸出為空清單。

2. **註冊目標專案的 memory 路徑**

   ```bash
   pnpm run c:memory:federated --register-federated <path>
   ```

   範例：

   ```bash
   pnpm run c:memory:federated --register-federated /Users/alvin/ab-projects/kkday-email-mjml
   ```

   指令會自動解析 `~/.claude/projects/` 下對應的 encoded 路徑，並寫入 federated 索引。

3. **確認註冊成功**

   ```bash
   pnpm run c:memory:federated --list
   ```

   預期輸出包含新增的專案路徑與 memory 摘要。

4. **在 Claude Code 中查詢跨專案記憶**

   在 Claude Code 對話中輸入：

   ```
   從 federated memory 找有沒有關於 <主題> 的歷史決策
   ```

   範例：

   ```
   從 federated memory 找有沒有關於郵件模板 MJML 版本升級的歷史決策
   ```

5. **直接讀取目標專案的 MEMORY.md**

   若需快速瀏覽，直接讀取索引：

   ```bash
   # 找到 encoded 路徑（ab-tao paths.mjs 管理）
   cat ~/.claude/projects/<encoded>/memory/MEMORY.md
   ```

## 4. 驗證

- `pnpm run c:memory:federated --list` 輸出中含目標專案路徑
- Claude Code 可在跨專案查詢中返回對應記憶條目
- `federated/index.md` 已更新（若系統維護此索引）

## 5. 相關資源

- [`docs/sync-setup.md`](../sync-setup.md) — 同步設定說明
- [`claude-md/08-memory-system.md`](~/.claude/claude-md/08-memory-system.md) — Memory 三溫層架構
- [`claude-md/09-task-system.md`](~/.claude/claude-md/09-task-system.md) — Tasks / Memory 邊界
