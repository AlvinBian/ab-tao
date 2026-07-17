#!/usr/bin/env bash
# session-start.sh — SessionStart 專案提醒注入 + 冷啟動 briefing + config drift 偵測

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SOURCE=$(printf '%s' "$INPUT" | jq -r '.source // empty' 2>/dev/null)

# 只在新 session 啟動時執行（排除 resume/compact/clear）
[ "$SOURCE" != "startup" ] && exit 0
[ -z "$CWD" ] && exit 0

CLAUDE_DIR="$HOME/.claude"
AB_TAO_DIR="$CLAUDE_DIR/.ab-tao"

# ── Part 1: 專案提醒注入 ──────────────────────────────────────────
REPO_NAME=$(basename "${CWD%/}")
if [ -n "$REPO_NAME" ]; then
	PROMPT_FILE="$CLAUDE_DIR/project-prompts/${REPO_NAME}.md"
	if [ -f "$PROMPT_FILE" ]; then
		LOCAL_MD="${CWD}/CLAUDE.local.md"
		if cp "$PROMPT_FILE" "$LOCAL_MD" 2>/dev/null; then
			EXCLUDE="${CWD}/.git/info/exclude"
			if [ -f "$EXCLUDE" ]; then
				grep -qxF 'CLAUDE.local.md' "$EXCLUDE" 2>/dev/null || \
					echo 'CLAUDE.local.md' >> "$EXCLUDE"
			fi
		fi
	fi
fi

# ── Part 2: 冷啟動 briefing（L1-L2）────────────────────────────────
# ⚠️ briefing 必須走 stdout（SessionStart 官方特例：stdout 直注入 context）；
#    stderr 只進 debug log，Claude 看不到（2026-07 實測修復，勿改回 >&2）
ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
PROJECT_DIR="$CLAUDE_DIR/projects/$ENCODED"
MEMORY_INDEX="$PROJECT_DIR/memory/MEMORY.md"
PLANS_INDEX="$PROJECT_DIR/plans/index.md"

# 分層記憶 briefing
GLOBAL_MEMORY="$CLAUDE_DIR/memory/MEMORY.md"
PROJ_TASKS="$PROJECT_DIR/tasks"

printf '\n'
# 全局記憶（僅在檔案存在且 >3 行才提示，避免空殼檔案洗版）
if [ -f "$GLOBAL_MEMORY" ]; then
	GLOBAL_MEMORY_LINES=$(wc -l < "$GLOBAL_MEMORY" 2>/dev/null || echo 0)
	if [ "$GLOBAL_MEMORY_LINES" -gt 3 ]; then
		printf '[冷啟動] 📚 全局記憶：%s\n' "$GLOBAL_MEMORY"
	fi
fi
# 專案記憶（有檔案才提示）
if [ -f "$MEMORY_INDEX" ]; then
	printf '[冷啟動] 📚 專案記憶：%s\n' "$MEMORY_INDEX"
fi
# 冷啟動讀取順序指示（原 claude-md/08 冷啟動段，2026-07 下放至此）
PROJ_MEMORY_DIR="$PROJECT_DIR/memory"
printf '[冷啟動] 📖 讀取順序：system-patterns.md（不存在則跳過，勿視為錯誤）→ active-context.md → active plan\n'
# pending-curate 偵測（active-context.md 含標記時主動詢問）
if [ -f "$PROJ_MEMORY_DIR/active-context.md" ] && \
   grep -q '\[pending-curate\]' "$PROJ_MEMORY_DIR/active-context.md" 2>/dev/null; then
	printf '[冷啟動] 🔖 active-context.md 含 [pending-curate] → 主動詢問使用者是否回顧上次 session 未記錄的決策，確認後提示刪除該段落\n'
fi
# 專案計畫（有檔案才提示）
if [ -f "$PLANS_INDEX" ]; then
	printf '[冷啟動] 📋 專案計畫：%s\n' "$PLANS_INDEX"
fi
# 專案任務目錄（有目錄才提示）
if [ -d "$PROJ_TASKS" ]; then
	printf '[冷啟動] 🧭 專案任務：%s\n' "$PROJ_TASKS"
fi

