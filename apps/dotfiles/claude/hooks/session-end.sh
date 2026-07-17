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

# 解析 frontmatter 欄位（bash + sed，無 yq 依賴）
parse_frontmatter() {
	local file=$1 key=$2
	sed -n "/^---$/,/^---$/p" "$file" 2>/dev/null | \
		sed -n "s/^${key}:[[:space:]]*//p" | head -1
}

# 移除 [ -d "$CWD/.git" ] 守門：非 git 目錄也要歸位
if [ -n "$CWD" ] && [ -d "$PLANS_DIR" ]; then
	ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
	TARGET_PLANS_DIR="$PROJECTS_DIR/$ENCODED/plans"

	relocated_slugs=""
	[ -f "$RELOCATED_MARKER" ] && relocated_slugs=$(cat "$RELOCATED_MARKER")

	for plan_file in "$PLANS_DIR"/*.md; do
		[ -f "$plan_file" ] || continue
		orig_slug=$(basename "$plan_file")
		[ "$orig_slug" = "README.md" ] && continue
		printf '%s\n' "$relocated_slugs" | grep -qxF "$orig_slug" && continue

		# 解析 frontmatter 命名規則
		ticket=$(parse_frontmatter "$plan_file" "ticket")
		topic=$(parse_frontmatter "$plan_file" "topic")

		if [ -n "$ticket" ] && [ -n "$topic" ]; then
			new_slug="${ticket}-${topic}.md"
		elif [ -n "$topic" ]; then
			new_slug="${topic}.md"
		elif [ -n "$ticket" ]; then
			new_slug="${ticket}.md"
		else
			new_slug="$orig_slug"
		fi

		mkdir -p "$TARGET_PLANS_DIR"

		# 衝突處理：append -2, -3 ...
		target_file="$TARGET_PLANS_DIR/$new_slug"
		if [ -f "$target_file" ]; then
			base="${new_slug%.md}"
			n=2
			while [ -f "$TARGET_PLANS_DIR/${base}-${n}.md" ]; do
				n=$(( n + 1 ))
			done
			new_slug="${base}-${n}.md"
			target_file="$TARGET_PLANS_DIR/$new_slug"
		fi

		# mv 優先（同 fs），跨 fs fallback cp+rm
		if mv "$plan_file" "$target_file" 2>/dev/null || \
		   (cp "$plan_file" "$target_file" 2>/dev/null && rm -f "$plan_file"); then
			index_file="$TARGET_PLANS_DIR/index.md"
			entry="- [$new_slug](./$new_slug)"
			if [ ! -f "$index_file" ]; then
				printf '# Plans\n\n<!-- auto-appended below -->\n%s\n' "$entry" > "$index_file"
			elif ! grep -qF "./$new_slug" "$index_file" 2>/dev/null; then
				# 保護手寫內容：僅在 sentinel 下方 append，不重建整個 index
				if grep -q '<!-- auto-appended below -->' "$index_file" 2>/dev/null; then
					printf '%s\n' "$entry" >> "$index_file"
				else
					printf '\n<!-- auto-appended below -->\n%s\n' "$entry" >> "$index_file"
				fi
			fi
			printf '%s\n' "$orig_slug" >> "$RELOCATED_MARKER"
			relocated_slugs="$relocated_slugs
$orig_slug"
			printf '[session-end] 計畫已歸位：%s → %s/%s\n' "$orig_slug" "$TARGET_PLANS_DIR" "$new_slug" >&2
		fi
	done
fi

# ── Part 2b: Tasks 歸位（含當前專案標記的任務複製到 per-project tasks 目錄）──
GLOBAL_TASKS="$HOME/.claude/tasks"

if [ -n "$CWD" ] && [ -d "$GLOBAL_TASKS" ]; then
	ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
	PROJ_TASKS_DIR="$HOME/.claude/projects/$ENCODED/tasks"

	for task_file in "$GLOBAL_TASKS"/*.md; do
		[ -f "$task_file" ] || continue
		if grep -q "$CWD" "$task_file" 2>/dev/null; then
			mkdir -p "$PROJ_TASKS_DIR"
			if cp "$task_file" "$PROJ_TASKS_DIR/" 2>/dev/null; then
				printf '[session-end] 任務已歸位：%s → %s\n' \
					"$(basename "$task_file")" "$PROJ_TASKS_DIR" >&2
			fi
		fi
	done
fi

# ── Part 3: Memory decay scan（90 天未存取提示歸檔）────────────────
# 輸出改寫入 decay-report.md（覆寫式，帶日期標頭），stderr 只留一行摘要，
# 避免每次 session 結束都在終端洗版一長串 decay 清單
THRESHOLD_SECS=$(( 90 * 86400 ))
NOW=$(date +%s)
decay_count=0
DECAY_REPORT="$HOME/.claude/.ab-tao/decay-report.md"
decay_body=""

for proj_dir in "$PROJECTS_DIR"/*/memory/; do
	[ -d "$proj_dir" ] || continue
	memory_md="${proj_dir}MEMORY.md"
	[ -f "$memory_md" ] || continue
	last_mod=$(stat -f %m "$memory_md" 2>/dev/null || stat -c %Y "$memory_md" 2>/dev/null || echo 0)
	age=$(( NOW - last_mod ))
	if [ "$age" -gt "$THRESHOLD_SECS" ]; then
		proj_name=$(dirname "$proj_dir" | xargs basename 2>/dev/null)
		decay_body="${decay_body}- ⏳ ${proj_name}（$(( age / 86400 )) 天未存取）"$'\n'
		decay_count=$((decay_count + 1))
	fi
