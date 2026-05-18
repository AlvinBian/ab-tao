#!/usr/bin/env bash
# ab-tao:reload-hint — 讀 reload-required marker 並提示（一次性消費）
# terminalSequence 輸出：訊息顯示在終端機，不污染 Claude context

MARKER="$HOME/.claude/.ab-tao/reload-required.json"
[ -f "$MARKER" ] || exit 0

if command -v jq >/dev/null 2>&1; then
    changed=$(jq -r '[.changed[]] | join(" · ")' "$MARKER" 2>/dev/null || cat "$MARKER")
else
    changed="(see ~/.claude/.ab-tao/reload-required.json)"
fi

# 一次性消費
rm -f "$MARKER"

# OSC 9 = iTerm2 / Windows Terminal 桌面通知
# \033[33m ... \033[0m = 終端機黃色文字（ANSI fallback）
notification=$(printf '\033[33m⚠️  ab-tao: 配置更新已套用 — %s\033[0m' "$changed")
osc9=$(printf '\033]9;ab-tao 配置更新: %s\007' "$changed")

# 輸出 JSON terminalSequence（不進 Claude context）
printf '{"terminalSequence": "%s%s"}\n' \
    "$(printf '%s' "$osc9" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
    "$(printf '%s' "$notification" | sed 's/\\/\\\\/g; s/"/\\"/g')"
