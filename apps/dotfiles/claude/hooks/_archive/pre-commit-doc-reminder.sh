#!/usr/bin/env bash
# pre-commit-doc-reminder.sh — PreToolUse/Bash hook
# 當 Claude Code 要執行 git commit 時，提醒檢查文件是否同步更新

# Claude Code 從 stdin 餵 hook input JSON（不是環境變數）。
# 舊版讀 $TOOL_INPUT → 永遠空字串 → 此 hook 從未觸發過（死 no-op）。
# 改讀 stdin：優先 jq、缺 jq 用 grep fallback，不依賴 python3。
input="$(cat)"
if command -v jq >/dev/null 2>&1; then
  TOOL_CMD="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
else
  TOOL_CMD="$(printf '%s' "$input" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/')"
fi

# 只在 git commit 時觸發
if ! echo "$TOOL_CMD" | grep -q "git commit"; then
  exit 0
fi

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || echo "$CLAUDE_PROJECT_DIR")"
DOCS_DIR="$REPO_ROOT/docs"
README="$REPO_ROOT/README.md"

# 檢查 docs/*.md 和 docs/*.html 是否都在 README.md 登記
MISSING=""
for doc in "$DOCS_DIR"/*.md "$DOCS_DIR"/*.html; do
  [ -f "$doc" ] || continue
  filename="$(basename "$doc")"
  if ! grep -q "$filename" "$README"; then
    MISSING="$MISSING\n  - docs/$filename"
  fi
done

echo ""
if [ -n "$MISSING" ]; then
  echo "⚠️  以下文件尚未在 README.md「文件（docs/）」表格補 link：$MISSING"
  echo ""
  echo "請先更新 README.md，確保每個 docs/*.md 都有對應說明。"
else
  echo "✅ docs/ 文件登記檢查通過。"
fi

echo "📝 commit 前請確認以下文件內容已同步本次變更："
for doc in "$DOCS_DIR"/*.md; do
  [ -f "$doc" ] || continue
  echo "  - docs/$(basename "$doc")"
done
echo ""
