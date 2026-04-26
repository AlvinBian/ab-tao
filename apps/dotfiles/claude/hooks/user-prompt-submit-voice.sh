#!/bin/bash
# voice-trigger hook — UserPromptSubmit 中文意圖前置轉換
# 開關：settings.json _abTao.voiceTrigger: false 可關閉
# 注意：此 hook 依賴 UserPromptSubmit stdout rewrite 行為（已由 M1.4 PoC 驗證）

INPUT=$(cat)
PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // ""' 2>/dev/null)
[ -z "$PROMPT" ] && printf '%s' "$INPUT" && exit 0

# 讀取 voiceTrigger 開關（預設 true）
SETTINGS="$HOME/.claude/settings.json"
VOICE_ENABLED="true"
if [ -f "$SETTINGS" ]; then
  VOICE_ENABLED=$(jq -r '._abTao.voiceTrigger // true' "$SETTINGS" 2>/dev/null || echo "true")
fi
[ "$VOICE_ENABLED" = "false" ] && printf '%s' "$INPUT" && exit 0

# 意圖前置對應表（純字串比對）
NEW_PROMPT="$PROMPT"
case "$PROMPT" in
  *"跑安全檢查"*|*"做安全審計"*|*"安全掃描"*)
    NEW_PROMPT="/check --security $PROMPT" ;;
  *"PR review"*|*"審查 PR"*|*"review PR"*)
    NEW_PROMPT="/verify $PROMPT" ;;
  *"釐清需求"*|*"寫 spec"*|*"需求規格"*)
    NEW_PROMPT="/specify $PROMPT" ;;
  *"TDD 流程"*|*"跑 TDD"*)
    NEW_PROMPT="/chain-tdd $PROMPT" ;;
  *"產品流程"*|*"product flow"*)
    NEW_PROMPT="/chain-product $PROMPT" ;;
  *"部署計畫"*|*"rollout plan"*)
    NEW_PROMPT="use deploy-plan skill $PROMPT" ;;
  *)
    printf '%s' "$INPUT" && exit 0 ;;
esac

# 重寫 prompt 並回傳完整 JSON
printf '%s' "$INPUT" | jq --arg p "$NEW_PROMPT" '. + {prompt: $p}' 2>/dev/null || printf '%s' "$INPUT"
exit 0
