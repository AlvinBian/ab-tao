#!/bin/bash
# pre-tool-cost-router.sh — PreToolUse 成本感知路由
# 啟發式：依 prompt 長度選擇 subagent model
# 開關：settings.json _abTao.costRouting: "static" 回退固定模式

INPUT=$(cat)

# 讀取 costRouting 設定
SETTINGS="$HOME/.claude/settings.json"
ROUTING="dynamic"
if [ -f "$SETTINGS" ]; then
  ROUTING=$(jq -r '._abTao.costRouting // "dynamic"' "$SETTINGS" 2>/dev/null || echo "dynamic")
fi

if [ "$ROUTING" = "static" ]; then
  printf '%s' "$INPUT"
  exit 0
fi

# 取得 prompt 長度
PROMPT_LEN=$(printf '%s' "$INPUT" | jq -r '.tool_input.prompt // .tool_input.user_prompt // ""' 2>/dev/null | wc -c)

# 啟發式路由：short(<500) → haiku, medium(<2000) → sonnet, long → opus
if [ "$PROMPT_LEN" -lt 500 ]; then
  export CLAUDE_CODE_SUBAGENT_MODEL="claude-haiku-4-5-20251001"
elif [ "$PROMPT_LEN" -lt 2000 ]; then
  export CLAUDE_CODE_SUBAGENT_MODEL="claude-sonnet-4-6"
fi
# long → 不設（使用預設 opus）

printf '%s' "$INPUT"
exit 0
