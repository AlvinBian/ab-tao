#!/bin/bash
# pre-tool-bash.sh — PreToolUse (Bash) 危險命令攔截

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

NOTIFY="$HOME/.claude/hooks/hook-handler.sh"
PATTERNS_FILE="$HOME/.claude/hooks/.dangerous-patterns"

_block() {
	local blocked_cmd
	blocked_cmd=$(printf '%s' "$COMMAND" | head -c 100)
	[ -x "$NOTIFY" ] && "$NOTIFY" blocked "危險命令: $blocked_cmd" 2>/dev/null &
	printf '{"error":"危險命令已攔截。如需執行請在終端直接操作。"}\n'
	exit 2
}

# 內建 pattern（永遠執行，不受自訂檔案影響）
BUILTIN_PATTERNS=(
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
	'wget[[:space:]].*\|[[:space:]]*(bash|sh)'
	'eval[[:space:]].*base64'
	'eval[[:space:]]*\$\('
)
for pattern in "${BUILTIN_PATTERNS[@]}"; do
	printf '%s' "$COMMAND" | grep -Eiq "$pattern" && _block
done

# 自訂 pattern 檔案（擴充，不取代內建）
if [ -f "$PATTERNS_FILE" ]; then
	while IFS= read -r pat; do
		[[ -z "$pat" || "$pat" == \#* ]] && continue
		if ! printf '' | grep -Eq "$pat" 2>/dev/null; then
			printf '[pre-tool-bash] 無效的 pattern，已略過：%s\n' "$pat" >&2
			continue
		fi
		printf '%s' "$COMMAND" | grep -Eiq "$pat" && _block
	done < "$PATTERNS_FILE"
fi

exit 0
