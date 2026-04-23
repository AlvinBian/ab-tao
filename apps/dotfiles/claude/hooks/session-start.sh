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
ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
PROJECT_DIR="$CLAUDE_DIR/projects/$ENCODED"
MEMORY_INDEX="$PROJECT_DIR/memory/MEMORY.md"
PLANS_INDEX="$PROJECT_DIR/plans/index.md"

# 分層記憶 briefing
GLOBAL_MEMORY="$CLAUDE_DIR/memory/MEMORY.md"
PROJ_TASKS="$PROJECT_DIR/tasks"

printf '\n'
# 全局記憶（永遠提示路徑，讓 Claude 知道去哪讀）
printf '[冷啟動] 📚 全局記憶：%s\n' "$GLOBAL_MEMORY" >&2
# 專案記憶（有檔案才提示）
if [ -f "$MEMORY_INDEX" ]; then
	printf '[冷啟動] 📚 專案記憶：%s\n' "$MEMORY_INDEX" >&2
fi
# 專案計畫（有檔案才提示）
if [ -f "$PLANS_INDEX" ]; then
	printf '[冷啟動] 📋 專案計畫：%s\n' "$PLANS_INDEX" >&2
fi
# 專案任務目錄（有目錄才提示）
if [ -d "$PROJ_TASKS" ]; then
	printf '[冷啟動] 🧭 專案任務：%s\n' "$PROJ_TASKS" >&2
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
			[ "$ghost_count" -le 5 ] && printf '[冷啟動] 👻 ghost: %s\n' "$rel_path" >&2
			continue
		fi
		actual_sha=$(shasum -a 256 "$full_path" 2>/dev/null | awk '{print $1}')
		if [ -n "$actual_sha" ] && [ "$actual_sha" != "$expected_sha" ]; then
			drift_count=$((drift_count + 1))
			printf '[冷啟動] ⚠️  drift: %s\n' "$rel_path" >&2
		fi
	done < <(jq -r '.managed | keys[]' "$STATE_FILE" 2>/dev/null | head -50)

	[ "$ghost_count" -gt 5 ] && \
		printf '[冷啟動] 👻 ghost: ...（共 %d 個，執行 d:doctor 清理）\n' "$ghost_count" >&2
	[ "$drift_count" -gt 0 ] && \
		printf '[冷啟動] ⚠️  %d 個 managed 檔案有 drift，執行 d:status 檢視詳情\n' "$drift_count" >&2
fi

# ── Part 4: Telemetry（Phase 17）──────────────────────────────────
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

exit 0
