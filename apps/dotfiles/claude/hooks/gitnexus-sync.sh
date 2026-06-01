#!/usr/bin/env bash
# gitnexus-sync.sh — SessionStart：GitNexus 索引落後 HEAD 時背景靜默重建（節流）

command -v jq &>/dev/null || exit 0
command -v gitnexus &>/dev/null || exit 0

INPUT=$(cat)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
SOURCE=$(printf '%s' "$INPUT" | jq -r '.source // empty' 2>/dev/null)

[ "$SOURCE" != "startup" ] && exit 0
[ -z "$CWD" ] && exit 0

META="$CWD/.gitnexus/meta.json"
[ -f "$META" ] || exit 0          # 沒索引過 → 不主動建（尊重使用者選擇，避免亂建 111MB）

# ── 節流閘 1：並發鎖（已有 analyze 在跑 → 跳過，避免撞 KuzuDB 寫鎖）──
pgrep -f "gitnexus analyze" >/dev/null 2>&1 && exit 0

# ── 節流閘 2：時間 debounce（上次觸發 < 600s → 跳過）──
TS_FILE="$CWD/.gitnexus/.sync.ts"
NOW=$(date +%s)
if [ -f "$TS_FILE" ]; then
  LAST=$(cat "$TS_FILE" 2>/dev/null)
  case "$LAST" in
    ''|*[!0-9]*) ;;                                  # 非數字 → 視為無紀錄
    *) [ $((NOW - LAST)) -lt 600 ] && exit 0 ;;
  esac
fi

# ── 節流閘 3：SHA 比對（索引已最新 → 跳過）──
INDEXED=$(jq -r '.lastCommit // empty' "$META" 2>/dev/null)
HEAD=$(git -C "$CWD" rev-parse HEAD 2>/dev/null)
{ [ -z "$INDEXED" ] || [ -z "$HEAD" ]; } && exit 0
[ "$INDEXED" = "$HEAD" ] && exit 0

# ── 落後 → 背景靜默重建（--index-only 不改 repo 檔；不帶 -f 走增量）──
printf '%s' "$NOW" > "$TS_FILE" 2>/dev/null   # 先記時間戳，避免並發重入
LOG="$CWD/.gitnexus/.sync.log"
nohup gitnexus analyze --index-only "$CWD" >"$LOG" 2>&1 &
printf '[GitNexus] 索引落後 HEAD（%s → %s），背景重建中（log: .gitnexus/.sync.log）\n' \
  "${INDEXED:0:7}" "${HEAD:0:7}" >&2

exit 0
