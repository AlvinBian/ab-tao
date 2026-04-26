#!/bin/bash
# M3.6.2 session-end failure pattern 收集
# 從 session 輸入/輸出抽取糾正信號，append 到 failure-patterns.md

PATTERNS_FILE="$HOME/.claude/.ab-tao/corrections/failure-patterns.md"
METRICS_FILE="$HOME/.claude/.ab-tao/metrics/metrics.jsonl"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# 讀取 session 輸入（stdin 可能為 session summary JSON 或空）
SESSION_INPUT=$(cat 2>/dev/null || echo "")

# 糾正信號偵測（強觸發詞）
STRONG_TRIGGERS="不對|重來|錯了|應該是|你說錯|修正一下|這不對"
# 糾正信號偵測（弱觸發詞）
WEAK_TRIGGERS="不太對|再想想|有點問題|試試看"

if echo "$SESSION_INPUT" | grep -qE "$STRONG_TRIGGERS"; then
  mkdir -p "$(dirname "$PATTERNS_FILE")"

  # 抽取含糾正信號的行
  PATTERN=$(echo "$SESSION_INPUT" | grep -E "$STRONG_TRIGGERS" | head -3 | tr '\n' ' ' | cut -c1-200)

  cat >> "$PATTERNS_FILE" << EOF

## [$TIMESTAMP] 糾正信號
**觸發**：強觸發詞命中
**原始**：${PATTERN}
**建議**：確認後更新以避免重複發生

EOF

  # Metrics
  if [ -d "$(dirname "$METRICS_FILE")" ]; then
    echo "{\"event\":\"failure_pattern_added\",\"trigger\":\"strong\",\"ts\":\"$TIMESTAMP\"}" >> "$METRICS_FILE"
  fi
fi
