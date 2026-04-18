#!/bin/bash
# stop.sh — Stop macOS 通知 + 會話評估

QUEUE_FILE="$HOME/.claude/hooks/.notify-queue"
QUEUE_TIME="$HOME/.claude/hooks/.notify-queue.time"
LOCK_DIR="$HOME/.claude/hooks/.notify-queue.lock"
PREFS_FILE="$HOME/.claude/hooks/.prefs"
TITLE="Claude Code"
FLUSH_SECS=60

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
MSG=$(printf '%s' "$INPUT" | jq -r '.message // empty' 2>/dev/null | head -c 80)
EXIT_CODE=$(printf '%s' "$INPUT" | jq -r '.exit_code // empty' 2>/dev/null)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)

# 偏好設定：FLUSH_SECS
if [ -f "$PREFS_FILE" ]; then
	_v=$(grep -m1 '^AB_NOTIFY_FLUSH_SECS=[0-9]\+$' "$PREFS_FILE" 2>/dev/null | cut -d= -f2)
	[ -n "$_v" ] && FLUSH_SECS="$_v"
fi

# Repo name from transcript path
if [ -n "$TRANSCRIPT" ]; then
	_dir=$(dirname "$TRANSCRIPT" | xargs basename 2>/dev/null)
	_repo=$(printf '%s' "$_dir" | sed 's/.*-\([^-][^-]*\)$/\1/' 2>/dev/null)
	[ -n "$_repo" ] && [ "$_repo" != "$_dir" ] && TITLE="Claude Code [$_repo]"
fi

_notify() {
	local msg="${1:-通知}" subtitle="${2:-}"
	command -v osascript &>/dev/null || return 0
	if [ -n "$subtitle" ]; then
		osascript -e 'on run argv' \
			-e '  display notification (item 1 of argv) with title (item 2 of argv) subtitle (item 3 of argv)' \
			-e 'end run' -- "$msg" "$TITLE" "$subtitle" 2>/dev/null || true
	else
		osascript -e 'on run argv' \
			-e '  display notification (item 1 of argv) with title (item 2 of argv)' \
			-e 'end run' -- "$msg" "$TITLE" 2>/dev/null || true
	fi
}

_acquire_lock() {
	if [ -d "$LOCK_DIR" ]; then
		local created
		created=$(stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR" 2>/dev/null || echo 0)
		[ $(( $(date +%s) - created )) -gt 5 ] 2>/dev/null && rmdir "$LOCK_DIR" 2>/dev/null
	fi
	mkdir "$LOCK_DIR" 2>/dev/null
}
_release_lock() { rmdir "$LOCK_DIR" 2>/dev/null || true; }

_flush_queue() {
	[ -f "$QUEUE_FILE" ] && [ -s "$QUEUE_FILE" ] || { rm -f "$QUEUE_FILE" "$QUEUE_TIME"; return; }
	local n body overflow
	n=$(wc -l <"$QUEUE_FILE" | tr -d '[:space:]')
	if [ "$n" -le 5 ]; then
		body=$(sed 's/^/• /' "$QUEUE_FILE")
	else
		overflow=$(( n - 5 ))
		body=$(head -5 "$QUEUE_FILE" | sed 's/^/• /')
		body="${body}"$'\n'"  …還有 ${overflow} 項"
	fi
	rm -f "$QUEUE_FILE" "$QUEUE_TIME"
	_notify "$body" "${n} 項活動"
}

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
	if [ "$has_lock" -eq 0 ] && [ $(( now - first_t )) -ge "$FLUSH_SECS" ]; then
		_flush_queue
	fi
	[ "$has_lock" -eq 0 ] && _release_lock
}

# Flush queued items then enqueue this stop event
_flush_locked

if [ -n "$EXIT_CODE" ] && [ "$EXIT_CODE" -ne 0 ] 2>/dev/null; then
	_enqueue "❌ 執行失敗${MSG:+：$MSG}"
else
	_enqueue "✅ ${MSG:-已完成}"
fi

exit 0
