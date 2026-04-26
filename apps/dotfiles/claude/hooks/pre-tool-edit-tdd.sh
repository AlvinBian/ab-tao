#!/bin/bash
# pre-tool-edit-tdd.sh — PreToolUse (Edit|Write) TDD 強制（Wave 2.2）
# 若 settings.json _abTao.tddStrictMode=true，且編輯 src 源碼但無對應測試 → exit 2
# 預設 off，不影響日常開發流程；用 check.md --tdd-strict 或手動改 settings 啟用

command -v jq &>/dev/null || exit 0

SETTINGS="$HOME/.claude/settings.json"

# 讀取 tddStrictMode（預設 false）
TDD_MODE="false"
if [[ -f "$SETTINGS" ]]; then
	TDD_MODE=$(jq -r '._abTao.tddStrictMode // false' "$SETTINGS" 2>/dev/null || echo "false")
fi

[[ "$TDD_MODE" != "true" ]] && exit 0

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[[ -z "$FILE_PATH" ]] && exit 0

# 只對 src/lib/app 下的 ts/js/vue/php 源碼生效
if ! echo "$FILE_PATH" | grep -qE '/(src|lib|app)/.*\.(ts|tsx|js|jsx|vue|php)$'; then
	exit 0
fi

# 逃生口：專案根目錄有 .ab-tao-tdd-skip 則直接放行
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [[ -f "$PROJECT_ROOT/.ab-tao-tdd-skip" ]]; then
	exit 0
fi

# 推斷對應測試檔案路徑
BASE="${FILE_PATH%.*}"
EXT="${FILE_PATH##*.}"
DIR=$(dirname "$FILE_PATH")
BASENAME=$(basename "$BASE")

FOUND_TEST=0
for PATTERN in \
	"${BASE}.test.${EXT}" \
	"${BASE}.spec.${EXT}" \
	"${BASE}.test.ts" \
	"${BASE}.spec.ts" \
	"${DIR}/__tests__/${BASENAME}.test.${EXT}" \
	"${DIR}/__tests__/${BASENAME}.spec.${EXT}" \
	"${DIR}/__tests__/${BASENAME}.test.ts"; do
	if [[ -f "$PATTERN" ]]; then
		FOUND_TEST=1
		break
	fi
done

if [[ $FOUND_TEST -eq 0 ]]; then
	printf '🧪 TDD 模式：請先建立對應測試檔案再修改源碼\n' >&2
	printf '   編輯目標：%s\n' "$FILE_PATH" >&2
	printf '   停用方式：在專案根目錄建立 .ab-tao-tdd-skip，或設定 settings.json _abTao.tddStrictMode=false\n' >&2
	exit 2
fi

exit 0
