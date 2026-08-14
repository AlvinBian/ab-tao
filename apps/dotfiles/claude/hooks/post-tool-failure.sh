#!/usr/bin/env bash
# ab-tao:post-tool-failure — 工具失敗日誌 + 高頻 terminalSequence 告警

LOG="$HOME/.claude/logs/tool-failures.log"
mkdir -p "$(dirname "$LOG")"

input=$(cat)
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo "unknown")

# 判斷是否失敗：is_error 旗標 或 stderr/content 含錯誤關鍵字
is_failure=$(printf '%s' "$input" | jq -r '
  if .tool_response.is_error == true then "1"
  elif ((.tool_response.content // []) | map(.text // "") | join("") | test("^Error:|error:|command not found|No such file"; "i")) then "1"
  else "0"
  end
' 2>/dev/null || echo "0")

[ "$is_failure" != "1" ] && exit 0

timestamp=$(date "+%Y-%m-%dT%H:%M:%S")
echo "$timestamp $tool_name" >> "$LOG"

# 過去 60s 失敗次數（macOS date -v / Linux date -d 雙支援）
cutoff=$(date -v-60S "+%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -d "60 seconds ago" "+%Y-%m-%dT%H:%M:%S" 2>/dev/null)
if [ -n "$cutoff" ]; then
    recent_count=$(awk -v c="$cutoff" '$1 >= c {n++} END {print n+0}' "$LOG")
else
    recent_count=$(wc -l < "$LOG" | tr -d ' ')
fi

if [ "${recent_count:-0}" -ge 3 ]; then
    msg=$(printf '⚠️  ab-tao: 高頻工具失敗！過去 60s 內 %s 次（最新：%s）' "$recent_count" "$tool_name")
    colored=$(printf '\033[31m%s\033[0m' "$msg")
    printf '{"terminalSequence": "%s"}\n' \
        "$(printf '%s' "$colored" | sed 's/\\/\\\\/g; s/"/\\"/g')"
fi

# V4-2: Edit 失敗 telemetry（追蹤 string_not_found / multiple_matches 分布）
if [ "$tool_name" = "Edit" ] && [ "$is_failure" = "1" ]; then
    content_text=$(printf '%s' "$input" | jq -r '(.tool_response.content // []) | map(.text // "") | join("")' 2>/dev/null)
    if printf '%s' "$content_text" | grep -qiE "String not found|0 matches found"; then
        reason="string_not_found"
    elif printf '%s' "$content_text" | grep -qiE "Found [0-9]+ matches"; then
        reason="multiple_matches"
    else
        reason="other"
    fi
    file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // "unknown"' 2>/dev/null)
    {
        mkdir -p "$HOME/.claude/telemetry"
        printf '{"ts":"%s","file":"%s","reason":"%s"}\n' \
            "$timestamp" \
            "$(printf '%s' "$file_path" | head -c 200 | tr '"\\' '  ')" \
            "$reason" \
            >> "$HOME/.claude/telemetry/edit-failures-${HOSTNAME%%.*}.jsonl" 2>/dev/null
    } &
fi
