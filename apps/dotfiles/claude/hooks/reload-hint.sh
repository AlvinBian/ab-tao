#!/usr/bin/env bash
# ab-tao:reload-hint — 讀 reload-required marker 並提示（一次性消費）
set -euo pipefail

MARKER="$HOME/.claude/.ab-tao/reload-required.json"
[ -f "$MARKER" ] || exit 0

# 讀出 changed label
if command -v jq >/dev/null 2>&1; then
    changed=$(jq -r '.changed[] | "   • \(.)"' "$MARKER" 2>/dev/null || cat "$MARKER")
else
    changed=$(cat "$MARKER")
fi

# 僅在 interactive session 且 TTY 才印
if [ -t 1 ]; then
    printf '\n⚠️  ab-tao 偵測到上次部署後的配置變更已套用至新 session：\n%s\n\n' "$changed"
fi

# 一次性消費
rm -f "$MARKER"
