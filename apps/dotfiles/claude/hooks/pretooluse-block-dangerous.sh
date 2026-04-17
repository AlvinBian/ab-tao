#!/bin/bash
# pretooluse-block-dangerous.sh — 危險命令攔截（嚴格正則）
# 攔截 sudo rm / rm -rf / fork bomb / chmod 777 / dd wipe / mkfs / shred / wipefs
# 以及 git push -f / DROP TABLE / curl|bash / eval+base64

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

NOTIFY="$HOME/.claude/hooks/notify.sh"
PATTERNS_FILE="$HOME/.claude/hooks/.dangerous-patterns"

_block() {
	local blocked_cmd
	blocked_cmd=$(printf '%s' "$COMMAND" | head -c 100)
	[ -x "$NOTIFY" ] && "$NOTIFY" blocked "危險命令: $blocked_cmd" 2>/dev/null &
	printf '{"error":"危險命令已攔截。如需執行請在終端直接操作。"}\n'
	exit 2
}

# 若有用戶自訂 pattern 檔案，從檔案讀取
if [ -f "$PATTERNS_FILE" ]; then
	while IFS= read -r pat; do
		[[ -z "$pat" || "$pat" == \#* ]] && continue
		printf '%s' "$COMMAND" | grep -Eiq "$pat" && _block
	done < "$PATTERNS_FILE"
else
	# fallback：13 個預設危險命令模式
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
		'git[[:space:]].*push[[:space:]].*(--force|-f[[:space:]]|-f$)'
		'DROP[[:space:]]+TABLE'
		'curl[[:space:]].*\|[[:space:]]*(bash|sh)'
		'eval[[:space:]].*base64'
	)
	for pattern in "${DANGEROUS_PATTERNS[@]}"; do
		printf '%s' "$COMMAND" | grep -Eiq "$pattern" && _block
	done
fi

exit 0
