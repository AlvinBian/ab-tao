#!/bin/bash
# pre-tool-figma-screenshot.sh — Figma get_screenshot 呼叫時注入規格擷取提醒
# 對應原 claude-md/04-verification.md「Figma MCP 規格擷取」段（2026-07 下放為 hook）
# ⚠️ context 注入必須走 hookSpecificOutput.additionalContext JSON（裸 stdout 不注入）

command -v jq &>/dev/null || exit 0

CTX='Figma 規格擷取提醒：get_screenshot 只回圖片（無 layer 名/尺寸/字體/顏色/design tokens/Code Connect）。禁止單靠截圖出代碼或推測像素值、字體大小、顏色 hex、間距——必須與 get_design_context 並用（主要規格來源），截圖僅作視覺參考。'

jq -nc --arg ctx "$CTX" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$ctx}}'

exit 0
