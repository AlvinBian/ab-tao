# 從需求到 Ship 完整流程

適用對象：任何功能開發，確保需求 → 實作 → 品質閘 → PR 每個環節有跡可循。

## 前置需求

1. ab-tao `d:setup` 已完成，`~/.claude/` 配置就緒
2. Claude Code session 已啟動，並在目標 repo 工作目錄
3. 已建好功能分支（`feat/<TICKET>/<N>-<slug>`）

## 完整步驟

### 1. 需求結構化

```bash
# 在 Claude Code 中執行
/specify <需求描述>
```

`/specify` 將需求轉為結構化 Spec，包含：
- Acceptance Criteria（AC）清單
- Non-goals（明確排除項）
- 技術方案草稿

預期輸出：一份 `spec.md` 或 Claude 直接輸出的 Spec 文件，用於後續步驟對齊。

### 2. Reviewer Agent 審 Spec

```bash
# 啟動 reviewer agent 對 spec 進行第二意見審查
/agent reviewer
```

告知 reviewer：「請審查以下 spec，確認 AC 完整、邊界清晰、技術方案可行性」

預期輸出：審查意見清單，標記模糊或有風險的 AC。根據意見修訂 spec 後進入下一步。

### 3. 實作

根據已審查的 spec 進行開發。建議：
- 每個 AC 對應一個可驗證的 commit
- 複雜邏輯先寫測試骨架（可搭配 TDD 流程，見 `tdd-flow.md`）

### 4. /verify 反查 AC

```bash
/verify
```

`/verify` 反向掃描目前代碼，確認每條 AC 是否有對應實作。

預期輸出：AC 覆蓋率報告，標記未實作或部分實作的 AC。

### 5. /check 品質閘

```bash
# 快速品質檢查（build + lint + type check）
/check

# 完整 9 閘審查（建議 PR 前跑）
/check --gates
```

`/check --gates` 依序執行：
1. Build 成功
2. TypeScript 型別正確
3. Lint 無錯誤
4. 測試通過
5. Bundle size 在限制內
6. 無 `console.log` 敏感資訊
7. 三態（loading/empty/error）完整
8. API 格式統一
9. 無 TODO/FIXME 未追蹤

### 6. PR 提交

```bash
# 建立 PR（遵循命名規範）
gh pr create --title "[TICKET][PROJECT] 主描述 - PR-N 子描述"
```

PR description 必須包含：
- 對應 spec 連結或摘要
- 依賴 PR 編號（堆疊 PR 時）
- `/verify` 輸出的 AC 覆蓋截圖或文字

## 預期結果

- Spec 與代碼 1:1 對應，無未追蹤需求
- 所有品質閘通過
- PR reviewer 能快速理解範圍與意圖

## 常見問題

**Q：`/specify` 輸出的 AC 太多怎麼辦？**
A：與 PM 對齊後拆分為多個 PR，每個 PR 覆蓋 3-5 條 AC 為宜。

**Q：`/check --gates` 有閘失敗，但不影響功能？**
A：不允許靜默跳過閘，若確認為誤判，需在 PR description 說明原因。

**Q：reviewer agent 審 spec 時提出架構建議，要改嗎？**
A：架構建議須評估影響範圍，若涉及跨 PR 修改，建議開獨立 task 追蹤。
