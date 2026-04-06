#!/bin/bash
# claudeignore-guard — 攔截被 .gitignore 或 .claudeignore 忽略的文件
#
# 兩層忽略：
#   1. 項目 .gitignore（git 原生，零配置）
#   2. ~/.claude/projects/{org}/{repo}/.claudeignore（不碰項目目錄）
#
# 用 git check-ignore 精準匹配 .gitignore 規則（支持所有 gitignore 語法）
# 用簡單 pattern 匹配 .claudeignore 規則

# jq 未安裝時跳過
command -v jq &>/dev/null || { cat >/dev/null; exit 0; }

input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')

# 只攔截文件讀取相關工具
case "$tool" in
  Read|Glob|Grep) ;;
  *) exit 0 ;;
esac

# 取得目標路徑
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
[ -z "$file_path" ] && exit 0

# ── 第一層：git check-ignore（精準匹配 .gitignore）──
if command -v git &>/dev/null && git rev-parse --git-dir &>/dev/null 2>&1; then
  if git check-ignore -q "$file_path" 2>/dev/null; then
    echo "Blocked by .gitignore: $file_path" >&2
    exit 2
  fi
fi

# ── 第二層：~/.claude/projects/ 中的 .claudeignore ──
# 用 cwd 的路徑編碼找到對應的 project 目錄
CWD="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ENCODED=$(printf '%s' "$CWD" | sed 's|/|-|g')
PROJECTS_DIR="$HOME/.claude/projects"

# 嘗試 symlink 解析（path-encoded → org/repo）
IGNORE_FILE=""
if [ -L "$PROJECTS_DIR/$ENCODED" ]; then
  TARGET=$(readlink "$PROJECTS_DIR/$ENCODED")
  IGNORE_FILE="$PROJECTS_DIR/$TARGET/.claudeignore"
elif [ -d "$PROJECTS_DIR/$ENCODED" ]; then
  IGNORE_FILE="$PROJECTS_DIR/$ENCODED/.claudeignore"
fi

# 也搜索 org/repo 目錄
if [ -z "$IGNORE_FILE" ] || [ ! -f "$IGNORE_FILE" ]; then
  for dir in "$PROJECTS_DIR"/*/; do
    [ ! -d "$dir" ] && continue
    for subdir in "$dir"*/; do
      [ -f "$subdir/.claudeignore" ] && { IGNORE_FILE="$subdir/.claudeignore"; break 2; }
    done
  done
fi

[ -z "$IGNORE_FILE" ] || [ ! -f "$IGNORE_FILE" ] && exit 0

# 逐行匹配
while IFS= read -r pattern; do
  [[ "$pattern" =~ ^#.*$ || -z "$pattern" ]] && continue

  # 目錄模式：node_modules/
  if [[ "$pattern" == */ ]]; then
    [[ "$file_path" == *"${pattern%/}"* ]] && { echo "Blocked by .claudeignore: $file_path" >&2; exit 2; }
  fi

  # 萬用字元模式：*.min.js
  if [[ "$pattern" == \** ]]; then
    [[ "$file_path" == *"${pattern#\*}" ]] && { echo "Blocked by .claudeignore: $file_path" >&2; exit 2; }
  fi
done < "$IGNORE_FILE"

exit 0
