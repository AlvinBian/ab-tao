#!/bin/bash
# Claude Code macOS 通知 — 顯示實際通知內容
MSG=$(printf '%s' "${CLAUDE_TOOL_INPUT:-{}}" | jq -r '.message // empty' 2>/dev/null | head -c 100)
[ -z "$MSG" ] && MSG="Claude Code 需要注意"
MSG="${MSG//\"/\'}"
osascript -e "display notification \"$MSG\" with title \"ab-tao\"" 2>/dev/null
exit 0
