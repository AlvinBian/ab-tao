#!/bin/bash
# notify.sh — 統一通知中心
# 用法 1：stdin JSON（Claude Code hook 呼叫）
# 用法 2：notify.sh blocked "描述"（pretooluse-*.sh 呼叫）

QUEUE_FILE="$HOME/.claude/hooks/.notify-queue"
QUEUE_TIME="$HOME/.claude/hooks/.notify-queue.time"
TITLE="Claude Code"
FLUSH_SECS=60

# ── 即時 macOS 通知 ──────────────────────────────────────────────
_notify() {
	local msg="${1:-通知}"
	local subtitle="${2:-}"
	msg="${msg//\"/\'}"
	subtitle="${subtitle//\"/\'}"
	if [ -n "$subtitle" ]; then
		osascript -e "display notification \"$msg\" with title \"$TITLE\" subtitle \"$subtitle\"" 2>/dev/null || true
	else
		osascript -e "display notification \"$msg\" with title \"$TITLE\"" 2>/dev/null || true
	fi
}

# ── 匯總佇列 ─────────────────────────────────────────────────────
_flush_queue() {
	[ -f "$QUEUE_FILE" ] && [ -s "$QUEUE_FILE" ] || { rm -f "$QUEUE_FILE" "$QUEUE_TIME"; return; }
	local n items
	n=$(wc -l <"$QUEUE_FILE" | tr -d '[:space:]')
	items=$(tr '\n' '·' <"$QUEUE_FILE" | sed 's/·$//' | cut -c1-120)
	rm -f "$QUEUE_FILE" "$QUEUE_TIME"
	_notify "Claude Code（${n} 項活動）：${items}"
}

_enqueue() {
	mkdir -p "$(dirname "$QUEUE_FILE")"
	[ -f "$QUEUE_TIME" ] || date +%s >"$QUEUE_TIME"
	printf '%s\n' "$1" >>"$QUEUE_FILE"

	local first_t now
	first_t=$(cat "$QUEUE_TIME" 2>/dev/null || date +%s)
	now=$(date +%s)
	if [ $(( now - first_t )) -ge "$FLUSH_SECS" ]; then
		_flush_queue
	fi
}

# ── 模式 1：blocked 自訂呼叫 ─────────────────────────────────────
if [ "${1:-}" = "blocked" ]; then
	_notify "${2:-操作被攔截}" "⛔ 已攔截"
	exit 0
fi

# ── 模式 2：stdin JSON（hook 呼叫）───────────────────────────────
INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

EVENT=$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null)
NOTIF_TYPE=$(printf '%s' "$INPUT" | jq -r '.notification_type // empty' 2>/dev/null)
MSG=$(printf '%s' "$INPUT" | jq -r '.message // empty' 2>/dev/null | head -c 100)
EXIT_CODE=$(printf '%s' "$INPUT" | jq -r '.exit_code // empty' 2>/dev/null)

case "$EVENT" in
	# 🔴 立即通知
	Notification)
		case "$NOTIF_TYPE" in
			idle_prompt) _notify "${MSG:-等待指令}" "⏳ 待輸入" ;;
			permission_required) _notify "${MSG:-需要授權}" "🔐 請確認" ;;
		esac
		;;
	PermissionDenied)
		_notify "${MSG:-操作被拒絕}" "⛔ 已拒絕"
		;;
	# 🟡 匯總通知
	Stop)
		if [ -n "$EXIT_CODE" ] && [ "$EXIT_CODE" != "0" ]; then
			_notify "${MSG:-執行失敗}" "❌ 錯誤"
		else
			_enqueue "${MSG:-已完成}"
		fi
		;;
	SubagentStop) _enqueue "${MSG:-子代理完成}" ;;
	PreCompact) _enqueue "Context 壓縮中" ;;
	PostToolUse)
		[ -n "$EXIT_CODE" ] && [ "$EXIT_CODE" != "0" ] && _enqueue "${MSG:-工具失敗}"
		;;
	# 🔵 靜默（不處理）
	*) ;;
esac

exit 0
