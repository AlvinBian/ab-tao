# claude-context-init

語義代碼搜尋初始化 — 在 session 開始時確保當前 codebase 已建立索引，讓 `search_code` 可立即使用。

## 觸發條件

- 使用者首次提出語意搜尋請求：「幫我搜尋 codebase」「找一下 X 的實現」
- 手動：「初始化 claude-context」「重建代碼索引」

> ⚠️ 本 skill **不會**在 session-start 自動觸發（Claude Code hooks 無法載 skill）；
> 每次新 repo 第一次需使用者顯式說「初始化代碼索引」。

## 執行步驟

1. **確認 MCP 可用**：呼叫 `get_indexing_status(cwd)` — 若 MCP 不可用（LM Studio / Milvus 未啟動），跳出並提示使用者執行 `pnpm run c:locals --start`

2. **檢查既有索引**：
   - 狀態為 `indexed` 且 `lastModified` 在 10 分鐘內 → 直接跳過，無需重建
   - 狀態為 `indexing` → 等待完成（最多 60s），再繼續
   - 狀態為 `not_indexed` 或 `error` → 執行步驟 3

3. **建立索引**：
   ```
   index_codebase(cwd)
   ```
   等待完成後確認 `get_indexing_status(cwd).status === "indexed"`

4. **就緒提示**：索引完成後告知使用者「claude-context 已就緒，可使用語義搜尋」

## 注意事項

- `index_codebase` 為冪等操作（Merkle tree 增量），重複呼叫只同步差異
- 大型 repo 首次索引可能需 1–5 分鐘
- 觸發重建：「重建代碼索引」→ `clear_index(cwd)` 後再 `index_codebase(cwd)`
- LM Studio 未啟動 → MCP 條目會被 mcp-manager 標為 skipped，本 skill 應優雅降級不報錯
