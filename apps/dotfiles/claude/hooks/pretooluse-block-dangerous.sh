#!/bin/bash
# pretooluse-block-dangerous.sh — 危險命令攔截（嚴格正則）
# 攔截 sudo rm / rm -rf / fork bomb / chmod 777 / dd wipe / mkfs / shred / wipefs

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

NOTIFY="$HOME/.claude/hooks/notify.sh"

# 危險命令模式（各模式獨立，避免超長單行難以維護）
DANGEROUS_PATTERNS=(
	'sudo[[:space:]]+rm[[:space:]]'
	'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*[fF]'
	'rm[[:space:]]+-[a-zA-Z]*[fF][a-zA-Z]*[rR]'
	':[[:space:]]*\(\)[[:space:]]*\{'
	'chmod[[:space:]]+0*777'
	'dd[[:space:]].*if=/dev/(zero|random|urandom)'
	'mkfs\.'
	'(^|[[:space:]])shred[[:space:]]'
	'(^|[[:space:]])wipefs([[:space:]]|$)'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
	if printf '%s' "$COMMAND" | grep -Eiq "$pattern"; then
		BLOCKED_CMD=$(printf '%s' "$COMMAND" | head -c 100)
		[ -x "$NOTIFY" ] && "$NOTIFY" blocked "危險命令: $BLOCKED_CMD" 2>/dev/null &
		printf '{"error":"危險命令已攔截。如需執行請在終端直接操作。"}\n'
		exit 1
	fi
done

exit 0