done

mkdir -p "$(dirname "$DECAY_REPORT")" 2>/dev/null
{
	printf '# Memory Decay Report\n\n'
	printf '生成時間：%s\n\n' "$(date '+%Y-%m-%d %H:%M')"
	if [ "$decay_count" -gt 0 ]; then
		printf '超過 90 天未存取的記憶（%d 個），建議歸檔至 archive/：\n\n' "$decay_count"
		printf '%s' "$decay_body"
	else
		printf '目前無超過 90 天未存取的記憶。\n'
	fi
} > "$DECAY_REPORT" 2>/dev/null

printf '[session-end] decay report 已更新\n' >&2

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

# ── Part 4b: security_warnings_state GC（30 天）──────────────────
# 涵蓋 ~/.claude/security/ 與頂層 ~/.claude/ 兩處，json 與同名 .lock 一併清
SEC_GC_SECS=$(( 30 * 86400 ))
for sw in "$HOME/.claude/security/security_warnings_state_"*.json \
          "$HOME/.claude/security/security_warnings_state_"*.lock \
          "$HOME/.claude/security_warnings_state_"*.json \
          "$HOME/.claude/security_warnings_state_"*.lock; do
	[ -e "$sw" ] || continue
	sw_mtime=$(stat -f %m "$sw" 2>/dev/null || stat -c %Y "$sw" 2>/dev/null || echo 0)
	sw_age=$(( NOW - sw_mtime ))
	if [ "$sw_age" -gt "$SEC_GC_SECS" ]; then
		rm -f "$sw" 2>/dev/null && \
			printf '[session-end] 已清理舊 security_warnings_state：%s\n' "$(basename "$sw")" >&2
	fi
done

# ── Part 4c: race-condition 殘留檔清理 ───────────────────────────
# 掃描 hooks/ 與 .ab-tao/ 內形如「<basename> <N>[.ext]」的殘留（如 .notify-queue 2、session-state 3.json）
for rc_dir in "$HOME/.claude/hooks" "$HOME/.claude/.ab-tao"; do
	[ -d "$rc_dir" ] || continue
	find "$rc_dir" -maxdepth 1 -type f -name '* [0-9]*' 2>/dev/null | while IFS= read -r resid; do
		resid_bn=$(basename "$resid")
		if printf '%s' "$resid_bn" | grep -Eq '^.+ [0-9]+(\.[A-Za-z0-9]+)?$'; then
			rm -f "$resid" 2>/dev/null && \
				printf '[session-end] 已清理 race-condition 殘留檔：%s\n' "$resid_bn" >&2
		fi
	done
done

# ── Part 4d: backups/ 上限（僅保留最新 10 份 .claude.json.backup.*）──
BACKUPS_DIR="$HOME/.claude/backups"
if [ -d "$BACKUPS_DIR" ]; then
	BK_TMP=$(mktemp 2>/dev/null || printf '/tmp/ab-tao-backups-%s' "$$")
	: > "$BK_TMP"
	while IFS= read -r bkfile; do
		[ -f "$bkfile" ] || continue
		bk_mtime=$(stat -f %m "$bkfile" 2>/dev/null || stat -c %Y "$bkfile" 2>/dev/null || echo 0)
		printf '%s\t%s\n' "$bk_mtime" "$bkfile" >> "$BK_TMP"
	done < <(find "$BACKUPS_DIR" -maxdepth 1 -name '.claude.json.backup.*' -type f 2>/dev/null)
	sort -t $'\t' -k1,1rn "$BK_TMP" 2>/dev/null | awk -F'\t' 'NR>10{print $2}' | while IFS= read -r old_bk; do
		rm -f "$old_bk" 2>/dev/null && \
			printf '[session-end] 已清理超額 backups：%s\n' "$(basename "$old_bk")" >&2
	done
	rm -f "$BK_TMP"
fi

# ── Part 5: Worklog draft 寫入 ──────────────────────────────────
WL_STATE="$HOME/.claude/.ab-tao/session-state.json"
WL_DRAFTS="$HOME/.claude/.ab-tao/worklog-drafts.jsonl"

