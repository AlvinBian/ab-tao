#!/usr/bin/env bash
# session-end.sh — SessionEnd plan 歸位 + memory decay scan + flush 通知

QUEUE_FILE="$HOME/.claude/hooks/.notify-queue"
QUEUE_TIME="$HOME/.claude/hooks/.notify-queue.time"
LOCK_DIR="$HOME/.claude/hooks/.notify-queue.lock"
PREFS_FILE="$HOME/.claude/hooks/.prefs"
TITLE="Claude Code"
FLUSH_SECS=60

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
MSG=$(printf '%s' "$INPUT" | jq -r '.message // empty' 2>/dev/null | head -c 80)

# 偏好設定
if [ -f "$PREFS_FILE" ]; then
	_v=$(grep -m1 '^AB_NOTIFY_FLUSH_SECS=[0-9]\+$' "$PREFS_FILE" 2>/dev/null | cut -d= -f2)
	[ -n "$_v" ] && FLUSH_SECS="$_v"
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

# ── Part 1: Flush + SessionEnd 通知 ──────────────────────────────
_flush_locked
_enqueue "🔚 Session 結束${MSG:+：$MSG}"

# ── Part 2: Plan 歸位 ────────────────────────────────────────────
PLANS_DIR="$HOME/.claude/plans"
PROJECTS_DIR="$HOME/.claude/projects"
RELOCATED_MARKER="$HOME/.claude/.plans-relocated"

if [ -n "$CWD" ] && [ -d "$PLANS_DIR" ] && [ -d "$CWD/.git" ]; then
	ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
	TARGET_PLANS_DIR="$PROJECTS_DIR/$ENCODED/plans"

	relocated_slugs=""
	[ -f "$RELOCATED_MARKER" ] && relocated_slugs=$(cat "$RELOCATED_MARKER")

	for plan_file in "$PLANS_DIR"/*.md; do
		[ -f "$plan_file" ] || continue
		slug=$(basename "$plan_file")
		[ "$slug" = "README.md" ] && continue
		printf '%s\n' "$relocated_slugs" | grep -qxF "$slug" && continue

		mkdir -p "$TARGET_PLANS_DIR"
		if cp "$plan_file" "$TARGET_PLANS_DIR/$slug" 2>/dev/null; then
			rm -f "$plan_file"
			index_file="$TARGET_PLANS_DIR/index.md"
			entry="- [$slug](./$slug)"
			if [ ! -f "$index_file" ]; then
				printf '# Plans\n\n%s\n' "$entry" > "$index_file"
			elif ! grep -qF "./$slug" "$index_file" 2>/dev/null; then
				printf '\n%s\n' "$entry" >> "$index_file"
			fi
			printf '%s\n' "$slug" >> "$RELOCATED_MARKER"
			relocated_slugs="$relocated_slugs
$slug"
			printf '[session-end] 計畫已歸位：%s → %s\n' "$slug" "$TARGET_PLANS_DIR" >&2
		fi
	done
fi

# ── Part 3: Memory decay scan（90 天未存取提示歸檔）────────────────
THRESHOLD_SECS=$(( 90 * 86400 ))
NOW=$(date +%s)
decay_count=0

for proj_dir in "$PROJECTS_DIR"/*/memory/; do
	[ -d "$proj_dir" ] || continue
	memory_md="${proj_dir}MEMORY.md"
	[ -f "$memory_md" ] || continue
	last_mod=$(stat -f %m "$memory_md" 2>/dev/null || stat -c %Y "$memory_md" 2>/dev/null || echo 0)
	age=$(( NOW - last_mod ))
	if [ "$age" -gt "$THRESHOLD_SECS" ]; then
		proj_name=$(dirname "$proj_dir" | xargs basename 2>/dev/null)
		printf '[session-end] ⏳ 超過 90 天未存取的記憶：%s\n' "$proj_name" >&2
		decay_count=$((decay_count + 1))
	fi
done

[ "$decay_count" -gt 0 ] && \
	printf '[session-end] 建議將以上 %d 個舊記憶歸檔至 archive/\n' "$decay_count" >&2

# ── Part 4: 清理 30 天以上的 .bak 備份 ──────────────────────────
BACKUP_SECS=$(( 30 * 86400 ))
find "$HOME/.claude" -maxdepth 1 -name "*.bak.*" 2>/dev/null | while IFS= read -r bak; do
	ts=$(printf '%s' "$bak" | grep -o '\.[0-9]\{10,\}$' | tr -d '.' 2>/dev/null)
	[ -z "$ts" ] && continue
	age=$(( NOW - ts ))
	if [ "$age" -gt "$BACKUP_SECS" ]; then
		rm -f "$bak" 2>/dev/null && \
			printf '[session-end] 已清理舊備份：%s\n' "$(basename "$bak")" >&2
	fi
done

exit 0
