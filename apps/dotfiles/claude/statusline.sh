#!/bin/bash
# ab-tao statusline — 即時顯示 model + context% + cost
# 不消耗 API token，本地執行

read -r MODEL PCT COST <<< "$(cat | jq -r '
  (.model.display_name // "?") + " " +
  ((.context_window.used_percentage // 0) | floor | tostring) + " " +
  ((.cost.total_cost_usd // 0) | tostring)
')"

# 顏色閾值
if   [ "$PCT" -ge 80 ]; then C='\033[31m'
elif [ "$PCT" -ge 60 ]; then C='\033[33m'
else C='\033[32m'; fi
R='\033[0m'

# Progress bar（10 格）
FILLED=$((PCT / 10)); EMPTY=$((10 - FILLED))
printf -v BAR "%${FILLED}s"; BAR="${BAR// /█}"
printf -v E   "%${EMPTY}s";  BAR="${BAR}${E// /░}"

printf "%b" "[$MODEL] ${C}${BAR}${R} ${PCT}% | $(printf '$%.2f' "$COST")"
