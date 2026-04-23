---
name: worklog
description: >
  Worklog 草稿審查 + 批次提交助手。讀取 ~/.claude/.ab-tao/worklog-drafts.jsonl，
  per-draft 詢問 [d]套用 / [m]修改 / [c:TICKET]改票號 / [t:1h30m]改工時 / [n]略過 / [x]永久刪除，
  最後透過 Atlassian MCP 批次提交至 Jira。
  Use when: "處理 worklog", "送 worklog", "submit worklog", "/worklog",
  "工時批次", "批次填工時", "填工時", "month-end worklog", "送出工時",
  "提交 worklog", "worklog 草稿", "jira worklog", "記工時"
metadata:
  version: 1.0.0
---

# /worklog — Worklog 草稿審查與批次提交

## Step W1 — Read drafts（強制）

`Read ~/.claude/.ab-tao/worklog-drafts.jsonl`（無例外）。

解析每行 JSON，建立草稿列表。
- 檔案不存在或內容為空 → 回覆「無待處理草稿」並結束。
- JSON 解析失敗的行靜默跳過，繼續處理其餘行。

## Step W2 — 摘要呈現

呈現所有草稿的一覽表：

```
📋 共 N 筆 worklog 草稿（總時長 X.Xh）

  #  Ticket     Duration  Branch                     Commits
  1  VM-1531    2h00m     feat/VM-1531/2-bff-base    3
  2  unknown ⚠️  1h30m     main                       1
  3  VM-1573    0h45m     feat/VM-1573/3-test         2
```

`⚠️` 標記 `ticketKey=unknown` 的草稿，提醒需補 ticket。

## Step W3 — Per-draft 確認（強制 [d]/[m]/[c:]/[t:]/[n]/[x]）

依序對每筆草稿呈現完整資訊 + 操作選單。**無任何預設，使用者必須明確選擇。**

```
草稿 1/N（id: wl_abc12345_1745000000）

  Ticket:   VM-1531
  Branch:   feat/VM-1531/2-bff-base
  Duration: 2h00m（7200 秒）
  Started:  2026-04-23 14:00 UTC
  Commits:  3
  Comment:
    feat: 加 stats view
    fix: lint Number.isNaN
    chore: bump version

📤 操作（請選一，無預設）：
  [d]              套用此草稿（送至 Jira）
  [m]              修改後送出（提示編輯 ticket / duration / comment）
  [c:<TICKET>]     只改 ticket key（如 c:VM-1532）後送出
  [t:<duration>]   只改工時（如 t:1h30m 或 t:90m）後送出
  [n]              略過此筆（保留在 jsonl，下次 /worklog 再處理）
  [x]              永久刪除此筆（不送 Jira，從 jsonl 移除）
```

### [m] 修改流程

依序詢問：
1. Ticket key（目前：VM-1531，直接 Enter 保留）
2. Duration（目前：2h00m，格式 Xh Ym 或 Xm，直接 Enter 保留）
3. Comment（目前顯示全文，直接 Enter 保留，或輸入新內容）

## Step W4 — 提交至 Jira（[d] / [m] / [c:] / [t:] 觸發）

### W4.1 取得 cloudId（session-level cache，只取一次）

呼叫：`mcp__claude_ai_Atlassian_Rovo__getAccessibleAtlassianResources`

從回傳結果中找 Jira 的 `cloudId`（`product = "jira"` 或 `url` 含 `.atlassian.net`）。
若有多個 site → 選 URL 含使用者 email domain 的那個，或問使用者確認。

### W4.2 Duration 解析

支援格式：
- `2h` → 7200 秒
- `1h30m` → 5400 秒
- `90m` → 5400 秒
- `45` → 45 秒（純數字視為秒）
- 原始 `durationSec` 直接使用

### W4.3 Comment → ADF 格式

Jira worklog comment 需 ADF（Atlassian Document Format）格式：

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "<comment text>" }]
    }
  ]
}
```

### W4.4 呼叫 addWorklogToJiraIssue

```
mcp__claude_ai_Atlassian_Rovo__addWorklogToJiraIssue
  cloudId:        <from W4.1>
  issueIdOrKey:   <ticketKey>
  timeSpentSeconds: <durationSec>
  started:        <startedAt>   # ISO 8601 with timezone，如 2026-04-23T14:00:00.000+0000
  comment:        <ADF doc>
```

**成功** → 從 jsonl 移除該 draft（呼叫 dismissDrafts 邏輯：重寫 jsonl 排除已提交 id）。
**失敗** → 保留草稿，顯示錯誤訊息，繼續下一筆。

## Step W5 — 結果摘要

所有草稿處理完畢後輸出：

```
✅ 提交成功 N 筆（合計 X.Xh）：
  • VM-1531  2h00m  ✓
  • VM-1573  0h45m  ✓
⏭️  略過 M 筆（保留在草稿，下次 /worklog 再處理）
🗑  永久刪除 K 筆
❌ 提交失敗 J 筆（已保留，可重試）
```

---

## 安全紅線（per claude-md/05-security.md）

❗ **嚴禁**：
- 無 `[d]/[m]/[c:]/[t:]` 明確確認，自動提交任何草稿
- `ticketKey=unknown` 時自動填寫任意 ticket key
- 同步 transition Jira issue 狀態（v1.3.2 不含此功能，v1.3.3 加）
- 跳過任何草稿的操作確認
