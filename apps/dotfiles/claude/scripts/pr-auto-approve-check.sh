#!/usr/bin/env bash
# pr-auto-approve-check.sh — §05 `gh pr review --approve` 六條件護欄之可程式化三項（③④⑤）+ 安全閥
#
# ①verdict 本輪自查 / ②P0/P1 / ⑥完成閘門對齊當前 head 無法從 GitHub API 直接判定，
# 一律列入 manual_checks，交由呼叫端（模型）人工核對；本腳本只負責客觀可查的部分。
#
# 用法：pr-auto-approve-check.sh <PR番號或URL> [--repo owner/name]
# 輸出：單行 JSON {"eligible":bool,"blockers":[...],"manual_checks":[...]}
#
# gh pr view --json 欄位已用真實 PR 實測確認（2026-07-17）：
#   statusCheckRollup[] 有兩種 __typename：
#     CheckRun     → 用 .conclusion（SUCCESS/FAILURE/SKIPPED/...）+ .status（COMPLETED/...）
#     StatusContext（legacy commit status）→ 用 .state（SUCCESS/FAILURE/PENDING/ERROR）
#   reviews[] 為完整歷史紀錄（非僅最新），需 group_by(author.login) 取每人最新一筆
#   才能正確判斷「現行 CHANGES_REQUESTED 未撤銷」（撤銷 = 該作者之後又送出新 review）

PR_ARG=""
REPO=""

while [ $# -gt 0 ]; do
	case "$1" in
	--repo)
		REPO="${2:-}"
		shift 2
		;;
	*)
		[ -z "$PR_ARG" ] && PR_ARG="$1"
		shift
		;;
	esac
done

_emit() {
	local eligible="$1" blockers_json="$2"
	jq -nc \
		--argjson eligible "$eligible" \
		--argjson blockers "$blockers_json" \
		'{eligible:$eligible,blockers:$blockers,manual_checks:["①verdict 本輪自查","②P0/P1","⑥head 對齊"]}'
}

command -v jq &>/dev/null || {
	printf '{"eligible":false,"blockers":["jq 未安裝"],"manual_checks":["①verdict 本輪自查","②P0/P1","⑥head 對齊"]}\n'
	exit 0
}
command -v gh &>/dev/null || { _emit false '["gh CLI 未安裝"]'; exit 0; }
[ -z "$PR_ARG" ] && { _emit false '["缺少 PR 番號或 URL"]'; exit 0; }

gh auth status &>/dev/null || { _emit false '["gh 未登入"]'; exit 0; }

GH_ARGS=("$PR_ARG" --json mergeable,mergeStateStatus,statusCheckRollup,files,reviews,headRefOid)
[ -n "$REPO" ] && GH_ARGS+=(--repo "$REPO")

RAW=$(gh pr view "${GH_ARGS[@]}" 2>/dev/null)
if [ -z "$RAW" ] || ! printf '%s' "$RAW" | jq -e . >/dev/null 2>&1; then
	_emit false '["gh pr view 查詢失敗"]'
	exit 0
fi

BLOCKERS=()

# ④ mergeable ≠ CONFLICTING
MERGEABLE=$(printf '%s' "$RAW" | jq -r '.mergeable // "UNKNOWN"')
[ "$MERGEABLE" = "CONFLICTING" ] && BLOCKERS+=("④ mergeable=CONFLICTING")

# ⑤ CI / status checks 非失敗態（CheckRun 用 conclusion，legacy StatusContext 用 state）
CI_FAIL=$(printf '%s' "$RAW" | jq -r '
	[.statusCheckRollup[]? | (.conclusion // .state // "")] |
	map(select(test("FAILURE|ERROR"; "i"))) | length
' 2>/dev/null)
[[ "$CI_FAIL" =~ ^[0-9]+$ ]] || CI_FAIL=0
[ "$CI_FAIL" -gt 0 ] && BLOCKERS+=("⑤ CI/status checks 有 ${CI_FAIL} 項 failure/error")

# ③ 敏感路徑（大小寫不敏感、部分匹配）
SENSITIVE_HIT=$(printf '%s' "$RAW" | jq -r '
	[.files[]?.path] |
	map(select(test("auth|payment|billing|migration|\\.sql$|crypto|permissions|\\.env|secrets"; "i"))) |
	join(",")
' 2>/dev/null)
[ -n "$SENSITIVE_HIT" ] && BLOCKERS+=("③ 敏感路徑：${SENSITIVE_HIT}")

# 安全閥：每位 reviewer 取「最新一筆」review，若仍是 CHANGES_REQUESTED 視為未撤銷
# （撤銷 = 該作者之後又送出新 review，覆蓋掉舊的 CHANGES_REQUESTED 狀態）
CHANGES_REQUESTED=$(printf '%s' "$RAW" | jq -r '
	(.reviews // [])
	| group_by(.author.login)
	| map(max_by(.submittedAt))
	| map(select(.state == "CHANGES_REQUESTED"))
	| length
' 2>/dev/null)
[[ "$CHANGES_REQUESTED" =~ ^[0-9]+$ ]] || CHANGES_REQUESTED=0
[ "$CHANGES_REQUESTED" -gt 0 ] && BLOCKERS+=("安全閥：有未撤銷的 CHANGES_REQUESTED")

if [ "${#BLOCKERS[@]}" -eq 0 ]; then
	ELIGIBLE=true
	BLOCKERS_JSON="[]"
else
	ELIGIBLE=false
	BLOCKERS_JSON=$(printf '%s\n' "${BLOCKERS[@]}" | jq -R . | jq -sc .)
fi

_emit "$ELIGIBLE" "$BLOCKERS_JSON"
