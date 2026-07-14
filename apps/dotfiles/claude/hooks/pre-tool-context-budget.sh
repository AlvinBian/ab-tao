#!/bin/bash
# pre-tool-context-budget.sh — PreToolUse (Read|Glob|Grep) Context budget 監控（Wave 2.3）
# 統計當前 session 的檔案讀取操作數，超過閾值時 stdout 注入提示，不阻擋（exit 0）
# 用小時級 bucket 作 session 邊界近似；同一小時內累計

SETTINGS="$HOME/.claude/settings.json"
THRESHOLD=12
if command -v jq &>/dev/null && [[ -f "$SETTINGS" ]]; then
	val=$(jq -r '._abTao.contextBudgetFileCount // empty' "$SETTINGS" 2>/dev/null)
	[[ -n "$val" ]] && THRESHOLD="$val"
fi

# 每小時一個計數 bucket，2 小時前的 bucket 清除
HOUR=$(date +%Y%m%d%H)
BUCKET_FILE="/tmp/ab-tao-ctx-${HOUR}"

# 清理 2 小時前的舊 bucket（非阻塞）
find /tmp -name "ab-tao-ctx-*" -mmin +120 -delete 2>/dev/null &

# 讀取並遞增計數
COUNT=0
if [[ -f "$BUCKET_FILE" ]]; then
	COUNT=$(cat "$BUCKET_FILE" 2>/dev/null || echo 0)
fi
COUNT=$((COUNT + 1))
printf '%d' "$COUNT" > "$BUCKET_FILE"

# 超過閾值時注入提示
# ⚠️ PreToolUse 的 context 注入必須走 hookSpecificOutput.additionalContext JSON，
#    裸 stdout 只進 debug log 不會注入（2026-07 實測修復，勿改回 printf 直印）
if [[ $COUNT -gt $THRESHOLD ]] && command -v jq &>/dev/null; then
	CTX=$(printf '[context-budget] 此 session 已讀取 %d 個檔案（閾值 %d）。建議：改用 codebase-memory search_graph 或 Explore subagent 集中查找，避免逐檔 Read。' "$COUNT" "$THRESHOLD")
	jq -nc --arg ctx "$CTX" \
		'{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$ctx}}'
fi

exit 0
