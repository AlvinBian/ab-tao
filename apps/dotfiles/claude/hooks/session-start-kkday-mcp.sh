#!/bin/bash
# ============================================================
# SessionStart Hook — kkday MCP stack（pg / kibana）狀態偵測
# ============================================================
# 來源：kkday-it/scm-ai-handbook .claude/hooks/check-mcp-on-start.sh（全局化 + 加節流）
# 目的：settings.json 已全局註冊 pg-* / kibana-* http MCP（localhost:18899）。
#       stack 沒起時這些 server 會連線失敗，這裡在 session 開始時注入提示，讓 Claude 主動說明。
# 原則：快、fail-safe、永遠 exit 0；12 小時節流一次，不每 session 洗版。
# ============================================================
PORT=18899
HANDBOOK="${KKDAY_HANDBOOK_DIR:-$HOME/Kkday/projects/scm-ai-handbook}"
STAMP="$HOME/.claude/.ab-tao/.kkday-mcp-warned"
THROTTLE_SEC=43200   # 12h

emit() {
  python3 - "$1" <<'PY' 2>/dev/null || true
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": sys.argv[1]}}))
PY
}

# 沒 clone handbook → 這套 stack 根本沒裝，靜音退出
[ -d "$HANDBOOK/kibana-mcp/_mcp_server" ] || exit 0

# 節流：距上次提醒未滿 THROTTLE_SEC 就不再出聲
if [ -f "$STAMP" ]; then
  LAST=$(cat "$STAMP" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  [ $((NOW - LAST)) -lt "$THROTTLE_SEC" ] && exit 0
fi

# nginx port 是否有回應（2xx/3xx/4xx 都算「有人在聽」；307 是健康訊號不是錯誤）
CODE=$(curl -s -o /dev/null -m 2 -w "%{http_code}" -X POST \
  -H 'Accept: application/json, text/event-stream' \
  "http://localhost:${PORT}/pg/sit/mcp/" 2>/dev/null)

case "$CODE" in
  2*|3*|4*) exit 0 ;;   # 就緒，安靜
esac

date +%s > "$STAMP" 2>/dev/null

ENGINE_OK=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then ENGINE_OK=1; fi

if [ "$ENGINE_OK" = "0" ]; then
  emit "【kkday MCP 偵測】pg-* / kibana-* MCP 目前不可用：Docker/OrbStack 未啟動（port ${PORT} 無回應）。若這個 session 要查 log / DB，請主動告知使用者並詢問是否協助：1) open -a OrbStack 2) cd ${HANDBOOK}/kibana-mcp/_mcp_server && docker compose up -d。另提醒：查內網 DB / log 需先連 VPN。不查 log / DB 的 session 請忽略此訊息、不要主動提起。"
else
  emit "【kkday MCP 偵測】Docker 引擎已啟動，但 scm-mcp 容器未跑（port ${PORT} 無回應）。若這個 session 要查 log / DB，請詢問使用者是否啟動：cd ${HANDBOOK}/kibana-mcp/_mcp_server && docker compose up -d。另提醒：需連 VPN。不查 log / DB 的 session 請忽略此訊息、不要主動提起。"
fi
exit 0
