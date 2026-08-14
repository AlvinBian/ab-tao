#!/bin/bash
# pre-tool-edit.sh — PreToolUse (Edit|Write|MultiEdit) 檔案保護 + Memory 路徑校驗 + 配額

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
NOTIFY="$HOME/.claude/hooks/hook-handler.sh"

# ── Part 1: MEMORY.md 配額警告（O7）──────────────────────────────
if [ -n "$FILE_PATH" ] && [[ "$FILE_PATH" == */MEMORY.md ]]; then
	lines=$(wc -l < "$FILE_PATH" 2>/dev/null || echo 0)
	bytes=$(wc -c < "$FILE_PATH" 2>/dev/null || echo 0)
	if [ "$lines" -gt 200 ] || [ "$bytes" -gt 25600 ]; then
		printf '⚠️  MEMORY.md quota 已超過 (%d 行 / %d bytes)，請先將舊條目歸檔至 {topic}/index.md 再編輯\n' \
			"$lines" "$bytes" >&2
		# exit 2 = warn only，不攔截，讓使用者決定
	fi
fi

# ── Part 2: 受保護檔案攔截 ───────────────────────────────────────
BASENAME=$(basename "$FILE_PATH" 2>/dev/null)
if [ -n "$BASENAME" ]; then
	PROTECTED_FILE="$HOME/.claude/hooks/.protected-files"

	is_protected() {
		local name="$1"
		if [ -f "$PROTECTED_FILE" ]; then
			while IFS= read -r pat; do
				[[ -z "$pat" || "$pat" == \#* ]] && continue
				# shellcheck disable=SC2254
				case "$name" in $pat) return 0 ;; esac
			done < "$PROTECTED_FILE"
			return 1
		fi
		# 預設 pattern
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
fi

# ── Part 2b: ab-tao 管理檔案保護（完整路徑精確比對，§10 禁改清單）────
# 不用 basename glob（會誤傷專案內同名檔），僅精確比對這兩個完整路徑
if [ -n "$FILE_PATH" ]; then
	case "$FILE_PATH" in
	"$HOME/.claude/settings.json" | "$HOME/.claude/.ab-tao/state.json")
		[ -x "$NOTIFY" ] && "$NOTIFY" blocked "禁改清單檔案被修改: $FILE_PATH" 2>/dev/null &
		printf '{"error":"此檔由 ab-tao d:setup 管理（§10 禁改清單）。經使用者明確授權的修改請改 source template 或以 Bash 工具操作。"}\n'
		exit 2
		;;
	esac
fi

# ── Part 3: Memory/Plans 路徑自動校驗 ───────────────────────────
[ -z "$FILE_PATH" ] && exit 0
[[ "$FILE_PATH" =~ \.claude/projects/([^/]+)/(memory|plans)/ ]] || exit 0

ACTUAL_SLUG="${BASH_REMATCH[1]}"
GLOBAL_SLUG=$(printf '%s' "$HOME" | tr '/' '-')

JSON_CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
GIT_ROOT=$(git -C "${JSON_CWD:-$PWD}" rev-parse --show-toplevel 2>/dev/null)
EXPECTED_SLUG=$([ -n "$GIT_ROOT" ] \
	&& printf '%s' "$GIT_ROOT" | tr '/' '-' \
	|| printf '%s' "$GLOBAL_SLUG")

[ "$ACTUAL_SLUG" = "$EXPECTED_SLUG" ] && exit 0

# 解析 frontmatter type（僅 Write 有完整 content）
MEM_TYPE=""
if [ "$TOOL" = "Write" ]; then
	MEM_TYPE=$(printf '%s' "$INPUT" \
		| jq -r '.tool_input.content // empty' 2>/dev/null \
		| awk '/^---/{p=!p;next} p && /^type:/{gsub(/^type:[[:space:]]*/, ""); print; exit}')
fi

SHOULD_FIX=false
REASON=""

# 案例 A：寫入到既不是 global 也不是預期 slug → 明顯寫錯專案
if [ "$ACTUAL_SLUG" != "$GLOBAL_SLUG" ] && [ "$ACTUAL_SLUG" != "$EXPECTED_SLUG" ]; then
	SHOULD_FIX=true
	REASON="目標專案 ${ACTUAL_SLUG} 與 CWD 不符，應為 ${EXPECTED_SLUG}"
# 案例 B：type=project 卻寫入 global，且 CWD 在 git repo
elif [ "$ACTUAL_SLUG" = "$GLOBAL_SLUG" ] && [ "$MEM_TYPE" = "project" ] && [ -n "$GIT_ROOT" ]; then
	SHOULD_FIX=true
	REASON="type=project 不應寫入全局 memory，應為 ${EXPECTED_SLUG}"
fi

$SHOULD_FIX || exit 0

_esc_bre() { printf '%s' "$1" | sed 's/[].[\*^$\\]/\\&/g'; }
_esc_repl() { printf '%s' "$1" | sed 's/[\\&|]/\\&/g'; }

CORRECTED_FILE=$(printf '%s' "$FILE_PATH" \
	| sed "s|/projects/$(_esc_bre "$ACTUAL_SLUG")/|/projects/$(_esc_repl "$EXPECTED_SLUG")/|")

[ "$CORRECTED_FILE" = "$FILE_PATH" ] && exit 0

if [ "$TOOL" = "Write" ]; then
	if ! mkdir -p "$(dirname "$CORRECTED_FILE")" 2>/dev/null; then
		echo "⚠️  Memory 路徑修正失敗：無法建立目標目錄 $(dirname "$CORRECTED_FILE")" >&2
		printf '{"error":"Memory 路徑修正失敗：無法建立目標目錄，請手動檢查路徑。"}\n'
		exit 2
	fi
	echo "🔀 Memory 路徑已自動修正：${REASON}" >&2
	echo "   原：${FILE_PATH}" >&2
	echo "   新：${CORRECTED_FILE}" >&2
	UPDATED_TOOL_INPUT=$(printf '%s' "$INPUT" \
		| jq --arg fp "$CORRECTED_FILE" '.tool_input.file_path = $fp | .tool_input')
	jq -n \
		--argjson u "$UPDATED_TOOL_INPUT" \
		'{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",permissionDecisionReason:"Memory path auto-corrected",updatedInput:$u}}'
else
	[ ! -f "$FILE_PATH" ] && exit 0
	if [ -e "$CORRECTED_FILE" ]; then
		echo "⚠️  Memory 路徑疑慮（Edit）：${REASON}" >&2
		echo "   目標路徑已有同名檔案，拒絕覆寫：${CORRECTED_FILE}" >&2
		echo "   請手動決定合併或刪除其中一份。" >&2
		exit 0
	fi
	if ! mkdir -p "$(dirname "$CORRECTED_FILE")" 2>/dev/null; then
		echo "⚠️  Memory 路徑疑慮（Edit）：無法建立目標目錄" >&2
		exit 0
	fi
	if ! mv "$FILE_PATH" "$CORRECTED_FILE" 2>/dev/null; then
		echo "⚠️  Memory 路徑疑慮（Edit）：${REASON}" >&2
		echo "   自動搬移失敗，請手動處理。" >&2
		exit 0
	fi
	echo "🔀 Memory 檔案已自動搬移：${REASON}" >&2
	echo "   原：${FILE_PATH}" >&2
	echo "   新：${CORRECTED_FILE}" >&2
	echo "   📝 提醒：MEMORY.md 對此檔案的連結可能失效，請手動檢查。" >&2
	UPDATED_TOOL_INPUT=$(printf '%s' "$INPUT" \
		| jq --arg fp "$CORRECTED_FILE" '.tool_input.file_path = $fp | .tool_input')
	jq -n \
		--argjson u "$UPDATED_TOOL_INPUT" \
		'{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",permissionDecisionReason:"Memory file auto-relocated",updatedInput:$u}}'
fi

exit 0
