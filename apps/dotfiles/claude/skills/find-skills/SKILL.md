---
name: find-skills
description: >
  當 Claude 需要特定 pattern/skill（例：cursor pagination / auth refresh / migration rollback）
  但本地 skills/ 無匹配時，搜尋社群 skill 集合並提供安裝選項
version: 1.1.0
category: meta
triggers:
  - "有沒有 X 的 skill"
  - "處理 X 的 pattern"
  - "用什麼 skill 做 X"
  - "有 skill 可以幫我做 X 嗎"
  - 內部：Claude 判斷任務需要特定 pattern 但 local skills 無命中
allowedTools: [Bash, WebFetch, WebSearch]
---

# Find Skills

搜尋並安裝 Claude Code skills，支援本地 source 搜尋與遠端 GitHub repo 搜尋。

## 觸發條件

### 顯式觸發（使用者詢問）

使用者問「處理 X 有 skill 嗎？」「有 X 的 pattern 嗎？」→ 自動呼叫本 skill。

### 隱式觸發（Claude 主動）

Claude 判斷當前任務需要特定 pattern，且 `~/.claude/skills/` 內無相關 skill → 主動搜尋後提示安裝。

### 冷啟動觸發

`~/.claude/skills/` 檔案數 < 5 → SessionStart 提示：「建議先執行 `pnpm run c:skills --find` 豐富本地 skills」

## 使用方式

```bash
# 本地搜尋（從 ab-tao source）
pnpm run c:skills --find <keyword>

# 已同步 AI source 搜尋（Wave 2.1 — gstack / spec-kit / ai-sdlc / bmad 等）
pnpm run c:skills --synced                        # 列出所有同步來源的 skill
pnpm run c:skills --synced --find <keyword>       # 關鍵字過濾
pnpm run c:skills --synced --all                  # 安裝全部
pnpm run c:skills --synced --find auth --all      # 過濾後全裝

# 從指定 repo 安裝全部 skills
pnpm run c:skills --from <owner/repo>

# 從指定 repo 搜尋並安裝符合關鍵字的 skills
pnpm run c:skills --from <owner/repo> --find <keyword>

# 常用社群來源
pnpm run c:skills --from numman-ali/openskills --find <keyword>

# 直接安裝本地 source skill
pnpm run c:skills --install <name>

# 列出全部 skills 狀態
pnpm run c:skills --list
```

## 搜尋後 prompt

找到結果後提供：

```
找到 3 個相關 skill：
  1. cursor-pagination — 處理 cursor-based 分頁（Stars: 245）
  2. auth-refresh — JWT refresh token 自動處理（Stars: 189）
  3. db-migration-rollback — 安全回滾遷移（Stars: 102）

[y] 安裝選取 [a] 全部安裝 [n] 略過
```

## 說明

- 本地搜尋範圍：`apps/dotfiles/claude/skills/`（ab-tao source）
- 同步來源搜尋：`--synced` 掃描 `packages/commons/resources/ai/sources/*/skills/`（需先執行 `c:ai-sync`）
- 遠端搜尋：`--from <repo>` 淺層 clone → 掃描 `skills/` → 安裝至 `~/.claude/skills/`
- 安裝後自動更新 `~/.claude/AGENTS.md` 索引
- 已安裝的 skill 不會被覆蓋（使用 `--update` 更新）
- 找不到合適 skill → 使用 `skill-creator`（opt-in，`c:skills --install skill-creator --from anthropic`）自建
