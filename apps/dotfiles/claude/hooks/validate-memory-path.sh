#!/bin/bash
# validate-memory-path.sh — Memory/Plans 路徑驗證與自動修正
# 觸發條件：Write/Edit 路徑中含 .claude/projects/{slug}/(memory|plans)/
#
# 自動修正（Write）觸發條件：
#   A. 寫入的 project slug 完全不是 global 也不是 CWD 對應的 slug（明顯寫錯專案）
#   B. frontmatter type=project 卻寫入 global slug（CWD 在 git repo 中）
#
# 自動搬移（Edit）：同上，移動既有檔案至正確路徑
# 靜默通過：type=user/feedback 寫入 global（跨專案偏好，可能是刻意的）

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE" ] && exit 0

[[ "$FILE" =~ \.claude/projects/([^/]+)/(memory|plans)/ ]] || exit 0

ACTUAL_SLUG="${BASH_REMATCH[1]}"
GLOBAL_SLUG=$(printf '%s' "$HOME" | tr '/' '-')

# CWD 優先從 JSON 取（避免 hook runner 以 ~/.claude/hooks 為工作目錄導致誤判）
JSON_CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
GIT_ROOT=$(git -C "${JSON_CWD:-$PWD}" rev-parse --show-toplevel 2>/dev/null)
EXPECTED_SLUG=$([ -n "$GIT_ROOT" ] \
  && printf '%s' "$GIT_ROOT" | tr '/' '-' \
  || printf '%s' "$GLOBAL_SLUG")

# 路徑已正確，直接跳出
[ "$ACTUAL_SLUG" = "$EXPECTED_SLUG" ] && exit 0

# 解析 frontmatter type（僅 Write 有完整 content）
MEM_TYPE=""
if [ "$TOOL" = "Write" ]; then
  MEM_TYPE=$(printf '%s' "$INPUT" \
    | jq -r '.tool_input.content // empty' 2>/dev/null \
    | awk '/^---/{p=!p;next} p && /^type:/{gsub(/^type:[[:space:]]*/, ""); print; exit}')
fi

# ── 判斷是否需要修正 ──────────────────────────────────────────────
SHOULD_FIX=false
REASON=""

# 案例 A：寫入到一個既不是 global 也不是預期的 slug → 明顯寫錯專案
if [ "$ACTUAL_SLUG" != "$GLOBAL_SLUG" ] && [ "$ACTUAL_SLUG" != "$EXPECTED_SLUG" ]; then
  SHOULD_FIX=true
  REASON="目標專案 ${ACTUAL_SLUG} 與 CWD 不符，應為 ${EXPECTED_SLUG}"
# 案例 B：type=project 卻寫入 global，且 CWD 確實在 git repo 中
elif [ "$ACTUAL_SLUG" = "$GLOBAL_SLUG" ] && [ "$MEM_TYPE" = "project" ] && [ -n "$GIT_ROOT" ]; then
  SHOULD_FIX=true
  REASON="type=project 不應寫入全局 memory，應為 ${EXPECTED_SLUG}"
fi

$SHOULD_FIX || exit 0

# ── 精確路徑替換（sed + 轉義，避免 slug 含 glob 字元或多次匹配）──
# 轉義 BRE 特殊字元（. [ ] * ^ $ \）供 sed pattern 使用
_esc_bre() { printf '%s' "$1" | sed 's/[].[\*^$\\]/\\&/g'; }
# 轉義 sed replacement 特殊字元（\ & |）
_esc_repl() { printf '%s' "$1" | sed 's/[\\&|]/\\&/g'; }

CORRECTED_FILE=$(printf '%s' "$FILE" \
  | sed "s|/projects/$(_esc_bre "$ACTUAL_SLUG")/|/projects/$(_esc_repl "$EXPECTED_SLUG")/|")

# 替換無效保護（若替換前後相同，代表 sed 沒有匹配到，不繼續）
[ "$CORRECTED_FILE" = "$FILE" ] && exit 0

if [ "$TOOL" = "Write" ]; then
  if ! mkdir -p "$(dirname "$CORRECTED_FILE")" 2>/dev/null; then
    echo "⚠️  Memory 路徑修正失敗：無法建立目標目錄 $(dirname "$CORRECTED_FILE")" >&2
    printf '{"error":"Memory 路徑修正失敗：無法建立目標目錄，請手動檢查路徑。"}\n'
    exit 2
  fi
  echo "🔀 Memory 路徑已自動修正：${REASON}" >&2
  echo "   原：${FILE}" >&2
  echo "   新：${CORRECTED_FILE}" >&2
  UPDATED_TOOL_INPUT=$(printf '%s' "$INPUT" \
    | jq --arg fp "$CORRECTED_FILE" '.tool_input.file_path = $fp | .tool_input')
  jq -n \
    --argjson u "$UPDATED_TOOL_INPUT" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",permissionDecisionReason:"Memory path auto-corrected",updatedInput:$u}}'
else
  # Edit：嘗試自動搬移至正確路徑
  [ ! -f "$FILE" ] && exit 0  # 來源不存在 → 讓 Edit 自己報錯

  # 目標已存在 → 衝突，退回警告
  if [ -e "$CORRECTED_FILE" ]; then
    echo "⚠️  Memory 路徑疑慮（Edit）：${REASON}" >&2
    echo "   目標路徑已有同名檔案，拒絕覆寫：${CORRECTED_FILE}" >&2
    echo "   請手動決定合併或刪除其中一份。" >&2
    exit 0
  fi

  if ! mkdir -p "$(dirname "$CORRECTED_FILE")" 2>/dev/null; then
    echo "⚠️  Memory 路徑疑慮（Edit）：無法建立目標目錄" >&2
    exit 0
  fi

  if ! mv "$FILE" "$CORRECTED_FILE" 2>/dev/null; then
    echo "⚠️  Memory 路徑疑慮（Edit）：${REASON}" >&2
    echo "   自動搬移失敗，請手動處理。" >&2
    exit 0
  fi

  echo "🔀 Memory 檔案已自動搬移：${REASON}" >&2
  echo "   原：${FILE}" >&2
  echo "   新：${CORRECTED_FILE}" >&2
  echo "   📝 提醒：MEMORY.md 對此檔案的連結可能失效，請手動檢查。" >&2

  UPDATED_TOOL_INPUT=$(printf '%s' "$INPUT" \
    | jq --arg fp "$CORRECTED_FILE" '.tool_input.file_path = $fp | .tool_input')
  jq -n \
    --argjson u "$UPDATED_TOOL_INPUT" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",permissionDecisionReason:"Memory file auto-relocated",updatedInput:$u}}'
fi

exit 0
