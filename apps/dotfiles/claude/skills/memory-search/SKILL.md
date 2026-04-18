---
name: memory-search
description: 語義搜尋 ~/.claude/memory/ 與 projects/*/memory/ 中的過往決策、偏好與 pattern，回傳最相關的記憶條目。
version: 1.0.0
category: meta
tags: [memory, search, recall]
allowedTools: [Bash, Read, Glob, Grep]
effort: low
---

# Memory Search

當使用者詢問過往決策、偏好、歷史 pattern、踩過的坑，使用此 skill 進行搜尋。

## 觸發條件

- 「之前怎麼做的」、「有沒有相關記憶」、「上次的決定是」
- 需要回溯跨 session 的設計選擇或踩坑記錄

## 搜尋策略

### 快速路徑（grep）

```bash
# 全域記憶
grep -r "<keyword>" ~/.claude/memory/ --include="*.md" -l

# 專案記憶
grep -r "<keyword>" ~/.claude/projects/*/memory/ --include="*.md" -l
```

### 精準路徑（MEMORY.md 索引）

1. 讀 `~/.claude/memory/MEMORY.md`（全域 hot 索引）
2. 讀 `~/.claude/projects/{encoded}/memory/MEMORY.md`（專案 hot 索引）
3. 命中 topic → 讀對應 warm 層 `{topic}/index.md`

### 深層搜尋（向量，Opt-in）

若 `~/.claude/.ab-tao/memory-index.db` 存在：

```bash
node ~/.claude/.ab-tao/bin/memory-search.mjs "<query>" --limit 5
```

預設關閉，需 `d:setup --enable-memory-search` 啟用。

## 輸出格式

```
找到 N 條相關記憶：

1. [{topic}]({path}) — {one-line summary}
   最後更新：{date}

2. …
```

## 無結果處理

若無命中，建議使用者：
1. 確認 memory 是否已存入（`存入記憶` 指令）
2. 嘗試不同關鍵詞
3. 直接讀 `MEMORY.md` 索引瀏覽

## 隱私

- 僅搜尋本機記憶，不發送任何資料至外部服務
- 向量索引永遠本地（sqlite-vec），不外流
