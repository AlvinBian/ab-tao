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
	local blocked_cmd reason
	blocked_cmd=$(printf '%s' "$COMMAND" | head -c 100)
	reason="${1:-危險命令已攔截。如需執行請在終端直接操作。}"
	[ -x "$NOTIFY" ] && "$NOTIFY" blocked "危險命令: $blocked_cmd" 2>/dev/null &
	printf '{"error":"危險命令已攔截。如需執行請在終端直接操作。"}\n'
	# ⚠️ exit 2 的原因 Claude Code 只從 **stderr** 讀（實測 2026-08-12：只印 stdout
	#    的話 agent 收到的是「No stderr output」—— 擋是擋住了，但不知道為什麼被擋）。
	printf '%s\n攔截的命令：%s\n' "$reason" "$blocked_cmd" >&2
	exit 2
}

# === 高風險命令：擋下並要求手動處理 ===
#
# ⚠️ 這裡原本是「改寫成安全預覽」（_rewrite → {"decision":"modify",…} + exit 0）。
#    2026-08-12 實測該機制**完全無效**：Claude Code 不認得這個輸出形狀，hook exit 0
#    之後原命令**原樣執行**。canary 實測（建含檔案的暫存目錄再 rm -rf）目錄真的被刪。
#    telemetry 顯示 rewrite:rm-rf 命中 265 次、rewrite:git-push-force 8 次 —— 全是假的保護。
#    更糟的是它 exit 0 的位置在 pattern loop **之前**，等於順手讓 rm -rf 跳過後面所有檢查。
#    改用實測有效的 _block（exit 2）。

# rm -rf：只擋**災難性目標**（/ ~ $HOME 及其直接 glob），日常 rm -rf node_modules 放行。
# 「遞迴旗標」與「災難性目標」分兩條比對，比單一巨型 regex 好讀也好驗。
#
# 命令位置錨定：行首，或 ; & | ` 之後，中間可夾 sudo / env FOO=1 這類前綴指令。
#
# ⚠️ 這條錨定被實測校正過三次，每次都是「擋到正當工作」：
#  1. 原本接受「單純一個空白之後」→ `echo "… rm -rf / …"` 寫文件被擋。收掉空白。
#  2. 加入 `(` 與 `)` 想接住 subshell `(rm -rf /)` → 結果 **`Bash(rm -rf /)` 這種
#     permission deny 規則字串被擋**。這個 workspace 天天在讀寫 permission 規則，
#     而 subshell 形態的意外極罕見 —— 拿掉 `(`／`)`，放棄那個形態。
#  3. 代價一併說清楚：引號內字面量與 subshell 都逃得掉。
#
# 根本原因是字串比對分不出「命令」與「談論命令的文字」，補不完 ——
# 真正的邊界是 OS 層沙箱（settings.json 的 sandbox.enabled，見 docs/en/sandboxing）。
# **這條規則只是意外的安全帶，不是對抗刻意規避的防線，不要再往上加。**
_RM_ANCHOR='(^|[;&|`])[[:space:]]*((sudo|doas|time|nohup|command|exec|xargs|env)[[:space:]]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*'
_RM_RECURSIVE="${_RM_ANCHOR}"'rm([[:space:]]+-[-a-zA-Z]+)*[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)'
_RM_FATAL_TARGET="${_RM_ANCHOR}"'rm([[:space:]]+-[-a-zA-Z]+)+[[:space:]]+("|'"'"')?(/|~|\$\{?HOME\}?)("|'"'"')?(/?\*?)?("|'"'"')?([[:space:]]|$|;|&|\|)'
if printf '%s' "$COMMAND" | grep -Eiq "$_RM_RECURSIVE" &&
	printf '%s' "$COMMAND" | grep -Eiq "$_RM_FATAL_TARGET"; then
	_log_rule_hit 'rm-rf-fatal-target'
	_block "rm -rf 的目標是家目錄或根目錄，已攔截。確認無誤請在終端手動執行。"
fi

# git push --force → 要求先建 backup 分支（全域規則 §05 Git 紅線）
if printf '%s' "$COMMAND" | grep -Eiq 'git[[:space:]].*push[[:space:]].*(--force[^-]|--force$|-f[[:space:]]|-f$)'; then
	_log_rule_hit 'git-push-force'
	_block "git push --force 已攔截。請先 git branch backup/<原分支>，再於終端改用 --force-with-lease。"
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
		# grep 離開碼：0=有匹配 1=無匹配 2=regex 無效。
		# ⚠️ 空輸入對任何正常 pattern 都回 1，原本的 `! grep …` 因此**永遠成立** ——
		#    2026-08-12 實測 13 條 pattern 全被當成「無效」略過，這個擴充機制從頭到尾沒生效過。
		#    只有 >1 才是真的 regex 錯誤。
		printf '' | grep -Eq "$pat" 2>/dev/null
		if [ $? -gt 1 ]; then
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
