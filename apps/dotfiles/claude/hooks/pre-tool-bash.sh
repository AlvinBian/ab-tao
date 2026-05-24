#!/bin/bash
# pre-tool-bash.sh — PreToolUse (Bash) 危險命令攔截 + 安全改寫

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

NOTIFY="$HOME/.claude/hooks/hook-handler.sh"
PATTERNS_FILE="$HOME/.claude/hooks/.dangerous-patterns"

_log_rule_hit() {
	local rule="${1:-unknown}"
	local dir="$HOME/.claude/telemetry"
	mkdir -p "$dir"
	printf '{"ts":"%s","hook":"pre-tool-bash","rule":"%s","matched":true}\n' \
		"$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)" \
		"$(printf '%s' "$rule" | head -c 60 | tr '"\\' '  ')" \
		>> "$dir/rule-hits-${HOSTNAME%%.*}.jsonl" 2>/dev/null &
}

_block() {
	local blocked_cmd
	blocked_cmd=$(printf '%s' "$COMMAND" | head -c 100)
	[ -x "$NOTIFY" ] && "$NOTIFY" blocked "危險命令: $blocked_cmd" 2>/dev/null &
	printf '{"error":"危險命令已攔截。如需執行請在終端直接操作。"}\n'
	exit 2
}

_rewrite() {
	local safe_cmd="$1" rule="${2:-rewrite}"
	_log_rule_hit "rewrite:${rule}"
	local escaped
	escaped=$(printf '%s' "$safe_cmd" | sed 's/\\/\\\\/g; s/"/\\"/g')
	printf '{"decision":"modify","modified_input":{"command":"%s"}}\n' "$escaped"
	exit 0
}

# === Rewrite rules（T6-9）— 改寫為安全預覽，優先於 deny ===

# rm -rf → ls 預覽（sudo rm 仍走 deny）
if printf '%s' "$COMMAND" | grep -Eiq 'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*[fF]'; then
	_TARGET=$(printf '%s' "$COMMAND" | awk '{print $NF}')
	if [ -n "$_TARGET" ] && [ "$_TARGET" != "$COMMAND" ]; then
		_SAFE="ls -la ${_TARGET} 2>&1; echo '⚠️  rm -rf 已轉為 ls 預覽。確認後在終端手動執行: rm -rf ${_TARGET}'"
	else
		_SAFE="echo '⚠️  rm -rf 已攔截。請在終端確認目標後手動執行。'"
	fi
	_rewrite "$_SAFE" "rm-rf"
fi

# git push --force → 提示先建 backup（--force-with-lease 仍走 deny by gstack guard）
if printf '%s' "$COMMAND" | grep -Eiq 'git[[:space:]].*push[[:space:]].*(--force[^-]|--force$|-f[[:space:]]|-f$)'; then
	_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "current-branch")
	_SAFE="echo '⚠️  git push --force 已攔截。請先建 backup: git branch backup/${_BRANCH} 後改用 git push --force-with-lease'"
	_rewrite "$_SAFE" "git-push-force"
fi

# 內建 pattern（永遠執行，不受自訂檔案影響）
BUILTIN_PATTERNS=(
	'sudo[[:space:]]+rm[[:space:]]'
	':[[:space:]]*\(\)[[:space:]]*\{'
	'chmod[[:space:]]+0*777'
	'dd[[:space:]].*if=/dev/(zero|random|urandom)'
	'mkfs\.'
	'(^|[[:space:]])shred[[:space:]]'
	'(^|[[:space:]])wipefs([[:space:]]|$)'
	'DROP[[:space:]]+TABLE'
	'curl[[:space:]].*\|[[:space:]]*(bash|sh)'
	'wget[[:space:]].*\|[[:space:]]*(bash|sh)'
	'eval[[:space:]].*base64'
	'eval[[:space:]]*\$\('
	# 破壞性 git 操作（stream-rule §6 的 hook 強制兜底）
	'git[[:space:]].*reset[[:space:]].*(--hard|-hard)'
	'git[[:space:]].*commit[[:space:]].*--no-verify'
	'git[[:space:]].*push[[:space:]].*--no-verify'
	'git[[:space:]].*merge[[:space:]].*--no-verify'
	# gstack guard — 高風險操作（網路發布 / force-with-lease 變體）
	'npm[[:space:]]+publish([[:space:]]|$)'
	'yarn[[:space:]]+publish([[:space:]]|$)'
	'pnpm[[:space:]]+publish([[:space:]]|$)'
	'git[[:space:]].*push[[:space:]].*--force-with-lease'
	'npx[[:space:]]+.*--yes[[:space:]].*exec'
	'>[[:space:]]*/etc/'
	'chmod[[:space:]]+[0-7]*[2367][[:space:]]'
)
for pattern in "${BUILTIN_PATTERNS[@]}"; do
	if printf '%s' "$COMMAND" | grep -Eiq "$pattern"; then
		_log_rule_hit "$pattern"
		_block
	fi
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
