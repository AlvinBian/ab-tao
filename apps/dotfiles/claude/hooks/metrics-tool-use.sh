#!/usr/bin/env bash
# metrics-tool-use.sh — PostToolUse: append tool_use 事件到 metrics.jsonl
#
# 環境變數（Claude Code PostToolUse hook 提供）：
#   CLAUDE_TOOL_NAME     — 工具名稱
#   CLAUDE_TOOL_SUCCESS  — "true" | "false"
#   CLAUDE_SESSION_ID    — session UUID
#   CLAUDE_DURATION_MS   — 執行毫秒數（可能不存在）

set -euo pipefail

METRICS_FILE="${HOME}/.claude/.ab-tao/metrics.jsonl"

# 若目錄不存在則建立
mkdir -p "$(dirname "$METRICS_FILE")"

TOOL="${CLAUDE_TOOL_NAME:-unknown}"
SUCCESS="${CLAUDE_TOOL_SUCCESS:-true}"
SESSION="${CLAUDE_SESSION_ID:-}"
DURATION="${CLAUDE_DURATION_MS:-0}"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# ok = true/false based on SUCCESS
OK="true"
if [ "$SUCCESS" = "false" ]; then
  OK="false"
fi

# append JSONL line
printf '{"event":"tool_use","ts":"%s","sessionId":"%s","toolName":"%s","durationMs":%s,"ok":%s}\n' \
  "$TS" "$SESSION" "$TOOL" "$DURATION" "$OK" >> "$METRICS_FILE"
