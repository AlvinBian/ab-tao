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

# ── 安全讀取偏好（不 source，只解析已知變數）──────────────────
if [ -f "$PREFS_FILE" ]; then
	_v=$(grep -m1 '^AB_NOTIFY_FLUSH_SECS=[0-9]\+$' "$PREFS_FILE" 2>/dev/null | cut -d= -f2)
	[ -n "$_v" ] && FLUSH_SECS="$_v"
fi

# 查詢事件的通知等級：immediate / batch / silent（預設返回空字串，由 case 決定）
_event_level() {
	local event="$1"
	[ -f "$PREFS_FILE" ] || return 0
	local val
	val=$(grep -m1 "^AB_NOTIFY_LEVEL_${event}=\"[a-z]\+\"$" "$PREFS_FILE" 2>/dev/null | sed 's/.*="\(.*\)"/\1/')
	case "$val" in immediate|batch|silent) printf '%s' "$val" ;; esac
}

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
	local flushing n items
	flushing="${QUEUE_FILE}.flushing.$$"
	mv "$QUEUE_FILE" "$flushing" 2>/dev/null || return
	rm -f "$QUEUE_TIME"
	n=$(wc -l <"$flushing" | tr -d '[:space:]')
	items=$(tr '\n' '·' <"$flushing" | sed 's/·$//')
	rm -f "$flushing"
	_notify "$(printf '%s' "$items" | cut -c1-120)" "${n} 項活動"
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
	# append 必須在持鎖後才執行，避免與 _flush_queue 的 rename 競態
	if [ "$has_lock" -eq 0 ]; then
		printf '%s\n' "$1" >>"$QUEUE_FILE"
		local first_t now
		first_t=$(cat "$QUEUE_TIME" 2>/dev/null || date +%s)
		now=$(date +%s)
		if [ $(( now - first_t )) -ge "$FLUSH_SECS" ]; then
			_flush_queue
		fi
		_release_lock
	else
		# 未取鎖：回退策略，接受輕微競態但不丟失事件
		printf '%s\n' "$1" >>"$QUEUE_FILE"
	fi
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
MSG=$(printf '%s' "$INPUT" | jq -r '.message // empty' 2>/dev/null | cut -c1-80)
EXIT_CODE=$(printf '%s' "$INPUT" | jq -r '.exit_code // empty' 2>/dev/null)
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
TASK_SUBJ=$(printf '%s' "$INPUT" | jq -r '.task_subject // empty' 2>/dev/null)
ERROR_MSG=$(printf '%s' "$INPUT" | jq -r '.error // empty' 2>/dev/null | cut -c1-60)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

# 從 transcript_path 取 repo 名稱（格式：.../projects/-Users-alvin-...-{repo}/...）
if [ -n "$TRANSCRIPT" ]; then
	_dir=$(dirname "$TRANSCRIPT" | xargs basename 2>/dev/null)
	_repo=$(printf '%s' "$_dir" | sed 's/.*-\([^-][^-]*\)$/\1/' 2>/dev/null)
	[ -n "$_repo" ] && [ "$_repo" != "$_dir" ] && TITLE="Claude Code [$_repo]"
fi

case "$EVENT" in
	# 🔴 立即通知
	Notification)
		_level=$(_event_level "Notification")
		[ "$_level" = "silent" ] && exit 0
		case "$NOTIF_TYPE" in
			idle_prompt)         _notify "${MSG:-等待您的指令}" "⏳ 待輸入" ;;
			permission_required) _notify "${MSG:-需要您確認操作}" "🔐 請確認" ;;
		esac
		;;
	PermissionDenied)
		_level=$(_event_level "PermissionDenied")
		[ "$_level" = "silent" ] && exit 0
		[ "$_level" = "batch" ] && _enqueue "⛔ ${MSG:-操作被拒絕}" || _notify "${MSG:-操作被拒絕}" "⛔ 已拒絕"
		;;
	PreCompact)
		_level=$(_event_level "PreCompact")
		[ "$_level" = "silent" ] && exit 0
		[ "$_level" = "batch" ] && _enqueue "⚠️ Context 壓縮中" || _notify "Context 即將壓縮，重要資訊已存入記憶" "⚠️ 壓縮中"
		;;
	# 🟡 匯總通知（含語意標籤）
	Stop)
		_flush_locked
		_level=$(_event_level "Stop")
		[ "$_level" = "silent" ] && exit 0
		if [ -n "$EXIT_CODE" ] && [ "$EXIT_CODE" -ne 0 ] 2>/dev/null; then
			_msg="❌ 執行失敗${MSG:+：$MSG}"
		else
			_msg="✅ ${MSG:-已完成}"
		fi
		[ "$_level" = "immediate" ] && _notify "$_msg" "Stop" || _enqueue "$_msg"
		;;
	SessionEnd)
		_flush_locked
		_level=$(_event_level "SessionEnd")
		[ "$_level" = "silent" ] && exit 0
		_msg="🔚 Session 結束${MSG:+：$MSG}"
		[ "$_level" = "immediate" ] && _notify "$_msg" "SessionEnd" || _enqueue "$_msg"
		;;
	TaskCompleted)
		_level=$(_event_level "TaskCompleted")
		[ "$_level" = "silent" ] && exit 0
		if [ -n "$TASK_SUBJ" ]; then
			_msg="📋 $TASK_SUBJ"
		elif [ -n "$MSG" ]; then
			_msg="📋 $MSG"
		else
			_msg="📋 任務完成"
		fi
		[ "$_level" = "immediate" ] && _notify "$_msg" "TaskCompleted" || _enqueue "$_msg"
		;;
	SubagentStop)
		_level=$(_event_level "SubagentStop")
		[ "$_level" = "silent" ] && exit 0
		_msg="🤖 子代理：${MSG:-完成}"
		[ "$_level" = "immediate" ] && _notify "$_msg" "SubagentStop" || _enqueue "$_msg"
		;;
	PostToolUseFailure)
		_level=$(_event_level "PostToolUseFailure")
		[ "$_level" = "silent" ] && exit 0
		_msg="⚠️ ${TOOL_NAME:-工具}失敗${ERROR_MSG:+：$ERROR_MSG}"
		[ "$_level" = "immediate" ] && _notify "$_msg" "PostToolUseFailure" || _enqueue "$_msg"
		;;
	# 🔵 靜默（不處理）
	*) ;;
esac

exit 0
