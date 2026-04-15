#!/bin/bash
# Claude Code Slack 通知分發器
#
# 用法：slack-dispatch.sh session-start | session-stop [--msg "訊息"]
#
# 設定（~/.claude/settings.json → env 欄位，由 Claude Code 自動注入進程環境）：
#   SLACK_NOTIFY_CHANNEL=C0XXXXXXXXX            # 必填：頻道 ID
#   SLACK_NOTIFY_MODE=off                        # 可選：設為 off 關閉通知
#   CLAUDE_SLACK_MIN_SESSION_SECS=300            # 可選：最短通知門檻（預設 5 分鐘）

set -uo pipefail

[ "${SLACK_NOTIFY_MODE:-}" = "off" ] && exit 0

CHANNEL="${SLACK_NOTIFY_CHANNEL:-}"
[ -z "$CHANNEL" ] && exit 0

MIN_SESSION="${CLAUDE_SLACK_MIN_SESSION_SECS:-300}"
STATE_DIR="/tmp/claude-slack"
SESSION="${CLAUDE_SESSION_ID:-$$}"
SESSION_SHORT="${SESSION:0:8}"

mkdir -p "$STATE_DIR"

EVENT="${1:-}"
shift || true

MSG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --msg) MSG="$2"; shift 2 ;;
    *) shift ;;
  esac
done

case "$EVENT" in

  session-start)
    date +%s > "$STATE_DIR/start_$SESSION_SHORT"
    ;;

  session-stop)
    start_file="$STATE_DIR/start_$SESSION_SHORT"
    [ ! -f "$start_file" ] && exit 0
    DURATION=$(( $(date +%s) - $(cat "$start_file") ))
    [ "$DURATION" -lt "$MIN_SESSION" ] && exit 0

    REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || echo 'unknown')")
    BRANCH=$(git branch --show-current 2>/dev/null || echo "")
    PROJECT_INFO="$REPO"
    [ -n "$BRANCH" ] && PROJECT_INFO="$PROJECT_INFO / $BRANCH"

    MSG_TEXT="✅ *Claude Code：任務完成*
• 專案：${PROJECT_INFO}
• 耗時：$(( DURATION / 60 )) 分鐘"
    [ -n "$MSG" ] && MSG_TEXT="${MSG_TEXT}
_${MSG}_"

    JSON_TEXT=$(printf '%s' "$MSG_TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    printf '{"channel_id":"%s","text":%s}\n' "$CHANNEL" "$JSON_TEXT" > "$STATE_DIR/notify-pending.json"
    rm -f "$start_file"
    ;;

esac

exit 0
