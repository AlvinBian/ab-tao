---
name: status-anchor
version: 1.0.0
category: meta
description: >
  Session 狀態快照 — 每 10 個 tool call 或使用者輸入 `/status` 時，產生並寫入當前任務狀態摘要。
  防止長 session 失憶（context rot）。
  關鍵字觸發：「status」「狀態」「我在做什麼」「現在在哪」「/status」
tools: Read, Bash
---

# Status Anchor Skill

## 觸發時機

- 使用者輸入 `/status`、「現在狀態」、「我在做什麼」
- 長工具鏈（>10 tool call）的每個 Wave 結束後建議呼叫
- 感覺 context 出現漂移或失憶跡象時

## 執行步驟

### Step 1. 收集當前狀態

從對話 context 提取：
- **當前任務**：正在解決的核心問題（一句話）
- **已完成**：本 session 完成的主要里程碑
- **卡點 / 待確認**：未解決的問題或需要使用者確認的事項
- **下一步**：接下來要執行的具體行動

### Step 2. 輸出狀態摘要

```markdown
## Session 狀態快照

**時間**：{HH:MM} | **Session**：{簡短描述}

### 當前任務
{一句話描述正在解決的核心問題}

### 已完成
- {里程碑 1}
- {里程碑 2}

### 卡點 / 待確認
- {問題或等待確認的事項}（若無則省略）

### 下一步
1. {具體行動}
2. {具體行動}
```

### Step 3. 寫入狀態檔

將摘要 append 到 `~/.claude/.ab-tao/status.md`（不覆蓋，保留歷史）：

```bash
mkdir -p ~/.claude/.ab-tao
cat >> ~/.claude/.ab-tao/status.md << 'EOF'
{摘要內容}
EOF
```

## 注意事項

- 此 skill 不持有記憶，僅做 session 內狀態快照
- 長期決策、偏好、踩坑紀錄 → 走 memory-systems（Memory 三溫層）
- Tasks 追蹤進度 → 用原生 TaskCreate / TaskUpdate
- 每次快照的時間戳讓未來複盤更容易定位問題出現時間點
