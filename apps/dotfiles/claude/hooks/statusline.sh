#!/usr/bin/env bash
# ab-tao:statusline — statusLine wrapper，優先呼叫 claude-hud，缺失時靜默退出
# 設計：settings.json 指向此 hook，不直接指向 plugin 路徑，避免跨機 plugin cache 不一致

HUD_WRAPPER="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/claude-hud/hud-wrapper.sh"

if [[ -x "$HUD_WRAPPER" ]]; then
    exec "$HUD_WRAPPER" "$@"
fi

# fallback：claude-hud 未安裝，靜默退出（Claude Code 顯示原生 statusline）
exit 0