# ── Part 3: config drift 偵測 ──────────────────────────────────────
STATE_FILE="$AB_TAO_DIR/state.json"
if [ -f "$STATE_FILE" ]; then
	drift_count=0
	ghost_count=0
	while IFS= read -r rel_path; do
		[ -z "$rel_path" ] && continue
		full_path="$CLAUDE_DIR/$rel_path"
		expected_sha=$(jq -r --arg p "$rel_path" '.managed[$p].sha256 // empty' "$STATE_FILE" 2>/dev/null)
		[ -z "$expected_sha" ] && continue
		if [ ! -f "$full_path" ]; then
			ghost_count=$((ghost_count + 1))
			[ "$ghost_count" -le 5 ] && printf '[冷啟動] 👻 ghost: %s\n' "$rel_path"
			continue
		fi
		actual_sha=$(shasum -a 256 "$full_path" 2>/dev/null | awk '{print $1}')
		if [ -n "$actual_sha" ] && [ "$actual_sha" != "$expected_sha" ]; then
			drift_count=$((drift_count + 1))
			printf '[冷啟動] ⚠️  drift: %s\n' "$rel_path"
		fi
	done < <(jq -r '.managed | keys[]' "$STATE_FILE" 2>/dev/null | head -50)

	[ "$ghost_count" -gt 5 ] && \
		printf '[冷啟動] 👻 ghost: ...（共 %d 個，執行 d:doctor 清理）\n' "$ghost_count"
	[ "$drift_count" -gt 0 ] && \
		printf '[冷啟動] ⚠️  %d 個 managed 檔案有 drift，執行 d:status 檢視詳情\n' "$drift_count"
fi

# ── Part 4: Telemetry ─────────────────────────────────────────────
METRICS_FILE="$AB_TAO_DIR/metrics.jsonl"
SESSION_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PROFILE="personal"
if [ -f "$AB_TAO_DIR/profiles/active.json" ] && command -v jq &>/dev/null; then
	PROFILE=$(jq -r '.profile // "personal"' "$AB_TAO_DIR/profiles/active.json" 2>/dev/null)
fi
printf '{"event":"session_start","ts":"%s","cwd":"%s","profile":"%s"}\n' \
	"$SESSION_TS" "$CWD" "$PROFILE" >> "$METRICS_FILE" 2>/dev/null

# ── Part 5: Worklog session-state 記錄 ──────────────────────────
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
WL_SESSION_ID=""
if [ -n "$TRANSCRIPT" ]; then
	WL_SESSION_ID=$(basename "$TRANSCRIPT" .jsonl 2>/dev/null)
fi
[ -z "$WL_SESSION_ID" ] && WL_SESSION_ID=$(uuidgen 2>/dev/null || printf '%s-%s' "$SESSION_TS" "$$")

WL_BRANCH=$(cd "$CWD" 2>/dev/null && git rev-parse --abbrev-ref HEAD 2>/dev/null || printf '')
WL_HEAD_SHA=$(cd "$CWD" 2>/dev/null && git rev-parse --short HEAD 2>/dev/null || printf '')

SESSION_STATE_FILE="$AB_TAO_DIR/session-state.json"
jq -nc \
	--arg sessionId "$WL_SESSION_ID" --arg startedAt "$SESSION_TS" \
	--arg cwd "$CWD" --arg branch "$WL_BRANCH" --arg headSha "$WL_HEAD_SHA" \
	'{sessionId:$sessionId,startedAt:$startedAt,cwd:$cwd,branch:$branch,headSha:$headSha}' \
	> "$SESSION_STATE_FILE" 2>/dev/null || true

# ── Part 6: Active plan staleness 警告（V3-5）──────────────────────
_check_plan_staleness() {
	local plans_dir="$HOME/.claude/plans"
	[ -d "$plans_dir" ] || return
	local stale_count=0
	local threshold_secs=$((14 * 24 * 3600))
	local now_secs
	now_secs=$(date +%s 2>/dev/null) || return
	while IFS= read -r plan_file; do
		[ -f "$plan_file" ] || continue
		grep -q '^status: done' "$plan_file" 2>/dev/null && continue
		grep -q '^status:' "$plan_file" 2>/dev/null || continue
		local mtime_secs
		mtime_secs=$(stat -f %m "$plan_file" 2>/dev/null || stat -c %Y "$plan_file" 2>/dev/null) || continue
		local age_secs=$(( now_secs - mtime_secs ))
		[ "$age_secs" -gt "$threshold_secs" ] && stale_count=$((stale_count + 1))
	done < <(find "$plans_dir" -maxdepth 1 -name '*.md' 2>/dev/null)
	if [ "$stale_count" -gt 0 ]; then
		printf '[冷啟動] ⚠️  %d 個 active plan 超過 14 天未更新，建議確認狀態\n' "$stale_count"
	fi
}
_check_plan_staleness

exit 0
