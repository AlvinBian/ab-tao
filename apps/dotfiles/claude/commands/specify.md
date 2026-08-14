---
description: 需求 → 結構化 Spec：將模糊需求轉為標準 spec 文件，作為 /verify 反查與工程實作的基線
argument-hint: [需求描述]
---

# /specify — 需求 → 結構化 Spec

將模糊需求轉為標準 spec 文件，作為 /verify 反查和工程實作的基線。

## 使用方式

```
/specify [需求描述或票號]
```

## 執行步驟

### Step 1. 需求收集

從以下來源收集需求：
- 使用者在 prompt 中的描述
- 若有票號：嘗試讀取 `~/.claude/specs/{ticket}.md`（已有草稿）
- 若有 user story：從 pm agent 輸出提取 Acceptance Criteria

若需求仍模糊，停下問清楚，不自行填補假設。

### Step 2. 結構化產出

輸出以下格式的 spec：

```markdown
# Spec: [功能名稱]

> 票號：[TICKET]（若無則省略）
> 建立日期：[YYYY-MM-DD]
> 狀態：draft

## 背景與動機

[1-2 段說明這個功能解決什麼問題，為何現在做]

## 目標使用者

- 主要：[角色] + [情境]

## Acceptance Criteria

- [ ] **AC-1**: [具體可驗證標準]（可測量，含邊界條件）
- [ ] **AC-2**: ...

## Non-goals（明確不做）

- [項目，防止 scope creep]

## 邊界條件 & 特殊情境

- 空狀態：[行為]
- 錯誤狀態：[行為]
- 並發：[行為]
- 權限不足：[行為]

## 依賴與假設

- [外部依賴 / API / 已存在功能]

## 技術備註（選填）

- [已知限制 / 建議技術方向，不強制]
```

### Step 3. 儲存

將 spec 寫入 `~/.claude/specs/{ticket-or-slug}.md`，並告知路徑。

若目錄不存在，先建立：`mkdir -p ~/.claude/specs/`

### Step 4. 確認

顯示完整 spec 並詢問：「此 spec 是否正確反映需求？需要調整哪裡？」

等待確認後才視為完成。

## 注意事項

- 每個 AC 必須可測量（可以寫出對應的測試案例）
- Non-goals 不能省略（即使只有「暫時不做 XX」也要列出）
- 邊界條件至少列 3 個（空、錯誤、並發）
- 完成後建議：「下一步可用 /verify 反查實作是否覆蓋所有 AC。」
