#!/bin/bash
# protect-files.sh — 保護敏感檔案寫入攔截
# 攔截對 .env* / *.lock / pnpm-lock.yaml / package-lock.json 的修改

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

BASENAME=$(basename "$FILE_PATH")
NOTIFY="$HOME/.claude/hooks/hook-handler.sh"
PROTECTED_FILE="$HOME/.claude/hooks/.protected-files"

is_protected() {
	local name="$1"
	# 若有用戶自訂 pattern 檔案，逐行比對（支援 glob pattern）
	if [ -f "$PROTECTED_FILE" ]; then
		while IFS= read -r pat; do
			[[ -z "$pat" || "$pat" == \#* ]] && continue
			# shellcheck disable=SC2254
			case "$name" in $pat) return 0 ;; esac
		done < "$PROTECTED_FILE"
		return 1
	fi
	# fallback：4 個預設 pattern
	[[ "$name" == .env* ]] && return 0
	[[ "$name" == *.lock ]] && return 0
	[[ "$name" == "pnpm-lock.yaml" ]] && return 0
	[[ "$name" == "package-lock.json" ]] && return 0
	return 1
}

if is_protected "$BASENAME"; then
	[ -x "$NOTIFY" ] && "$NOTIFY" blocked "保護檔案被修改: $BASENAME" 2>/dev/null &
	printf '{"error":"禁止修改敏感檔案: %s（如需修改請手動操作）"}\n' "$BASENAME"
	exit 2
fi

exit 0
