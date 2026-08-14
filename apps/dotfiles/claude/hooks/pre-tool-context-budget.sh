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

# 清理 2 小時前的舊 bucket（非阻塞，節流：距上次清理 <3600 秒直接跳過）
CLEANUP_MARKER="/tmp/ab-tao-ctx-cleanup-marker"
LAST_CLEANUP=0
[[ -f "$CLEANUP_MARKER" ]] && LAST_CLEANUP=$(cat "$CLEANUP_MARKER" 2>/dev/null || echo 0)
NOW_EPOCH=$(date +%s)
if [[ $(( NOW_EPOCH - LAST_CLEANUP )) -ge 3600 ]]; then
	find /tmp -name "ab-tao-ctx-*" -mmin +120 -delete 2>/dev/null &
	printf '%s' "$NOW_EPOCH" > "$CLEANUP_MARKER" 2>/dev/null
fi

# 讀取並遞增計數
COUNT=0
if [[ -f "$BUCKET_FILE" ]]; then
	COUNT=$(cat "$BUCKET_FILE" 2>/dev/null || echo 0)
fi
COUNT=$((COUNT + 1))
printf '%d' "$COUNT" > "$BUCKET_FILE"

# 超過閾值時注入提示（含冷卻）
# ⚠️ PreToolUse 的 context 注入必須走 hookSpecificOutput.additionalContext JSON，
#    裸 stdout 只進 debug log 不會注入（2026-07 實測修復，勿改回 printf 直印）
#
# 冷卻機制（2026-08-13 新增）：原本一旦過閾值就「每次 Read/Glob/Grep 都重罰一次」，
# 實測單一 session 從第 13 次到第 41 次連續注入同一句 ~190 B 提示（約 60–90 tokens/次），
# 邊際價值遞減到零卻持續佔 context。改為：首次越線提醒一次，之後每 REMIND_EVERY 次才再提醒。
# 用純算術判定，不引入額外 marker 檔（bucket 計數本身已足夠決定，且天然隨 bucket 過期重置）。
REMIND_EVERY=25
if [[ $COUNT -gt $THRESHOLD ]] && command -v jq &>/dev/null; then
	OVER=$(( COUNT - THRESHOLD - 1 ))
	if [[ $(( OVER % REMIND_EVERY )) -eq 0 ]]; then
		if [[ $OVER -eq 0 ]]; then
			CTX=$(printf '[context-budget] 此 session 已讀取 %d 個檔案（閾值 %d）。建議改用 codebase-memory search_graph 或 Explore subagent 集中查找，避免逐檔 Read。（本提醒每 %d 次才再出現一次）' "$COUNT" "$THRESHOLD" "$REMIND_EVERY")
		else
			CTX=$(printf '[context-budget] 已讀取 %d 個檔案（超出閾值 %d 達 %d 次）。逐檔 Read 的成本正在累積，請確認是否該改用 search_graph / Explore subagent。' "$COUNT" "$THRESHOLD" "$OVER")
		fi
		jq -nc --arg ctx "$CTX" \
			'{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$ctx}}'
	fi
fi

exit 0
