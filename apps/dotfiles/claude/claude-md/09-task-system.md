<task_system>

## Tasks / Plans / Memory 邊界

| 工具 | 生命週期 | 用途 |
|---|---|---|
| **Tasks** | 當次對話 | 步驟追蹤（TodoWrite / 原生 tasks）|
| **Plans** | 至 PR merge | 跨 session 實作藍圖 |
| **Memory** | 永久 | 決策、偏好、踩過的坑 |

**口訣**：下次對話還有用？→ Memory ｜ 當前步驟？→ Tasks ｜ 需與用戶對齊方案？→ Plan

## 分層位置

| 層級 | Memory | Plans | Tasks |
|---|---|---|---|
| **全局** | `~/.claude/memory/{preferences,patterns}/` | `~/.claude/plans/` | `~/.claude/tasks/` |
| **專案** | `~/.claude/projects/{encoded}/memory/{topic}/` | `~/.claude/projects/{encoded}/plans/{slug}.md` | `~/.claude/projects/{encoded}/tasks/` |

**口訣**：身份偏好 → 全局；票號任務 → 專案

## Plans 存放

路徑：`~/.claude/projects/{encoded-project-path}/plans/{slug}.md`
索引：`~/.claude/projects/{encoded-project-path}/plans/index.md`

plan-mode 新產生的 `.md` 由 SessionEnd hook 自動歸位至上述路徑。

## 冷啟動口訣

開 session 先讀：
1. `~/.claude/projects/{encoded}/memory/MEMORY.md` — 記憶索引
2. `~/.claude/projects/{encoded}/plans/index.md` — 當前計畫進度

## 原生整合

- `~/.claude/tasks/`：原生 Claude Code task 系統（Jan 2025+）
- `~/.claude/plans/`：原生 plansDirectory（Feb 2026+）
- ab-tao SessionEnd hook 負責 plan 歸位，不需手動操作

</task_system>
