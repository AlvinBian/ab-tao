#!/usr/bin/env bash
# =============================================================================
# scripts/build-plugin.sh
# 智慧打包 Claude Code Plugin（官方格式）
#
# 執行邏輯：
#   1. git pull 拿最新 ab-tao 模板（保持最新）
#   2. 偵測執行位置的專案上下文：
#      - CLAUDE.md        → 提取規則嵌入 plugin.json
#      - .claude/commands/ → 專案自訂指令（優先於 ab-tao 同名指令）
#      - .claude/agents/  → 專案自訂 agents
#      - package.json     → 偵測技術棧，決定要包含哪些 commands
#   3. 合併：專案配置 > ab-tao 模板
#   4. 打包輸出為官方目錄結構：
#      plugin-name/
#      ├── .claude-plugin/
#      │   └── plugin.json
#      ├── skills/
#      ├── agents/
#      ├── commands/
#      └── hooks/
#
# 用法：
#   pnpm run build           ← 從 ab-tao 自身打包，或從任意專案目錄執行（自動整合專案配置）
#   pnpm run deploy          ← install + build
# =============================================================================
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INVOKE_DIR="$(pwd)"          # 執行指令時所在的目錄（可能是任意專案）
BUILD_DIR="/tmp/ab-tao-plugin-$$"
DIST_DIR="$REPO_DIR/dist/release"
PLUGIN_OUTPUT_DIR="$DIST_DIR/ab-tao-plugin"
mkdir -p "$DIST_DIR"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; DIM='\033[2m'; BOLD='\033[1m'; NC='\033[0m'

step()    { echo -e "\n${BOLD}$1${NC}"; }
info()    { echo -e "  ${CYAN}▶ $1${NC}"; }
success() { echo -e "  ${GREEN}✔ $1${NC}"; }
warn()    { echo -e "  ${YELLOW}⚠ $1${NC}"; }
skip()    { echo -e "  ${DIM}─ $1${NC}"; }

# ── Spinner（網路操作用）─────────────────────────────────────────
_spin_start() {
  _SPIN_MSG="$1"
  ( i=0
    while true; do
      case $(( i % 8 )) in
        0) c='⠋';; 1) c='⠙';; 2) c='⠹';; 3) c='⠸';;
        4) c='⠼';; 5) c='⠴';; 6) c='⠦';; 7) c='⠧';;
      esac
      printf "\r  \033[0;36m%s %s\033[0m   " "$c" "$_SPIN_MSG"
      sleep 0.1
      i=$(( i+1 ))
    done
  ) &
  _SPIN_PID=$!
}

_spin_stop() {
  local status="${1:-ok}"
  local suppress_output="${2:-false}"
  kill "$_SPIN_PID" 2>/dev/null
  wait "$_SPIN_PID" 2>/dev/null || true
  printf "\r\033[2K"
  # 僅在未抑制輸出時才顯示完成訊息
  [[ "$suppress_output" == "false" ]] && {
    [[ "$status" == "ok" ]] \
      && echo -e "  ${GREEN}✔ $_SPIN_MSG${NC}" \
      || echo -e "  ${YELLOW}⚠ $_SPIN_MSG${NC}"
  }
  unset _SPIN_PID _SPIN_MSG
}

PLUGIN_VERSION="$(python3 -c "import json; d=json.load(open('$REPO_DIR/package.json')); print(d.get('version','1.0.0'))" 2>/dev/null || echo '1.0.0')"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   ab-tao 智慧插件打包  v$PLUGIN_VERSION            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"

REPO_NAME="ab-tao"
REPO_BRANCH="main"

# ── Step 1：git pull 取得最新模板 ────────────────────────────────
step "① 同步最新模板（$REPO_NAME@$REPO_BRANCH）"
cd "$REPO_DIR"
_spin_start "連線 GitHub，檢查更新..."
if git fetch origin "$REPO_BRANCH" --quiet 2>/dev/null; then
  _spin_stop "ok"
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$REPO_BRANCH")
  if [[ "$LOCAL" != "$REMOTE" ]]; then
    _spin_start "拉取最新版本"
    git pull origin "$REPO_BRANCH" --quiet
    _spin_stop "ok"
    success "已拉取最新版本（$(git log -1 --format='%h %s')）"
  else
    skip "已是最新版本（$(git log -1 --format='%h')）"
  fi
