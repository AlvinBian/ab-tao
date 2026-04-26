#!/bin/bash
# M1.4 voice-trigger PoC — 驗證 UserPromptSubmit hook stdout rewrite 行為
# 執行後觀察 ~/.claude/.ab-tao/voice-poc.log 確認結果
prompt=$(cat)
LOGFILE="$HOME/.claude/.ab-tao/voice-poc.log"
mkdir -p "$(dirname "$LOGFILE")"
echo "[$(date '+%Y-%m-%dT%H:%M:%S')] INPUT: $prompt" >> "$LOGFILE"
case "$prompt" in
  *"TEST_VOICE_TRIGGER"*)
    echo "/test voice-trigger-poc-activated $prompt"
    echo "[$(date '+%Y-%m-%dT%H:%M:%S')] REWRITE: activated" >> "$LOGFILE"
    ;;
  *)
    echo "$prompt"
    ;;
esac