if [ -f "$WL_STATE" ] && command -v jq &>/dev/null; then
	WL_STARTED=$(jq -r '.startedAt // empty' "$WL_STATE" 2>/dev/null)
	WL_CWD=$(jq -r '.cwd // empty' "$WL_STATE" 2>/dev/null)
	WL_BRANCH=$(jq -r '.branch // empty' "$WL_STATE" 2>/dev/null)
	WL_SESSION_ID=$(jq -r '.sessionId // empty' "$WL_STATE" 2>/dev/null)

	if [ -n "$WL_STARTED" ] && [ -n "$WL_CWD" ]; then
		WL_ENDED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
		WL_END_EPOCH=$(date -u +%s)
		WL_START_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$WL_STARTED" +%s 2>/dev/null || echo 0)
		WL_DURATION=$(( WL_END_EPOCH - WL_START_EPOCH ))

		if [ "$WL_DURATION" -ge 60 ]; then
			WL_TICKET=$(printf '%s' "$WL_BRANCH" | grep -oE '[A-Z]+-[0-9]+' | head -1)
			WL_TICKET=${WL_TICKET:-unknown}
			WL_PROJECT=$(basename "${WL_CWD%/}" 2>/dev/null || echo "unknown")

			WL_COMMITS_JSON="[]"
			if [ -d "$WL_CWD/.git" ]; then
				_commits=$(cd "$WL_CWD" 2>/dev/null && \
					git log --since="$WL_STARTED" --pretty=format:'{"sha":"%h","subject":"%s"}' --no-merges 2>/dev/null)
				if [ -n "$_commits" ]; then
					WL_COMMITS_JSON="[$(printf '%s' "$_commits" | paste -sd ',')]"
				fi
			fi

			WL_COMMENT='""'
			if [ -d "$WL_CWD/.git" ]; then
				_subjects=$(cd "$WL_CWD" 2>/dev/null && \
					git log --since="$WL_STARTED" --pretty=format:'%s' --no-merges 2>/dev/null | head -10)
				[ -n "$_subjects" ] && \
					WL_COMMENT=$(printf '%s' "$_subjects" | jq -Rs '.' 2>/dev/null || printf '""')
			fi

			WL_ID="wl_${WL_SESSION_ID:0:8}_${WL_END_EPOCH}"
			mkdir -p "$(dirname "$WL_DRAFTS")"

			jq -nc \
				--arg id "$WL_ID" --arg createdAt "$WL_ENDED" --arg sessionId "$WL_SESSION_ID" \
				--arg project "$WL_PROJECT" --arg branch "$WL_BRANCH" --arg ticketKey "$WL_TICKET" \
				--arg startedAt "$WL_STARTED" --arg endedAt "$WL_ENDED" \
				--argjson durationSec "$WL_DURATION" \
				--argjson commits "$WL_COMMITS_JSON" \
				--argjson comment "$WL_COMMENT" \
				'{id:$id,createdAt:$createdAt,sessionId:$sessionId,project:$project,
				  branch:$branch,ticketKey:$ticketKey,startedAt:$startedAt,endedAt:$endedAt,
				  durationSec:$durationSec,commits:$commits,comment:$comment}' \
				>> "$WL_DRAFTS" 2>/dev/null || true
		fi
	fi
	rm -f "$WL_STATE"
fi

# ── Part 6: Auto-curate pending decisions (background, non-blocking) ─
# 仿 omp Hindsight：session 結束後在 project MEMORY.md 追加 pending-curate 提示
# Claude 冷啟動讀 MEMORY.md 時會看到此提示，主動建議回顧是否有需記錄的決策
_auto_curate() {
	local cwd="$1"
	[ -z "$cwd" ] && return

	local encoded project_memory
	encoded=$(printf '%s' "$cwd" | sed 's|/|-|g')
	project_memory="$HOME/.claude/projects/$encoded/memory"

	[ -d "$project_memory" ] || return

	local memory_md="$project_memory/MEMORY.md"
	local timestamp
	timestamp=$(date '+%Y-%m-%d %H:%M')

	# 已有 pending-curate 提示時跳過（避免重複堆疊）
	if [ -f "$memory_md" ] && grep -q '\[pending-curate\]' "$memory_md" 2>/dev/null; then
		return
	fi

	# 追加至 MEMORY.md 末尾（不覆蓋既有內容）
	{
		printf '\n## Pending Session Review\n'
		printf '<!-- [pending-curate] %s -->\n' "$timestamp"
		printf '> 上次 session 結束於 %s。冷啟動確認本次是否有需記錄的決策、踩坑或偏好。\n' "$timestamp"
		printf '> 確認後請刪除此段落。\n'
	} >> "$memory_md" 2>/dev/null && {
		printf '[session-end] auto-curate 提示已寫入：%s\n' "$memory_md" >&2
		mkdir -p "$HOME/.claude/telemetry"
		printf '{"ts":"%s","hook":"session-end","rule":"auto-curate","matched":true}\n' \
			"$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)" \
			>> "$HOME/.claude/telemetry/rule-hits-${HOSTNAME%%.*}.jsonl" 2>/dev/null
	}
}

( _auto_curate "$CWD" ) &
disown $! 2>/dev/null || true

exit 0
