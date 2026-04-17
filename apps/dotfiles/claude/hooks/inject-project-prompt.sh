#!/usr/bin/env bash
# inject-project-prompt.sh — SessionStart 專案提醒自動注入
#
# 根據 cwd 複製 ~/.claude/project-prompts/{repo-name}.md → {repo}/CLAUDE.local.md
# Claude Code 自動載入 CLAUDE.local.md，用 .git/info/exclude 排除（不碰 .gitignore）
#
# 新增提醒：~/.claude/project-prompts/{repo-name}.md（內含冷啟動指引）

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SOURCE=$(printf '%s' "$INPUT" | jq -r '.source // empty' 2>/dev/null)

# 只在新 session 啟動時執行（排除 resume/compact/clear）
[ "$SOURCE" != "startup" ] && exit 0
[ -z "$CWD" ] && exit 0

# 去除尾隨斜線後取 repo 名，防止 basename 空值
REPO_NAME=$(basename "${CWD%/}")
[ -z "$REPO_NAME" ] && exit 0

PROMPT_FILE="$HOME/.claude/project-prompts/${REPO_NAME}.md"

# 無對應提醒 → 靜默退出
[ ! -f "$PROMPT_FILE" ] && exit 0

# 生成 CLAUDE.local.md（Claude Code 自動載入）
LOCAL_MD="${CWD}/CLAUDE.local.md"
if ! cp "$PROMPT_FILE" "$LOCAL_MD" 2>/dev/null; then
  printf '[inject-project-prompt] 無法寫入 %s，請確認目錄寫入權限\n' "$LOCAL_MD" >&2
  exit 0
fi

# 用 .git/info/exclude 排除（不碰 .gitignore）
EXCLUDE="${CWD}/.git/info/exclude"
if [ -f "$EXCLUDE" ]; then
  grep -qxF 'CLAUDE.local.md' "$EXCLUDE" 2>/dev/null || echo 'CLAUDE.local.md' >> "$EXCLUDE"
fi

exit 0
