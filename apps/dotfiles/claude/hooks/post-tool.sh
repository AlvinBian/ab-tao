#!/bin/bash
# post-tool.sh — PostToolUse auto-memory 索引觸發（Phase 13 預留接口）

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Memory 檔案寫入後非同步觸發索引更新（精確匹配 memory 目錄，避免誤觸 src/memory.ts 等）
if [ -n "$FILE_PATH" ] && [[ "$FILE_PATH" == */memory/*.md || "$FILE_PATH" == */memory/*/*.md ]]; then
	AB_TAO_BIN="$HOME/.claude/.ab-tao/bin/memory-index.mjs"
	if [ -f "$AB_TAO_BIN" ]; then
		timeout 2s node "$AB_TAO_BIN" update "$FILE_PATH" 2>/dev/null &
	fi
fi

exit 0
