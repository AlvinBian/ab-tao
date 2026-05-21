#!/usr/bin/env bash
# =============================================================================
# scripts/auto-update.sh
# 從 GitHub 自動拉取最新版本，針對性更新變更部分
#
# 用法：
#   bash scripts/auto-update.sh            ← 手動執行
#   bash scripts/auto-update.sh --dry-run  ← 只顯示變更，不實際更新
#   pnpm run update                        ← 透過 pnpm 執行
#
# 自動觸發：
#   - git pull 後（由 .git/hooks/post-merge 呼叫）
#
# 變更偵測路徑（git diff --name-only 相對於 repo root）：
#   apps/dotfiles/claude/commands/  → Claude commands（透過 config-sync）
#   apps/dotfiles/claude/agents/    → Claude agents（透過 config-sync）
#   apps/dotfiles/claude/rules/     → Claude rules（透過 config-sync）
#   apps/dotfiles/claude/hooks/     → hooks 配置（透過 config-sync）
#   apps/dotfiles/zsh/modules/      → zsh 模組（ln -sf 至 ~/.zshrc.d/conf/）
#   apps/dotfiles/zsh/.zshrc.d/sheldon/ → sheldon 插件配置
#
# 注意：~/.zshrc.local 為本機專屬設定，不受本腳本管控
# =============================================================================
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN=false
[[ "$1" == "--dry-run" ]] && DRY_RUN=true

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; DIM='\033[2m'; RED='\033[0;31m'; NC='\033[0m'

step()    { echo -e "\n${BOLD}$1${NC}"; }
info()    { echo -e "  ${CYAN}▶ $1${NC}"; }
success() { echo -e "  ${GREEN}✔ $1${NC}"; }
warn()    { echo -e "  ${YELLOW}⚠ $1${NC}"; }
skip()    { echo -e "  ${DIM}─ $1${NC}"; }

REPO_NAME="ab-tao"
REPO_BRANCH="main"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   ab-tao 自動更新                           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo -e "  ${DIM}來源：$REPO_NAME@$REPO_BRANCH${NC}"
echo -e "  ${DIM}路徑：$REPO_DIR${NC}"
$DRY_RUN && echo -e "  ${YELLOW}[DRY RUN 模式 — 只顯示變更，不實際執行]${NC}"

cd "$REPO_DIR"

# ── Step 1：確認 git 狀態 ─────────────────────────────────────────
step "① 檢查 GitHub 遠端版本"

if ! git remote get-url origin &>/dev/null; then
  warn "此倉庫沒有 git remote，跳過更新"
  exit 0
fi

git fetch origin "$REPO_BRANCH" --quiet 2>/dev/null || {
  warn "無法連線到 GitHub（$REPO_NAME），略過本次更新"
  exit 0
}

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$REPO_BRANCH")

if [[ "$LOCAL" == "$REMOTE" ]]; then
  success "已是最新版本（$(git log -1 --format='%h %s')）"
  exit 0
fi

# 列出有哪些 commit 要拉
COMMIT_COUNT=$(git rev-list HEAD.."origin/$REPO_BRANCH" --count)
info "發現 $COMMIT_COUNT 個新 commit："
git log HEAD.."origin/$REPO_BRANCH" --oneline | sed 's/^/    /'
echo ""

# ── Step 2：偵測哪些檔案有變更 ───────────────────────────────────
step "② 分析變更範圍"

CHANGED_FILES=$(git diff --name-only HEAD "origin/$REPO_BRANCH")

# 分類變更
COMMANDS_CHANGED=$(echo "$CHANGED_FILES" | grep "^apps/dotfiles/claude/commands/" | sed 's|apps/dotfiles/claude/commands/||;s|\.md$||' | tr '\n' ',' | sed 's/,$//')
AGENTS_CHANGED=$(echo "$CHANGED_FILES"   | grep "^apps/dotfiles/claude/agents/"   | sed 's|apps/dotfiles/claude/agents/||;s|\.md$||'   | tr '\n' ',' | sed 's/,$//')
RULES_CHANGED=$(echo "$CHANGED_FILES"    | grep "^apps/dotfiles/claude/rules/"    | sed 's|apps/dotfiles/claude/rules/||;s|\.md$||'    | tr '\n' ',' | sed 's/,$//')
HOOKS_CHANGED=$(echo "$CHANGED_FILES"    | grep -c "^apps/dotfiles/claude/hooks/" || true)
ZSH_MODULES=$(echo "$CHANGED_FILES"      | grep "^apps/dotfiles/zsh/modules/"  | sed 's|apps/dotfiles/zsh/modules/||;s|\.zsh$||' | tr '\n' ',' | sed 's/,$//')
SHELDON_CHANGED=$(echo "$CHANGED_FILES"  | grep -c "^apps/dotfiles/zsh/\.zshrc\.d/sheldon/" || true)

