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

if [ -f "$MEMORY_INDEX" ]; then
	printf '\n[冷啟動] 📚 專案記憶索引：%s\n' "$MEMORY_INDEX" >&2
fi
if [ -f "$PLANS_INDEX" ]; then
	printf '[冷啟動] 📋 計畫索引：%s\n' "$PLANS_INDEX" >&2
fi

# ── Part 3: config drift 偵測 ──────────────────────────────────────
STATE_FILE="$AB_TAO_DIR/state.json"
if [ -f "$STATE_FILE" ]; then
	drift_count=0
	while IFS= read -r rel_path; do
		[ -z "$rel_path" ] && continue
		full_path="$CLAUDE_DIR/$rel_path"
		expected_sha=$(jq -r --arg p "$rel_path" '.managed[$p].sha256 // empty' "$STATE_FILE" 2>/dev/null)
		[ -z "$expected_sha" ] && continue
		[ ! -f "$full_path" ] && continue
		actual_sha=$(shasum -a 256 "$full_path" 2>/dev/null | cut -c1-12)
		if [ -n "$actual_sha" ] && [ "$actual_sha" != "$expected_sha" ]; then
			drift_count=$((drift_count + 1))
			printf '[冷啟動] ⚠️  drift: %s\n' "$rel_path" >&2
		fi
	done < <(jq -r '.managed | keys[]' "$STATE_FILE" 2>/dev/null | head -20)

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

exit 0
