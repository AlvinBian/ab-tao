#!/usr/bin/env bash
# inject-project-prompt.sh — SessionStart 動態五層 Briefing
#
# 層級：L1 Blockers | L2 Active Work | L3 Pending Queue | L4 History | L5 Deep Context
# 輸出：hookSpecificOutput.additionalContext（stdout JSON）+ CLAUDE.local.md fallback
# Cache：~/.claude/.briefing-cache/{hash}.json，TTL 60s
# Timeout：hook 整體 8s；每個外部呼叫最多 2s

command -v jq &>/dev/null || exit 0

HOME_DIR="$HOME"
PROJECTS_DIR="$HOME_DIR/.claude/projects"
CACHE_DIR="$HOME_DIR/.claude/.briefing-cache"

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SOURCE=$(printf '%s' "$INPUT" | jq -r '.source // empty' 2>/dev/null)

[ "$SOURCE" != "startup" ] && exit 0
[ -z "$CWD" ] && exit 0
[ ! -d "$CWD/.git" ] && exit 0
# 限制 CWD 在 HOME 內，避免 hook 在系統目錄觸發
[[ "$CWD" != "$HOME_DIR"* ]] && exit 0

ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
PROJECT_DIR="$PROJECTS_DIR/$ENCODED"
MEMORY_FILE="$PROJECT_DIR/memory/MEMORY.md"
PLANS_INDEX="$PROJECT_DIR/plans/index.md"

# ── Cache 60s TTL ────────────────────────────────────────────────────────────
mkdir -p "$CACHE_DIR"
CACHE_KEY=$(printf '%s' "$CWD" | md5 -q 2>/dev/null \
  || printf '%s' "$CWD" | md5sum 2>/dev/null | cut -c1-8 \
  || printf '%s' "$CWD" | shasum | cut -c1-8)
CACHE_FILE="$CACHE_DIR/${CACHE_KEY}.json"
NOW=$(date +%s)
if [ -f "$CACHE_FILE" ]; then
  CACHE_TS=$(jq -r '.ts // 0' "$CACHE_FILE" 2>/dev/null || echo 0)
  AGE=$(( NOW - CACHE_TS ))
  if [ "$AGE" -lt 60 ]; then
    CACHED=$(jq -r '.context // empty' "$CACHE_FILE" 2>/dev/null)
    if [ -n "$CACHED" ]; then
      printf '{"hookSpecificOutput":{"additionalContext":%s}}' \
        "$(printf '%s' "$CACHED" | jq -Rs .)"
      exit 0
    fi
  fi
fi

# ── helper ───────────────────────────────────────────────────────────────────
has_gh() { command -v gh &>/dev/null; }
timed() { timeout "${1}s" "${@:2}" 2>/dev/null || true; }

BRANCH=$(timed 2 git -C "$CWD" branch --show-current 2>/dev/null)
GIT_STATUS=$(timed 2 git -C "$CWD" status --short 2>/dev/null)
OUTPUT=""

# ── L1 🚨 Blockers ───────────────────────────────────────────────────────────
L1=""
CONFLICTS=$(printf '%s\n' "$GIT_STATUS" | grep -cE '^(UU|AA|DD) ' 2>/dev/null || echo 0)
[ "$CONFLICTS" -gt 0 ] && L1="${L1}- ⚠️  Merge conflicts（${CONFLICTS} 個）\n"

if has_gh; then
  CI_LINE=$(timed 3 gh run list -L 1 --json conclusion,name \
    -q '.[0] | "\(.conclusion) — \(.name)"' 2>/dev/null)
  printf '%s' "$CI_LINE" | grep -qi 'failure\|cancelled' \
    && L1="${L1}- 🔴 CI 失敗：${CI_LINE}\n"
fi

[ -n "$L1" ] && OUTPUT="${OUTPUT}## 🚨 Blockers\n\n${L1}\n"

