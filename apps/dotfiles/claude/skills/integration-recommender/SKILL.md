# integration-recommender

讀取 metrics.jsonl 使用記錄，推薦尚未啟用但可能有用的整合。

## 觸發條件

- 使用者問「有什麼功能還沒用到」「推薦我開啟哪些整合」
- d:doctor 輸出中提示某整合安裝率低

## 執行步驟

1. **讀取安裝狀態**：
   ```bash
   pnpm run c:locals --status 2>/dev/null
   ```

2. **靜態推薦邏輯**（metrics emitter 尚未實作，採靜態建議）：

   | 整合 | 建議訊息 |
   |---|---|
   | claude-context | 「可用語義搜尋找代碼——說『初始化代碼索引』啟動（需 LM Studio + Milvus）」|
   | browser-harness | 「需要瀏覽器自動化時，使用 browser-automation-router skill 分流」|
   | awesome-ai-pedia | 「問 AI 工具時可搜尋 AI-Pedia 知識庫——說『搜尋 AI 工具』」|

3. **回傳推薦清單**：對尚未安裝的整合列出安裝提示（`pnpm run d:setup`）；已安裝者列出觸發方式。

## 注意事項

- 若三個整合均已安裝：回傳「整合已就緒，可正常使用」
- metrics-driven 推薦列入 roadmap（metrics emitter 實作後升級）
- 僅推薦已知整合，不建議安裝 ab-tao 範疇外的工具
