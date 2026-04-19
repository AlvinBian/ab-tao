#!/bin/bash
# my-ccline.sh — 以 ccline 為主體、尾接工具版本段
# ccline: https://github.com/Haleclipse/CCometixLine

set -u

readonly RESET=$'\033[0m'
readonly BOLD=$'\033[1m'
readonly SEP=$'\033[37m | \033[0m'

# Claude Code 注入的 session JSON（ccline 從 stdin 讀取）
input=$(cat)

# Segment 工廠：有版本才輸出一段，否則靜默
segment() {
  local ver=$1 icon=$2 color=$3
  [ -n "$ver" ] && printf '%s%s%s%s %s%s' "$SEP" "$BOLD" "$color" "$icon" "$ver" "$RESET"
}

extras=""
extras+=$(segment "$(node -v           2>/dev/null)"                                     "🔰" $'\033[38;5;64m')
extras+=$(segment "$(pnpm -v           2>/dev/null)"                                     "📦" $'\033[38;5;214m')
extras+=$(segment "$(python3 --version 2>/dev/null | awk '{print $2}')"                  "🐍" $'\033[38;5;68m')
extras+=$(segment "$(go version        2>/dev/null | awk '{print $3}' | sed 's/^go//')"  "🐹" $'\033[38;5;38m')

printf '%s%s' "$(printf '%s' "$input" | ccline 2>/dev/null)" "$extras"
