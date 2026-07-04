---
name: awesome-ai-search
description: 搜尋 Awesome-AI-Pedia 知識庫，補充 ab-tao 本地 skills 未涵蓋的外部 AI 工具 / 模型 / 最佳實踐。
version: 1.0.0
category: meta
---

# awesome-ai-search

搜尋 Awesome-AI-Pedia 知識庫，補充 ab-tao 本地 skills 未涵蓋的外部 AI 工具 / 模型 / 最佳實踐。

## 觸發條件

- 使用者問「最近有什麼新 AI 工具」「有沒有做 X 的 AI 工具」
- 使用者問某個 AI 工具的介紹或對比
- 在 ab-tao 22 個本地 skills 找不到對應資源時，作為補充搜尋

## 搜尋優先順序（重要）

1. **優先**：`~/.claude/skills/` 下的 ab-tao 本地 skills
2. **次要**：Awesome-AI-Pedia（本 skill）
3. 外部 skills 若與 ab-tao 現有 skill 衝突 → 以 ab-tao 為準，不推薦外部版本

## 執行步驟

1. **確認資料存在**：
   ```bash
   ls $HOME/.ab-tao/external/awesome-ai-pedia/ 2>/dev/null
   ```
   若不存在 → 提示使用者執行 `pnpm run c:ai-sync --source awesome-ai-pedia`

2. **關鍵字搜尋**：
   ```bash
   grep -ri "<query>" <awesome-ai-pedia-path> --include="*.md" -l | head -10
   grep -ri "<query>" <awesome-ai-pedia-path> --include="*.md" | head -20
   ```

3. **回傳結果**：
   - 列出匹配的工具名稱、一行說明、所在文件
   - 標注「來源：Awesome-AI-Pedia（外部資源，內容品質不保證）」
   - 若結果可能與 ab-tao 現有 skill 重複，指出對應的本地 skill

## 注意事項

- Awesome-AI-Pedia 為第三方 awesome list，內容可能過時（最後同步日期見 `c:ai-sync --status`）
- 不自動安裝或引用外部 skill 代碼，只提供資訊參考
- d:doctor 每 30 天提示更新一次
