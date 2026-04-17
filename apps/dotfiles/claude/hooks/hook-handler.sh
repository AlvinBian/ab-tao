#!/bin/bash
# hook-handler.sh — 統一事件處理器
# 用法 1：stdin JSON（Claude Code hook 呼叫）
# 用法 2：hook-handler.sh blocked "描述"（protect-files.sh 等呼叫）

QUEUE_FILE="$HOME/.claude/hooks/.notify-queue"
QUEUE_TIME="$HOME/.claude/hooks/.notify-queue.time"
LOCK_DIR="$HOME/.claude/hooks/.notify-queue.lock"
TITLE="Claude Code"
PREFS_FILE="$HOME/.claude/hooks/.prefs"
FLUSH_SECS=60

# ── 安全讀取偏好（不 source，只解析已知數值型變數）──────────────
if [ -f "$PREFS_FILE" ]; then
	_v=$(grep -m1 '^AB_NOTIFY_FLUSH_SECS=[0-9]\+$' "$PREFS_FILE" 2>/dev/null | cut -d= -f2)
	[ -n "$_v" ] && FLUSH_SECS="$_v"
fi

# ── 原子鎖（基於 mkdir，macOS/Linux 可移植）────────────────────
_acquire_lock() {
	# 清除超過 5 秒的殭屍鎖（防死鎖）
	if [ -d "$LOCK_DIR" ]; then
		local created
		created=$(stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR" 2>/dev/null || echo 0)
		[ $(( $(date +%s) - created )) -gt 5 ] 2>/dev/null && rmdir "$LOCK_DIR" 2>/dev/null
	fi
	mkdir "$LOCK_DIR" 2>/dev/null
}
_release_lock() { rmdir "$LOCK_DIR" 2>/dev/null || true; }

# ── 即時 macOS 通知（argv 傳參，防 $() 注入）────────────────────
_notify() {
	local msg="${1:-通知}"
	local subtitle="${2:-}"
	command -v osascript &>/dev/null || return 0
	if [ -n "$subtitle" ]; then
		osascript \
			-e 'on run argv' \
			-e '  display notification (item 1 of argv) with title (item 2 of argv) subtitle (item 3 of argv)' \
			-e 'end run' \
			-- "$msg" "$TITLE" "$subtitle" 2>/dev/null || true
	else
		osascript \
			-e 'on run argv' \
			-e '  display notification (item 1 of argv) with title (item 2 of argv)' \
			-e 'end run' \
			-- "$msg" "$TITLE" 2>/dev/null || true
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

# 持鎖版 flush（供 Stop/SessionEnd 直接呼叫）
_flush_locked() {
	if _acquire_lock; then
		_flush_queue
		_release_lock
	fi
}

_enqueue() {
	_acquire_lock
	local has_lock=$?

	mkdir -p "$(dirname "$QUEUE_FILE")"
	[ -f "$QUEUE_TIME" ] || date +%s >"$QUEUE_TIME"
	printf '%s\n' "$1" >>"$QUEUE_FILE"

	local first_t now
	first_t=$(cat "$QUEUE_TIME" 2>/dev/null || date +%s)
	now=$(date +%s)
	# 只有持鎖時才執行 flush（避免與其他 process 重複 flush）
	if [ "$has_lock" -eq 0 ] && [ $(( now - first_t )) -ge "$FLUSH_SECS" ]; then
		_flush_queue
	fi

	[ "$has_lock" -eq 0 ] && _release_lock
}

# ── 模式 1：blocked 自訂呼叫 ─────────────────────────────────────
if [ "${1:-}" = "blocked" ]; then
	_notify "${2:-操作被攔截}" "⛔ 已攔截"
	exit 0
fi

# ── 模式 2：stdin JSON（hook 呼叫）───────────────────────────────
command -v jq &>/dev/null || exit 0

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

EVENT=$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null)
NOTIF_TYPE=$(printf '%s' "$INPUT" | jq -r '.notification_type // empty' 2>/dev/null)
MSG=$(printf '%s' "$INPUT" | jq -r '.message // empty' 2>/dev/null | head -c 100)
EXIT_CODE=$(printf '%s' "$INPUT" | jq -r '.exit_code // empty' 2>/dev/null)
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
TASK_SUBJ=$(printf '%s' "$INPUT" | jq -r '.task_subject // empty' 2>/dev/null)
ERROR_MSG=$(printf '%s' "$INPUT" | jq -r '.error // empty' 2>/dev/null | head -c 100)

case "$EVENT" in
	# 🔴 立即通知
	Notification)
		case "$NOTIF_TYPE" in
			idle_prompt)         _notify "${MSG:-等待指令}" "⏳ 待輸入" ;;
			permission_required) _notify "${MSG:-需要授權}" "🔐 請確認" ;;
		esac
		;;
	PermissionDenied)
		_notify "${MSG:-操作被拒絕}" "⛔ 已拒絕"
		;;
	PreCompact)
		_notify "Context 壓縮中" "⚠️ 壓縮"
		;;
	# 🟡 先 flush 舊佇列，再處理當前事件
	Stop)
		_flush_locked
		if [ -n "$EXIT_CODE" ] && [ "$EXIT_CODE" -ne 0 ] 2>/dev/null; then
			_notify "${MSG:-執行失敗}" "❌ 錯誤"
		else
			_enqueue "${MSG:-已完成}"
		fi
		;;
	SessionEnd)
		_flush_locked
		_enqueue "${MSG:-Session 結束}"
		;;
	TaskCompleted)
		_enqueue "${TASK_SUBJ:-任務完成}"
		;;
	SubagentStop)
		_enqueue "${MSG:-子代理完成}"
		;;
	PostToolUseFailure)
		_enqueue "${TOOL_NAME:-工具} 失敗${ERROR_MSG:+：$ERROR_MSG}"
		;;
	# 🔵 靜默（不處理）
	*) ;;
esac

exit 0