# 顯示分析結果
[[ -n "$COMMANDS_CHANGED" ]] && info "Claude commands：$COMMANDS_CHANGED" || skip "Claude commands（無變更）"
[[ -n "$AGENTS_CHANGED"   ]] && info "Claude agents：$AGENTS_CHANGED"     || skip "Claude agents（無變更）"
[[ -n "$RULES_CHANGED"    ]] && info "Claude rules：$RULES_CHANGED"       || skip "Claude rules（無變更）"
[[ "$HOOKS_CHANGED" -gt 0 ]] && info "hooks.json：有變更"                 || skip "hooks.json（無變更）"
[[ -n "$ZSH_MODULES"        ]] && info "zsh 環境模組：$ZSH_MODULES"          || skip "zsh 環境模組（無變更）"
[[ "$SHELDON_CHANGED" -gt 0 ]] && info "sheldon 配置：有變更"              || skip "sheldon 配置（無變更）"

# 若完全沒有可處理的變更
if [[ -z "$COMMANDS_CHANGED" && -z "$AGENTS_CHANGED" && -z "$RULES_CHANGED" \
   && "$HOOKS_CHANGED" -eq 0 && -z "$ZSH_MODULES" && "$SHELDON_CHANGED" -eq 0 ]]; then
  info "其他變更（README / scripts / package.json 等），不需重新部署"
  $DRY_RUN || git pull origin "$REPO_BRANCH" --quiet
  success "已拉取最新版本"
  exit 0
fi

# Dry run 到此結束
if $DRY_RUN; then
  echo ""
  echo -e "${YELLOW}[DRY RUN] 以上為預計執行的更新，實際未變更任何檔案${NC}"
  exit 0
fi

# ── Step 3：git pull ──────────────────────────────────────────────
step "③ 拉取最新版本"
git pull origin "$REPO_BRANCH" --quiet
success "git pull 完成"

# ── Step 4：針對性部署 ────────────────────────────────────────────
step "④ 針對性部署"

DEPLOYED=0

# Claude commands / agents / hooks — 透過 config-sync（Node.js orchestrator）
if [[ -n "$COMMANDS_CHANGED" || -n "$AGENTS_CHANGED" || "$HOOKS_CHANGED" -gt 0 ]]; then
  info "透過 config-sync 同步 Claude 配置..."
  node --input-type=module <<'ESEOF'
import { syncConfig } from './libs/install/config-sync.mjs';
import { SETTINGS_PRESERVE_PATHS, ADDITIVE_DIRS, FORBIDDEN_DIRS, SETTINGS_ARRAY_MERGE } from './libs/config/preserve-policy.mjs';
import path from 'node:path';
import os from 'node:os';
const home = path.join(os.homedir(), '.claude');
const template = path.join(process.cwd(), 'claude');
await syncConfig({ home, template, policy: { preservePaths: SETTINGS_PRESERVE_PATHS, additiveDirs: ADDITIVE_DIRS, forbiddenDirs: FORBIDDEN_DIRS, arrayMerge: SETTINGS_ARRAY_MERGE }, mode: 'auto' });
ESEOF
  DEPLOYED=$((DEPLOYED + 1))
fi

# zsh 環境模組（透過 symlink 更新 ~/.zshrc.d/conf/）
if [[ -n "$ZSH_MODULES" ]]; then
  info "更新 zsh 環境模組：$ZSH_MODULES"
  mkdir -p "$HOME/.zshrc.d/conf"
  IFS=',' read -rA _mods <<< "$ZSH_MODULES"
  for _m in $_mods; do
    local _src="$REPO_DIR/zsh/modules/${_m}.zsh"
    local _dest="$HOME/.zshrc.d/conf/${_m}.zsh"
    if [[ -f "$_src" ]]; then
      ln -sf "$_src" "$_dest"
      zcompile "$_dest" 2>/dev/null
      success "${_m}.zsh"
    else
      # 模組已刪除 — 移除對應 symlink
      [[ -L "$_dest" ]] && rm "$_dest" && success "removed ${_m}.zsh"
    fi
  done
  DEPLOYED=$((DEPLOYED + 1))
fi

# Claude rules — 透過 config-sync 統一處理（已含在上方的 Claude 配置同步中）

# sheldon 配置
if [[ "$SHELDON_CHANGED" -gt 0 ]]; then
  info "更新 sheldon 配置"
  mkdir -p "$HOME/.zshrc.d/sheldon"
  cp "$REPO_DIR/zsh/.zshrc.d/sheldon/plugins.toml" "$HOME/.zshrc.d/sheldon/"
  if command -v sheldon &>/dev/null; then
    export SHELDON_CONFIG_DIR="$HOME/.zshrc.d/sheldon"
    export SHELDON_DATA_DIR="$HOME/.zshrc.d/sheldon"
    sheldon lock --update 2>/dev/null
    sheldon source > "$HOME/.zshrc.d/sheldon/cache.zsh" 2>/dev/null
  fi
  success "sheldon 配置已更新"
  DEPLOYED=$((DEPLOYED + 1))
fi

# ── 完成 ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ 自動更新完成                             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo -e "  已更新 ${BOLD}$DEPLOYED${NC} 個區塊"
echo -e "  版本：$(git log -1 --format='%h %s')"
echo -e "  時間：$(date '+%Y-%m-%d %H:%M:%S')"

# 記錄到 log
LOG_FILE="$REPO_DIR/.update.log"
echo "$(date '+%Y-%m-%d %H:%M:%S') | $(git log -1 --format='%h') | deployed=$DEPLOYED" >> "$LOG_FILE"
