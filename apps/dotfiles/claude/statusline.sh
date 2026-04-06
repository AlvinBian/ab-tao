#!/bin/bash
# ab-tao statusline — 即時顯示 model + context% + cost
# 不消耗 API token，本地執行

input=$(cat)

# jq 未安裝時顯示基本信息
if ! command -v jq &>/dev/null; then
  echo "[Claude Code]"
  exit 0
fi

MODEL=$(echo "$input" | jq -r '.model.display_name // "?"' 2>/dev/null)
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' 2>/dev/null | cut -d. -f1)
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0' 2>/dev/null)

# 防禦：確保 PCT 是整數
PCT="${PCT:-0}"
[[ "$PCT" =~ ^[0-9]+$ ]] || PCT=0

# 顏色閾值
if [ "$PCT" -ge 80 ]; then C='\033[31m'
elif [ "$PCT" -ge 60 ]; then C='\033[33m'
else C='\033[32m'; fi
R='\033[0m'

# Progress bar（10 格）
FILLED=$((PCT / 10)); EMPTY=$((10 - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v F "%${FILLED}s" && BAR="${F// /█}"
[ "$EMPTY" -gt 0 ] && printf -v E "%${EMPTY}s" && BAR="${BAR}${E// /░}"

COST_FMT=$(printf '$%.2f' "$COST")
printf "%b" "[$MODEL] ${C}${BAR}${R} ${PCT}% | ${COST_FMT}"
