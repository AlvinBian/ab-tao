#!/usr/bin/env bash
# directory-added.sh — DirectoryAdded：/add-dir 中途掛入新工作目錄時，注入該目錄的記憶 / 計畫 / in-repo 慣例指引
#
# ⚠️ 輸出契約（2.1.219 起，官方文件未收錄，規格取自 CLI 二進位 HOOK_EVENT_REGISTRY）：
#    - 走頂層 JSON 的 systemMessage 欄位；此事件不支援 hookSpecificOutput.additionalContext，
#      也不是 SessionStart 那種 stdout 直注入（勿改成 printf 純文字，會被當雜訊丟掉）
#    - 僅 source=slash_command 路徑會把 systemMessage 送達 Claude（bounded context，訊息務必精簡）；
#      register_repo_root（SDK）路徑只寫 debug log，故 def 只掛 slash_command
#    - 同一目錄重複註冊會被 CLI 擋下且不重觸發，無需自建去重

command -v jq &>/dev/null || exit 0

INPUT=$(cat)
DIR=$(printf '%s' "$INPUT" | jq -r '.directory // empty' 2>/dev/null)

[ -z "$DIR" ] && exit 0
[ -d "$DIR" ] || exit 0

CLAUDE_DIR="$HOME/.claude"
DIR="${DIR%/}"
# 與 session-start.sh 同一套 encode 規則（/ → -），確保命中同一份 per-project 記憶樹
ENCODED=$(printf '%s' "$DIR" | sed 's|/|-|g')
PROJECT_DIR="$CLAUDE_DIR/projects/$ENCODED"

LINES=()
[ -f "$DIR/CLAUDE.md" ] && \
	LINES+=("📐 in-repo 慣例（最高優先權威）：$DIR/CLAUDE.md")
[ -f "$PROJECT_DIR/memory/MEMORY.md" ] && \
	LINES+=("📚 專案記憶索引：$PROJECT_DIR/memory/MEMORY.md")
[ -f "$PROJECT_DIR/plans/index.md" ] && \
	LINES+=("📋 專案計畫：$PROJECT_DIR/plans/index.md")
[ -d "$PROJECT_DIR/tasks" ] && \
	LINES+=("🧭 專案任務：$PROJECT_DIR/tasks")

# 新目錄無任何既有脈絡 → 靜默退出，不製造雜訊
[ ${#LINES[@]} -eq 0 ] && exit 0

MSG=$(
	printf '[新增工作目錄] %s\n' "$DIR"
	printf '%s\n' "${LINES[@]}"
	printf '↑ 在此目錄動工前先讀上述來源，勿沿用當前 cwd 的專案認知。'
)

jq -nc --arg m "$MSG" '{systemMessage: $m}'
exit 0
