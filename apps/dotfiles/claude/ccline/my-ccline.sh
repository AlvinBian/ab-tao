#!/bin/bash
# my-ccline.sh — 自定義 Claude Code 狀態列
# 以 ccline 輸出為主體，附加工具版本 segment（風格與 ccline 一致）
# 來源：https://github.com/Haleclipse/CCometixLine

RESET=$'\033[0m'
BOLD=$'\033[1m'
WHITE=$'\033[37m'         # ccline 原始碼：\x1b[37m（Color16 白色）
SEP="${WHITE} | ${RESET}" # 分隔線：與 ccline join_with_white_separators 完全一致

# ── 圖示（emoji 雙倍寬，視覺與 ccline 其他 icon 一致）────────
NODE_ICON="🔰"   # 六角形綠色，最接近 Node.js hexagon logo
# PNPM_ICON="📦"
# PY_ICON="🐍"
# GO_ICON="🐹"

# ── 官方品牌色（ANSI 256色）──────────────────────────────────
NODE_COLOR=$'\033[38;5;64m'    # Node.js 官方綠 #339933 → 256色 64
# PNPM_COLOR=$'\033[38;5;214m' # pnpm 官方橘 #F69220 → 256色 214
# PY_COLOR=$'\033[38;5;68m'    # Python 官方藍 #3776AB → 256色 68
# GO_COLOR=$'\033[38;5;38m'    # Go 官方藍 #00ACD7 → 256色 38

# ── 取得版本資訊（防呆：工具未安裝時靜默跳過）──────────────
NODE_VER=$(node -v 2>/dev/null)
# PNPM_VER=$(pnpm -v 2>/dev/null)
# PY_VER=$(python3 --version 2>/dev/null | awk '{print $2}')
# GO_VER=$(go version 2>/dev/null | awk '{print $3}' | sed 's/go//')

# ── 組合附加 segment ──────────────────────────────────────────
EXTRAS=""
[ -n "$NODE_VER" ] && EXTRAS="${EXTRAS}${SEP}${BOLD}${NODE_COLOR}${NODE_ICON} ${NODE_VER}${RESET}"
# [ -n "$PNPM_VER" ] && EXTRAS="${EXTRAS}${SEP}${BOLD}${PNPM_COLOR}${PNPM_ICON} ${PNPM_VER}${RESET}"
# [ -n "$PY_VER"   ] && EXTRAS="${EXTRAS}${SEP}${BOLD}${PY_COLOR}${PY_ICON} ${PY_VER}${RESET}"
# [ -n "$GO_VER"   ] && EXTRAS="${EXTRAS}${SEP}${BOLD}${GO_COLOR}${GO_ICON} ${GO_VER}${RESET}"

# ── 取得 ccline 主體輸出 ──────────────────────────────────────
CCLINE_BIN="$(dirname "$0")/ccline"
CCLINE_OUT=$("$CCLINE_BIN" 2>/dev/null)

# ── 最終輸出 ──────────────────────────────────────────────────
if [ -n "$CCLINE_OUT" ]; then
  printf "%s%s" "$CCLINE_OUT" "$EXTRAS"
else
  FIRST_SEP_LEN=$(printf "%s" "$SEP" | wc -c | tr -d ' ')
  printf "%s" "${EXTRAS:$FIRST_SEP_LEN}"
fi
