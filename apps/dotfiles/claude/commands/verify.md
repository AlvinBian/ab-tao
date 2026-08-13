---
description: Spec 反向驗證：逐條確認 spec 的 Acceptance Criteria 是否真正被實作覆蓋，防止 spec drift
argument-hint: [spec 檔路徑]
---

# /verify — Spec 反向驗證

逐條確認 spec 的 Acceptance Criteria 是否真正被實作覆蓋，防止 spec drift。

## 使用方式

```
/verify [ticket-or-slug]
/verify [spec-路徑]
```

## 執行步驟

### Step 1. 載入 Spec

1. 從 `~/.claude/specs/{ticket-or-slug}.md` 讀取 spec
2. 若找不到：停下並告知「找不到對應 spec，請先執行 /specify 建立基線」
3. 解析所有 AC（`- [ ] **AC-N**: ...`）

### Step 2. 實作掃描

對每個 AC，搜尋對應的實作與測試：

```bash
# 搜尋實作
grep -r "[AC 關鍵字]" --include="*.ts" --include="*.vue" --include="*.php" .

# 搜尋測試
grep -r "[AC 關鍵字]" --include="*.test.*" --include="*.spec.*" .
```

### Step 3. 逐 AC 判定

每個 AC 給出三態判定：

| 狀態 | 符號 | 條件 |
|---|---|---|
| 已覆蓋 | ✅ | 有實作 + 有對應測試 |
| 部分覆蓋 | ⚠️ | 有實作，但缺少測試或邊界條件未處理 |
| 未覆蓋 | ❌ | 找不到對應實作 |

### Step 4. 輸出驗證報告

```markdown
## Spec 反向驗證報告

Spec：[spec 路徑]
驗證日期：[YYYY-MM-DD]

### AC 覆蓋狀態

| AC | 描述 | 實作 | 測試 | 狀態 |
|---|---|---|---|---|
| AC-1 | [描述] | [file:line] | [test:line] | ✅ |
| AC-2 | [描述] | [file:line] | 缺失 | ⚠️ |
| AC-3 | [描述] | 未找到 | 未找到 | ❌ |

### 摘要
- ✅ 已覆蓋：N 個
- ⚠️ 部分覆蓋：M 個
- ❌ 未覆蓋：K 個

### 建議行動
[針對 ⚠️ 和 ❌ 的具體補充建議]
```

### Step 5. 結論

- 全部 ✅：「Spec 驗證通過，所有 AC 已覆蓋。」
- 有 ⚠️ 或 ❌：列出需要補充的 AC，建議不 merge 直到覆蓋。

## 注意事項

- 搜尋範圍：當前 git repo
- 若 spec 沒有 AC 格式，改用自然語言列點描述的需求項逐一比對
- 「有實作」≠「實作正確」— 此命令只做覆蓋率檢查，不做邏輯審查（那是 architect / reviewer 的職責）
