#!/usr/bin/env bash
# PostToolUse hook — 事實層 auditability（CLAUDE.md.framework S1「事實優先」）
# 確定性偵測 agent 是否用了「查事實」的工具：
#   - service-graph 查詢：Bash 執行 pipeline-v2/q.sh
#   - knowledge-mcp：mcp__km-general__* / mcp__km-ops__*
#   - codebase-memory：mcp__codebase-memory-mcp__*
# 命中時用 additionalContext 提醒 agent 把查詢結果留進 S1 Key Info（事實優先紀律）。
# 這是「偵測 + 提醒」(auditability)，非硬 gate——不阻擋任何動作，只留痕與提示。
# 偵測交給此 hook（確定性），「查到的事實怎麼用」交給 agent（判斷）。
set -euo pipefail

input="$(cat)"

# 取 tool_name 與 tool_input.command（Bash 用）；無 jq 時 grep fallback，避免因缺 jq 而失敗。
if command -v jq >/dev/null 2>&1; then
  tool_name="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
  bash_cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
else
  tool_name="$(printf '%s' "$input" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/')"
  bash_cmd="$(printf '%s' "$input" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/')"
fi

# 判定：是不是一次「查事實」的呼叫？
kind=""
case "$tool_name" in
  mcp__km-general__*|mcp__km-ops__*)        kind="knowledge-mcp（業務邊界 / 負責人）" ;;
  mcp__codebase-memory-mcp__*)              kind="codebase-memory（結構）" ;;
  Bash)
    # 只在 q.sh 作為「被執行的指令」時計為事實查詢——
    # 排除 grep/find/cat 等唯讀搜尋（它們的參數含 "q.sh " 子字串會誤判，2026-07-17 修正）
    case "$bash_cmd" in
      grep\ *|find\ *|cat\ *|ls\ *|wc\ *|head\ *|tail\ *|rg\ *|sed\ *|awk\ *) ;;
      q.sh\ *|./q.sh\ *|*/q.sh\ *) kind="service-graph（呼叫鏈 / 影響面 / 資料流）" ;;
    esac
    ;;
esac

[ -z "$kind" ] && exit 0   # 非事實查詢 → 靜默放行

msg="偵測到事實查詢：${kind}。這是 S1「事實優先」紀律的一次查證——請把關鍵結果（呼叫鏈 / 影響面 / 業務歸屬）留進 task memory 的 S1 Key Info，並在後續影響面敘述中引用；name-based 結果引用前先讀實際 source 確認。"

if command -v jq >/dev/null 2>&1; then
  jq -nc --arg m "$msg" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'
else
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$msg"
fi

exit 0
