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
	# gstack guard — 高風險操作（網路發布）
	# 註：--force-with-lease 不再攔截（W3）——上方 rewrite 規則已建議改用它，
	# 若再硬擋形成「叫你用又擋你用」的自相矛盾；純 --force 攔截仍保留（見上）
	'npm[[:space:]]+publish([[:space:]]|$)'
	'yarn[[:space:]]+publish([[:space:]]|$)'
	'pnpm[[:space:]]+publish([[:space:]]|$)'
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

# === gh 寫入通道守門（2026-08-06）─────────────────────────────────────
# 背景：settings.json 的 `Bash(gh pr merge *)` deny 擋得住子命令，卻擋不住
#       `gh api -X PUT /repos/{o}/{r}/pulls/{n}/merge` 這種等效寫入。
# 規則：`gh api` 帶明確寫入方法（-X/--method PUT|POST|DELETE|PATCH）一律 block。
# 例外：GraphQL 查詢天生走 POST，且多為讀取 → 命令含 `graphql` 時不攔
#       （真要用 GraphQL mutation 請改走對應的 gh 子命令，會受各自的 deny 規則管）。
# ⚠️ 必須錨定「命令位置」（行首或 ; & | ( ` 之後）：否則會誤擋「命令字串裡剛好提到這些字」的
#    情況，例如 heredoc 內的 python 字面量、寫文件、grep 自己的規則。
_GH_POS='(^|[;&|(`])[[:space:]]*gh[[:space:]]+'
if printf '%s' "$COMMAND" | grep -Eiq "${_GH_POS}api([[:space:]]|$)"; then
	if ! printf '%s' "$COMMAND" | grep -Eiq 'graphql'; then
		if printf '%s' "$COMMAND" | grep -Eiq -- '(-X|--method)[[:space:]]*=?[[:space:]]*"?(PUT|POST|DELETE|PATCH)'; then
			_log_rule_hit 'gh-api-write-method'
			_block
		fi
	fi
fi

# `gh repo delete` — 不可逆且 token 帶 delete_repo scope，硬擋
if printf '%s' "$COMMAND" | grep -Eiq "${_GH_POS}repo[[:space:]]+delete([[:space:]]|$)"; then
	_log_rule_hit 'gh-repo-delete'
	_block
fi

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

# === Warn-only：裸 git commit / git push 三豁免提醒（W3）─────────────
# 純提醒、不阻斷（exit 0）。走到這裡代表命令未被上方 deny/rewrite 規則攔截，
# 即已排除 --no-verify（deny）與 git push --force（rewrite）等已處理的情境。
# 注意：不誤傷 `git commit --help` 之類的查詢；字串中恰好含 "git commit/push"
# 的其他無害命令可接受誤報（warn-only 無害）。
if printf '%s' "$COMMAND" | grep -Eiq 'git[[:space:]]+(commit|push)([[:space:]]|$)' \
	&& ! printf '%s' "$COMMAND" | grep -Eiq 'git[[:space:]]+(commit|push)[^|;&]*[[:space:]](--help|-h)([[:space:]]|$)'; then
	CTX='git commit/push 三豁免檢查：①當前 turn 動作語義明示 ②plan frontmatter autoCommit ③自動化迴圈——皆不滿足時先呈現 diff 問 [Y/N]（§05-security）'
	jq -nc --arg ctx "$CTX" \
		'{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$ctx}}'
fi

exit 0