# ── L2 ⚡ Active Work ─────────────────────────────────────────────────────────
if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "develop" ]; then
  DIRTY=$(printf '%s\n' "$GIT_STATUS" | grep -c '.' 2>/dev/null || echo 0)
  DIFF_STAT=$(timed 2 git -C "$CWD" diff --stat HEAD 2>/dev/null | tail -1)

  L2="**分支**：\`${BRANCH}\`"
  [ "${DIRTY:-0}" -gt 0 ] && L2="${L2}  （${DIRTY} 個未提交）"
  [ -n "$DIFF_STAT" ] && L2="${L2}\n\`\`\`\n${DIFF_STAT}\n\`\`\`"

  # Plan progress from active plan file
  if [ -f "$PLANS_INDEX" ]; then
    PLAN_REL=$(grep -m1 '^- \[' "$PLANS_INDEX" 2>/dev/null \
      | sed 's|.*](\./\([^)]*\)).*|\1|')
    PLAN_FILE="$PROJECT_DIR/plans/${PLAN_REL}"
    if [ -f "$PLAN_FILE" ]; then
      DONE=$(grep -c '^\- \[x\]' "$PLAN_FILE" 2>/dev/null || echo 0)
      TODO=$(grep -c '^\- \[ \]' "$PLAN_FILE" 2>/dev/null || echo 0)
      TOTAL=$(( DONE + TODO ))
      [ "$TOTAL" -gt 0 ] && L2="${L2}\n📋 Plan: ${DONE}/${TOTAL} 完成"
    fi
  fi

  OUTPUT="${OUTPUT}## ⚡ Active Work\n\n${L2}\n\n"
fi

# ── L3 📋 Pending Queue ───────────────────────────────────────────────────────
L3=""
if [ -f "$PLANS_INDEX" ]; then
  PLAN_REL=$(grep -m1 '^- \[' "$PLANS_INDEX" 2>/dev/null \
    | sed 's|.*](\./\([^)]*\)).*|\1|')
  PLAN_FILE="$PROJECT_DIR/plans/${PLAN_REL}"
  if [ -f "$PLAN_FILE" ]; then
    TODOS=$(grep '^\- \[ \]' "$PLAN_FILE" 2>/dev/null | head -5 | sed 's/^- \[ \]/  -/')
    [ -n "$TODOS" ] && L3="${L3}**Plan todos**（前 5 項）:\n${TODOS}\n\n"
  fi
fi

if has_gh; then
  ISSUES=$(timed 3 gh issue list -L 5 \
    --json number,title -q '.[] | "  - #\(.number) \(.title)"' 2>/dev/null)
  [ -n "$ISSUES" ] && L3="${L3}**Open issues**:\n${ISSUES}\n\n"
fi

[ -n "$L3" ] && OUTPUT="${OUTPUT}## 📋 Pending Queue\n\n${L3}"

# ── L4 📜 Recent History ──────────────────────────────────────────────────────
GIT_LOG=$(timed 2 git -C "$CWD" log --oneline -5 2>/dev/null)
L4="**Recent commits**:\n\`\`\`\n${GIT_LOG}\n\`\`\`"

if has_gh; then
  PR_INFO=$(timed 3 gh pr view --json number,title,state \
    -q '"PR #\(.number): \(.title) [\(.state)]"' 2>/dev/null)
  [ -n "$PR_INFO" ] && L4="${L4}\n\n${PR_INFO}"
fi

OUTPUT="${OUTPUT}## 📜 Recent History\n\n${L4}\n\n"

# ── L5 📚 Deep Context ───────────────────────────────────────────────────────
L5=""
if [ -f "$MEMORY_FILE" ]; then
  MEM=$(head -15 "$MEMORY_FILE")
  L5="${L5}**Memory index**:\n${MEM}\n\n"
fi
if [ -f "$PLANS_INDEX" ]; then
  PIDX=$(head -12 "$PLANS_INDEX")
  L5="${L5}**Plans index**:\n${PIDX}\n\n"
fi
[ -n "$L5" ] && OUTPUT="${OUTPUT}## 📚 Deep Context\n\n${L5}"

# ── 組裝 + 輸出 ───────────────────────────────────────────────────────────────
REPO=$(basename "$CWD")
FULL="# Session Briefing — ${REPO}\n\n${OUTPUT}"

# Cache write
jq -n --arg ctx "$FULL" --argjson ts "$NOW" \
  '{"ts":$ts,"context":$ctx}' > "$CACHE_FILE" 2>/dev/null || true

# Primary: hookSpecificOutput.additionalContext
printf '{"hookSpecificOutput":{"additionalContext":%s}}' \
  "$(printf '%s' "$FULL" | jq -Rs .)"

# Fallback: CLAUDE.local.md（Claude Code 自動載入）
LOCAL_MD="${CWD}/CLAUDE.local.md"
printf '%b' "$FULL" > "$LOCAL_MD" 2>/dev/null || true
EXCLUDE="${CWD}/.git/info/exclude"
if [ -f "$EXCLUDE" ]; then
  grep -qxF 'CLAUDE.local.md' "$EXCLUDE" 2>/dev/null || echo 'CLAUDE.local.md' >> "$EXCLUDE"
fi

exit 0
