# Recipe：標記決策為 Federated 供其他專案查找

## 1. 目標

將當前專案的重要決策記憶條目標記為 federated，讓其他專案可透過跨專案查詢找到這份知識，形成組織級知識庫。

## 2. 前置條件

- 目標記憶條目已存在於當前專案的 `memory/MEMORY.md` 或其 warm 層文件（`{topic}/index.md`）
- 當前 ab-tao 已初始化（`pnpm run d:setup` 完成）
- 確認該決策具備跨專案通用價值（非一次性或高度情境特定的決策不建議 federate）

## 3. 步驟

1. **找到要標記的記憶條目**

   ```bash
   # 查看當前專案 hot 層記憶
   cat ~/.claude/projects/<encoded>/memory/MEMORY.md
   ```

   或在 Claude Code 中：

   ```
   列出當前專案的所有記憶條目
   ```

2. **確認條目標題（完整複製）**

   記憶條目標題通常為 MEMORY.md 中的連結文字，例如：

   ```
   - [Hooks+RTK 整合方案](hooks-rtk-integration/index.md)
   ```

   標題為 `Hooks+RTK 整合方案`。

3. **執行 federate 標記**

   ```bash
   pnpm run c:memory:federated --federate "<完整標題>"
   ```

   範例：

   ```bash
   pnpm run c:memory:federated --federate "Hooks+RTK 整合方案"
   ```

   指令會：
   - 在記憶條目的 frontmatter 加上 `federated: true`
   - 將條目摘要寫入 `federated/index.md`

4. **確認 federated 索引已更新**

   ```bash
   cat ~/.claude/projects/<encoded>/memory/federated/index.md
   ```

   預期輸出含新標記的條目與來源路徑。

5. **通知其他專案可查找**

   其他專案需先執行 `--register-federated` 後才能查找，可參考 `recipe-federated-memory-lookup.md`：

   ```bash
   # 在其他專案中執行
   pnpm run c:memory:federated --register-federated /path/to/current-project
   ```

## 4. 驗證

- `~/.claude/projects/<encoded>/memory/federated/index.md` 存在且含目標條目
- 目標記憶文件的 frontmatter 含 `federated: true`
- 從其他已註冊的專案執行 federated 查詢，可返回此條目

## 5. 相關資源

- [`docs/recipes/recipe-federated-memory-lookup.md`](recipe-federated-memory-lookup.md) — 從其他專案查找 federated memory
- [`claude-md/08-memory-system.md`](~/.claude/claude-md/08-memory-system.md) — Memory 三溫層架構與 federated 設計
- [`docs/sync-setup.md`](../sync-setup.md) — 同步設定說明