else
  _spin_stop "warn"
  warn "無法連線 GitHub（$REPO_NAME），使用本地版本"
fi
cd "$INVOKE_DIR"

# ── Step 2：偵測專案上下文 ────────────────────────────────────────
step "② 偵測專案上下文"

IS_SELF=false
[[ "$INVOKE_DIR" == "$REPO_DIR" ]] && IS_SELF=true

PROJECT_CLAUDE_MD=""
PROJECT_COMMANDS_DIR=""
PROJECT_AGENTS_DIR=""
PROJECT_NAME=""
TECH_STACK=()
INCLUDE_COMMANDS=()   # 最終要包含的 command 名稱清單

if $IS_SELF; then
  info "執行位置：ab-tao 自身 → 打包完整預設版本"
else
  info "執行位置：$INVOKE_DIR"
  PROJECT_NAME=$(python3 -c "import json; d=json.load(open('package.json')); print(d.get('name',''))" 2>/dev/null || basename "$INVOKE_DIR")

  # ── CLAUDE.md ──────────────────────────────────────────────────
  if [[ -f "$INVOKE_DIR/CLAUDE.md" ]]; then
    PROJECT_CLAUDE_MD="$INVOKE_DIR/CLAUDE.md"
    success "CLAUDE.md 找到（$(wc -l < "$PROJECT_CLAUDE_MD") 行）"
  else
    skip "CLAUDE.md 不存在"
  fi

  # ── .claude/ 目錄 ──────────────────────────────────────────────
  if [[ -d "$INVOKE_DIR/.claude/commands" ]]; then
    PROJECT_COMMANDS_DIR="$INVOKE_DIR/.claude/commands"
    CMD_COUNT=$(ls "$PROJECT_COMMANDS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
    success ".claude/commands/ 找到（$CMD_COUNT 個自訂指令，優先採用）"
  else
    skip ".claude/commands/ 不存在"
  fi

  if [[ -d "$INVOKE_DIR/.claude/agents" ]]; then
    PROJECT_AGENTS_DIR="$INVOKE_DIR/.claude/agents"
    AGENT_COUNT=$(ls "$PROJECT_AGENTS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
    success ".claude/agents/ 找到（$AGENT_COUNT 個自訂 agents）"
  else
    skip ".claude/agents/ 不存在"
  fi

  # ── package.json 技術棧偵測 ────────────────────────────────────
  if [[ -f "$INVOKE_DIR/package.json" ]]; then
    PKG=$(cat "$INVOKE_DIR/package.json")

    DETECTED=$(python3 -c "
import json
d = json.load(open('$INVOKE_DIR/package.json'))
deps = {**d.get('dependencies',{}), **d.get('devDependencies',{})}
stack = []
if 'vue' in deps:           stack.append('vue')
if 'react' in deps:         stack.append('react')
if 'typescript' in deps or '@types/node' in deps: stack.append('typescript')
if 'vite' in deps:          stack.append('vite')
if 'nuxt' in deps:          stack.append('nuxt')
if 'laravel' in str(deps).lower() or 'php' in str(d.get('engines',{})).lower(): stack.append('php')
if '@testing-library' in str(deps) or 'vitest' in deps or 'jest' in deps: stack.append('testing')
print(','.join(stack) if stack else 'general')
" 2>/dev/null || echo "general")
    success "技術棧：$DETECTED"
    IFS=',' read -ra TECH_STACK <<< "$DETECTED"
  fi
fi

# ── Step 3：決定要包含的 commands ─────────────────────────────────
step "③ 組裝 commands 清單"

# 預設全部 ab-tao commands
DEFAULT_CMDS=()
for f in "$REPO_DIR/claude/commands/"*.md; do
  DEFAULT_CMDS+=("$(basename "$f" .md)")
done

# 依技術棧過濾：只保留相關的 commands（從 ab-tao）
_should_include_cmd() {
  local name="$1"
  # 這些指令對所有專案都有用
  case "$name" in
    auto-setup|pr-workflow|draft-slack|slack-formatting|review-slack) return 0 ;;
  esac
  # 技術棧相關
  for tech in "${TECH_STACK[@]}"; do
    case "$tech:$name" in
      vue:code-review|vue:test-gen) return 0 ;;
      react:code-review|react:test-gen) return 0 ;;
      typescript:code-review|typescript:test-gen) return 0 ;;
      php:code-review) return 0 ;;
      testing:test-gen) return 0 ;;
    esac
  done
  # 沒有 tech stack 偵測時（自身打包或 general），全部包含
  [[ ${#TECH_STACK[@]} -eq 0 || "$DETECTED" == "general" || $IS_SELF == true ]] && return 0
  return 1
}

INCLUDED_CMDS=()
SKIPPED_CMDS=()
for cmd in "${DEFAULT_CMDS[@]}"; do
  if _should_include_cmd "$cmd"; then
    INCLUDED_CMDS+=("$cmd")
  else
    SKIPPED_CMDS+=("$cmd")
  fi
done

[[ ${#INCLUDED_CMDS[@]} -gt 0 ]] && success "包含：${INCLUDED_CMDS[*]}"
[[ ${#SKIPPED_CMDS[@]} -gt 0 ]] && skip "略過（與技術棧無關）：${SKIPPED_CMDS[*]}"

# ── Step 4：打包 ──────────────────────────────────────────────────
step "④ 打包中"

mkdir -p "$DIST_DIR"
rm -rf "$PLUGIN_OUTPUT_DIR"
mkdir -p "$PLUGIN_OUTPUT_DIR/.claude-plugin" "$PLUGIN_OUTPUT_DIR/skills" "$PLUGIN_OUTPUT_DIR/agents" "$PLUGIN_OUTPUT_DIR/commands" "$PLUGIN_OUTPUT_DIR/hooks"

# plugin.json（官方格式）
PLUGIN_DESC="ab-tao 開發環境智能配置 — commands, agents, rules, hooks"
[[ -n "$PROJECT_NAME" && ! $IS_SELF ]] && PLUGIN_DESC="$PROJECT_NAME Claude 配置（基於 ab-tao）"

# 若有 CLAUDE.md，提取前一行作為 description 補充
CLAUDE_SUMMARY=""
if [[ -n "$PROJECT_CLAUDE_MD" ]]; then
  CLAUDE_SUMMARY=$(sed -n '/^# /s/^# //p' "$PROJECT_CLAUDE_MD" 2>/dev/null | head -1 || true)
  [[ -n "$CLAUDE_SUMMARY" ]] && PLUGIN_DESC="$CLAUDE_SUMMARY"
fi

cat > "$PLUGIN_OUTPUT_DIR/.claude-plugin/plugin.json" << JSON_EOF
{
  "name": "ab-tao",
  "description": "$PLUGIN_DESC",
  "version": "$PLUGIN_VERSION",
  "author": {
    "name": "AlvinBian"
  },
  "homepage": "https://github.com/AlvinBian/ab-tao",
  "license": "MIT"
}
JSON_EOF

# Commands：專案自訂 > ab-tao（同名時專案優先）
echo -e "${BLUE}📦 Commands${NC}"
CMD_COUNT=0
ADDED_CMDS=""   # 用空格分隔的字串模擬 set

_cmd_added()   { echo " $ADDED_CMDS " | grep -q " $1 "; }
_mark_cmd()    { ADDED_CMDS="$ADDED_CMDS $1"; }

# 先加入專案自訂 commands（若存在）
if [[ -n "$PROJECT_COMMANDS_DIR" ]]; then
  for f in "$PROJECT_COMMANDS_DIR"/*.md; do
    [[ -f "$f" ]] || continue
    name=$(basename "$f" .md)
    cp "$f" "$PLUGIN_OUTPUT_DIR/commands/$name.md"
    echo -e "   ${GREEN}✔${NC} /$name ${CYAN}[專案自訂]${NC}"
    _mark_cmd "$name"
    CMD_COUNT=$((CMD_COUNT + 1))
  done
fi

# 再加入 ab-tao commands（跳過已有的同名）
for name in "${INCLUDED_CMDS[@]}"; do
  _cmd_added "$name" && continue
  f="$REPO_DIR/claude/commands/$name.md"
  [[ -f "$f" ]] || continue
  cp "$f" "$PLUGIN_OUTPUT_DIR/commands/$name.md"
  echo -e "   ${GREEN}✔${NC} /$name"
  CMD_COUNT=$((CMD_COUNT + 1))
done
echo -e "   ${CYAN}→ $CMD_COUNT 個 commands${NC}"

# Agents：同樣邏輯（專案優先）
echo -e "${BLUE}🤖 Agents${NC}"
AGENT_COUNT=0
ADDED_AGENTS=""
_agent_added() { echo " $ADDED_AGENTS " | grep -q " $1 "; }
_mark_agent()  { ADDED_AGENTS="$ADDED_AGENTS $1"; }

if [[ -n "$PROJECT_AGENTS_DIR" ]]; then
  for f in "$PROJECT_AGENTS_DIR"/*.md; do
    [[ -f "$f" ]] || continue
    name=$(basename "$f" .md)
    cp "$f" "$PLUGIN_OUTPUT_DIR/agents/"
    echo -e "   ${GREEN}✔${NC} @$name ${CYAN}[專案自訂]${NC}"
    _mark_agent "$name"
    AGENT_COUNT=$((AGENT_COUNT + 1))
  done
fi

for f in "$REPO_DIR/claude/agents/"*.md; do
  name=$(basename "$f" .md)
  _agent_added "$name" && continue
  cp "$f" "$PLUGIN_OUTPUT_DIR/agents/"
  echo -e "   ${GREEN}✔${NC} @$name"
  AGENT_COUNT=$((AGENT_COUNT + 1))
done
echo -e "   ${CYAN}→ $AGENT_COUNT 個 agents${NC}"

# Hooks
echo -e "${BLUE}🪝 Hooks${NC}"
cp "$REPO_DIR/claude/hooks.json" "$PLUGIN_OUTPUT_DIR/hooks/hooks.json"
HOOK_EVENTS=$(python3 -c "
import json
d = json.load(open('$REPO_DIR/claude/hooks.json'))
for event, items in d.get('hooks', {}).items():
    print(f'   • {event}: {len(items)} 條規則')
" 2>/dev/null || echo "   • hooks 已打包")
echo "$HOOK_EVENTS"

# Skills（如果有專用 skills 目錄，複製進去）
if [[ -d "$REPO_DIR/claude/skills" ]]; then
  echo -e "${BLUE}📚 Skills${NC}"
  for dir in "$REPO_DIR/claude/skills"/*; do
    [[ -d "$dir" ]] || continue
    skill_name=$(basename "$dir")
    cp -r "$dir" "$PLUGIN_OUTPUT_DIR/skills/"
    echo -e "   ${GREEN}✔${NC} $skill_name"
  done
fi

# README（供參考）
if [[ -f "$REPO_DIR/README.md" ]]; then
  cp "$REPO_DIR/README.md" "$PLUGIN_OUTPUT_DIR/README.md"
  info "README.md 已複製"
fi

# CLAUDE.md（若有，一併打包供參考）
if [[ -n "$PROJECT_CLAUDE_MD" ]]; then
  cp "$PROJECT_CLAUDE_MD" "$PLUGIN_OUTPUT_DIR/CLAUDE.md"
  info "CLAUDE.md 已複製"
fi

# 清空舊的臨時目錄
rm -rf "$BUILD_DIR"

# 計算目錄大小
DIR_SIZE=$(du -sh "$PLUGIN_OUTPUT_DIR" | awk '{print $1}')

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Plugin 打包完成（官方格式）               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo -e "  ${BOLD}版    本：${NC} $PLUGIN_VERSION"
echo -e "  ${BOLD}內    容：${NC} $CMD_COUNT commands · $AGENT_COUNT agents · hooks"
[[ ${#TECH_STACK[@]} -gt 0 ]] && \
echo -e "  ${BOLD}技術棧：  ${NC} ${TECH_STACK[*]}"
[[ -n "$PROJECT_CLAUDE_MD" ]] && \
echo -e "  ${BOLD}專案配置：${NC} CLAUDE.md 已整合"
echo -e "  ${BOLD}目錄大小：${NC} $DIR_SIZE"
echo -e "  ${BOLD}輸出路徑：${NC} $PLUGIN_OUTPUT_DIR"
echo ""
echo -e "${YELLOW}📌 測試：${BOLD}claude --plugin-dir $PLUGIN_OUTPUT_DIR/${NC}"
echo -e "${YELLOW}📌 安裝：${BOLD}/plugin marketplace add <url>${NC}"

# 記錄 build log
LOG_FILE="$REPO_DIR/.build.log"
echo "$(date '+%Y-%m-%d %H:%M:%S') | v$PLUGIN_VERSION | $CMD_COUNT cmds | ${TECH_STACK[*]:-default} | from:$(basename $INVOKE_DIR)" >> "$LOG_FILE"
