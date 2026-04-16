#!/usr/bin/env zsh
# =============================================================================
# zsh/install.sh — zsh 環境模組安裝
#
# 用法：
#   zsh zsh/install.sh                                    ← 互動式選擇
#   zsh zsh/install.sh --all                              ← 全部安裝
#   zsh zsh/install.sh --modules "history,keys,aliases"   ← 指定模組
#
# 零侵入策略：
#   1. 用戶 .zshrc 不替換、不搬走，只在尾部追加一行 loader
#   2. ab-tao 全部在 ~/.zshrc.d/，rm -rf 即還原
#   3. sheldon 管插件，conf/ 管配置，互不侵犯
#   4. 用戶配置永遠優先，ab-tao 只補缺不覆蓋
#
# 部署目標：~/.zshrc.d/
#   conf/
#     00-env.zsh      ← 恆常（環境基礎）
#     10-history.zsh  ← 可選（歷史記錄）
#     20-keys.zsh     ← 可選（按鍵綁定）
#     30-aliases.zsh  ← 可選（別名與編輯器偵測）
#     40-git.zsh      ← 可選（git 增強）
#     60-tools.zsh    ← 可選（CLI 工具 + FZF）
#     90-plugins.zsh  ← 恆常（sheldon + compinit + starship）
#   sheldon/
#     plugins.toml    ← 插件聲明
# =============================================================================
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ZSH_DIR="$REPO_DIR/zsh"
SRC_DIR="$ZSH_DIR/.zshrc.d"
DEST_DIR="$HOME/.zshrc.d"
BACKUP_DIR="$DEST_DIR/backups"

LOADER_MARKER="# ab-tao:loader"

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; DIM='\033[2m'; RESET='\033[0m'

step()    { echo -e "\n${BOLD}$1${RESET}"; }
info()    { echo -e "  ${CYAN}▶ $1${RESET}"; }
success() { echo -e "  ${GREEN}✔ $1${RESET}"; }
warn()    { echo -e "  ${YELLOW}⚠ $1${RESET}"; }

# ── 恆常部署與可選模組定義 ────────────────────────────────────────
ALWAYS_DEPLOY=(00-env 90-plugins)
MODULE_ORDER=(history keys aliases git tools)
typeset -A MODULE_PREFIX MODULE_DESC
MODULE_PREFIX=(
  history  10
  keys     20
  aliases  30
  git      40
  tools    60
)
MODULE_DESC=(
  history  "歷史記錄（50k 筆 + dedup + 專案歷史自動切換）"
  keys     "按鍵綁定（Option+←/→ 跳單詞、↑↓ 前綴搜尋歷史）"
  aliases  "別名（編輯器偵測 Kiro/Cursor/VSCode + gh / uv + 通用）"
  git      "Git 增強（16 個 alias + delta diff + lazygit）"
  tools    "CLI 工具（bat / eza / zoxide / fd / rg / tldr + FZF）"
)

# ── 解析參數 ──────────────────────────────────────────────────────
SELECTED_MODULES=()
INSTALL_ALL=false
MODULES_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)     INSTALL_ALL=true; shift ;;
    --modules) MODULES_ARG="$2"; shift 2 ;;
    *)         shift ;;
  esac
done

if [[ -n "$MODULES_ARG" ]]; then
  IFS=',' read -rA SELECTED_MODULES <<< "$MODULES_ARG"
elif $INSTALL_ALL; then
  SELECTED_MODULES=($MODULE_ORDER)
else
  # ── 互動式選擇 ────────────────────────────────────────────────
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}║   zsh 環境模組安裝                          ║${RESET}"
  echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
  step "選擇要安裝的 zsh 環境模組"
  echo ""
  echo -e "  ${DIM}恆常部署：00-env.zsh · 90-plugins.zsh${RESET}"
  echo -e "  ${DIM}可選模組（共 ${#MODULE_ORDER}）：${RESET}"
  local i=1
  for name in $MODULE_ORDER; do
    printf "  ${CYAN}[%d]${RESET} %-8s ${DIM}%s${RESET}\n" $i "$name" "$MODULE_DESC[$name]"
    i=$((i + 1))
  done
  echo ""
  echo -e "  ${BOLD}請輸入（Enter = 全部，1,3,5 或 1-3 = 選擇，0 = 取消）：${RESET}"
  printf "  > "
  read -r user_input

  if [[ -z "$user_input" ]]; then
    SELECTED_MODULES=($MODULE_ORDER)
  elif [[ "$user_input" == "0" ]]; then
    warn "已取消"; exit 0
  else
    local indices=()
    for token in ${(s:,:)user_input}; do
      token="${token// /}"
      if [[ "$token" =~ ^([0-9]+)-([0-9]+)$ ]]; then
        for n in {$match[1]..$match[2]}; do indices+=($n); done
      elif [[ "$token" =~ ^[0-9]+$ ]]; then
        indices+=($token)
      fi
    done
    for idx in $indices; do
      (( idx >= 1 && idx <= ${#MODULE_ORDER} )) && SELECTED_MODULES+=($MODULE_ORDER[$idx])
    done
  fi
fi

[[ ${#SELECTED_MODULES} -eq 0 ]] && { warn "未選擇任何模組"; exit 0; }

# ── 計算進度總數（動態，供 JS 層讀取）─────────────────────────────
_total=0
(( _total += 1 ))  # sheldon
(( _total += 1 ))  # node manager（fnm install 或 info）
# 遷移步驟（fnm 模式 + .zshrc 有 nvm/n 設定時多一步）
if [[ "${AB_TAO_NODE_MGR:-auto}" == "fnm" || "${AB_TAO_NODE_MGR:-auto}" == "auto" ]]; then
  [[ -f ~/.zshrc ]] && grep -qE '^[^#]*(nvm\.sh|NVM_DIR|export N_PREFIX)' ~/.zshrc 2>/dev/null && (( _total += 1 ))
fi
NEEDS_BREW=false
for m in $SELECTED_MODULES; do
  [[ "$m" == "tools" || "$m" == "git" ]] && NEEDS_BREW=true && break
done
$NEEDS_BREW && (( _total += ${#${(s: :):-fzf zoxide bat eza fd git-delta lazygit tldr ripgrep}} ))  # brew tools
(( _total += 1 ))  # backup or skip
(( _total += 1 ))  # loader
(( _total += ${#${(s: :)ALWAYS_DEPLOY}} ))  # 恆常模組
(( _total += ${#SELECTED_MODULES} ))  # 可選模組
(( _total += 1 ))  # plugins.toml
(( _total += 2 ))  # sheldon lock + cache
(( _total += 1 ))  # zcompile
[[ " ${SELECTED_MODULES[*]} " == *" tools "* ]] && (( _total += 1 ))  # ripgreprc
echo "TOTAL:${_total}"

# ══════════════════════════════════════════════════════════════════
# ── 安裝依賴 ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════

# ── sheldon（插件管理器）──────────────────────────────────────────
step "安裝 sheldon"
if command -v sheldon &>/dev/null; then
  info "sheldon 已安裝"
else
  if command -v brew &>/dev/null; then
    info "安裝 sheldon..."
    brew install sheldon 2>/dev/null && success "sheldon 安裝完成" || warn "sheldon 安裝失敗"
  else
    warn "未偵測到 brew，請手動安裝 sheldon：https://github.com/rossmacarthur/sheldon"
  fi
fi

# ── Node 版本管理（依據 doctor.mjs 的選擇）─────────────────────
# AB_TAO_NODE_MGR 由 doctor.mjs 設定（fnm/nvm/n），獨立執行時自動偵測
NODE_MGR="${AB_TAO_NODE_MGR:-auto}"
if [[ "$NODE_MGR" == "auto" ]]; then
  # 獨立執行（非 pipeline）→ 自動偵測，可互動
  local _has_fnm=0 _has_nvm=0 _has_n=0
  command -v fnm &>/dev/null && _has_fnm=1
  [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]] && _has_nvm=1
  command -v n &>/dev/null && _has_n=1

  # 判斷是否為互動終端（pipeline 透過 spawn 執行時 stdin 不是 tty）
  local _interactive=false
  [[ -t 0 ]] && _interactive=true

  if (( _has_fnm )) && (( _has_nvm || _has_n )); then
    local _other=$( (( _has_nvm )) && echo "nvm" || echo "n" )
    if $_interactive; then
      echo ""
      echo -e "  ${YELLOW}偵測到 fnm + ${_other} 共存${RESET}"
      echo -e "  ${CYAN}[1]${RESET} 使用 fnm（註解 ${_other} 設定）"
      echo -e "  ${CYAN}[2]${RESET} 保留 ${_other}（略過 fnm 設定）"
      printf "  > "
      read -r _nm_choice
      [[ "$_nm_choice" == "2" ]] && NODE_MGR="$_other" || NODE_MGR="fnm"
    else
      NODE_MGR="fnm"  # 非互動 → 預設 fnm
    fi
  elif (( _has_fnm )); then NODE_MGR="fnm"
  elif (( _has_nvm )); then
    if $_interactive; then
      echo ""
      echo -e "  ${YELLOW}偵測到 nvm，建議切換為 fnm（啟動 ~1ms vs ~1s）${RESET}"
      echo -e "  ${CYAN}[1]${RESET} 切換為 fnm"
      echo -e "  ${CYAN}[2]${RESET} 保留 nvm"
      printf "  > "
      read -r _nm_choice
      [[ "$_nm_choice" == "2" ]] && NODE_MGR="nvm" || NODE_MGR="fnm"
    else
      NODE_MGR="fnm"
    fi
  elif (( _has_n )); then
    if $_interactive; then
      echo ""
      echo -e "  ${YELLOW}偵測到 n，建議切換為 fnm（啟動 ~1ms vs ~1s）${RESET}"
      echo -e "  ${CYAN}[1]${RESET} 切換為 fnm"
      echo -e "  ${CYAN}[2]${RESET} 保留 n"
      printf "  > "
      read -r _nm_choice
      [[ "$_nm_choice" == "2" ]] && NODE_MGR="n" || NODE_MGR="fnm"
    else
      NODE_MGR="fnm"
    fi
  else
    NODE_MGR="fnm"
  fi
fi

if [[ "$NODE_MGR" == "fnm" ]]; then
  step "安裝 fnm"
  if command -v fnm &>/dev/null; then
    info "fnm 已安裝"
  else
    if command -v brew &>/dev/null; then
      info "安裝 fnm..."
      brew install fnm 2>/dev/null && success "fnm 安裝完成" || warn "fnm 安裝失敗"
    else
      warn "未偵測到 brew，請手動安裝 fnm：https://github.com/Schniz/fnm"
    fi
  fi

  # 遷移：註解 .zshrc 中的 nvm/n 設定（safety net，doctor.mjs 通常已處理）
  if [[ -f ~/.zshrc ]] && grep -qE '^[^#]*(nvm\.sh|NVM_DIR|export N_PREFIX)' ~/.zshrc 2>/dev/null; then
    step "遷移：nvm/n → fnm"
    # 標題註解替換為遷移說明
    sed -i '' 's/^# *nvm[[:space:]（(].*/# nvm（node 版本管理, 已由 ab-tao 遷移至 fnm 統一管理）/' ~/.zshrc 2>/dev/null || true
    sed -i '' 's/^# *n[[:space:]（(].*/# n（node 版本管理, 已由 ab-tao 遷移至 fnm 統一管理）/' ~/.zshrc 2>/dev/null || true
    # 程式碼行前加 #
    sed -i '' '/^[^#]*export NVM_DIR=/s/^/# /' ~/.zshrc 2>/dev/null || true
    sed -i '' '/^[^#]*\[ -s.*nvm\.sh/s/^/# /' ~/.zshrc 2>/dev/null || true
    sed -i '' '/^[^#]*source.*nvm\.sh/s/^/# /' ~/.zshrc 2>/dev/null || true
    sed -i '' '/^[^#]*\. .*nvm\.sh/s/^/# /' ~/.zshrc 2>/dev/null || true
    sed -i '' '/^[^#]*\[ -s.*nvm.*bash_completion/s/^/# /' ~/.zshrc 2>/dev/null || true
    sed -i '' '/^[^#]*export N_PREFIX=/s/^/# /' ~/.zshrc 2>/dev/null || true
    success "已註解 nvm/n 設定"
  fi
else
  step "Node 版本管理"
  info "使用 $NODE_MGR 管理 Node 版本（略過 fnm 安裝）"
fi

# ── Homebrew CLI 工具 ─────────────────────────────────────────────
# NEEDS_BREW 已在上方進度計算時設定

if $NEEDS_BREW && command -v brew &>/dev/null; then
  step "安裝 Homebrew CLI 工具"
  BREW_TOOLS=(fzf zoxide bat eza fd git-delta lazygit tldr ripgrep)
  for tool in $BREW_TOOLS; do
    brew list "$tool" &>/dev/null 2>&1 \
      && info "$tool 已安裝" \
      || { info "安裝 $tool ..."; brew install "$tool" 2>/dev/null && success "$tool 安裝完成" || warn "$tool 安裝失敗，略過"; }
  done

  # fzf key-bindings 初始化
  if [ -f "$(brew --prefix)/opt/fzf/install" ]; then
    "$(brew --prefix)/opt/fzf/install" --key-bindings --completion --no-update-rc --no-bash --no-fish 2>/dev/null || true
  fi
fi

# ══════════════════════════════════════════════════════════════════
# ── 備份 + loader 追加 ─────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════

mkdir -p "$DEST_DIR/conf" "$DEST_DIR/sheldon" "$BACKUP_DIR"

step "備份與 loader"

# 備份 .zshrc
if [[ -f ~/.zshrc ]]; then
  cp ~/.zshrc "$BACKUP_DIR/zshrc.$(date +%Y%m%d_%H%M%S)"
  info "~/.zshrc 已備份至 ~/.zshrc.d/backups/"

  # 備份輪替（保留 10 份）
  local _max=10
  local _env_file="$REPO_DIR/.env"
  if [[ -f "$_env_file" ]]; then
    local _val
    _val=$(grep -E '^BACKUP_MAX_COUNT=[0-9]+$' "$_env_file" | cut -d= -f2)
    [[ -n "$_val" && "$_val" -gt 0 ]] && _max=$_val
  fi
  local _backups=("${(@f)$(ls -t "$BACKUP_DIR"/zshrc.* 2>/dev/null)}")
  if (( ${#_backups[@]} > _max )); then
    rm -f "${_backups[@]:$_max}"
    info "備份已清理（上限 ${_max} 份）"
  fi
fi

# 追加 loader（標記檢測，防重複）
if ! grep -qF "$LOADER_MARKER" ~/.zshrc 2>/dev/null; then
  printf '\n%s\n%s\n' "$LOADER_MARKER" \
    'for _f in ~/.zshrc.d/conf/*.zsh(N); do source "$_f"; done; unset _f' \
    >> ~/.zshrc
  success "loader 已追加至 ~/.zshrc"
else
  info "loader 已存在，略過"
fi

# ══════════════════════════════════════════════════════════════════
# ── 部署模組 ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════

# ── 恆常模組 ──────────────────────────────────────────────────────
step "部署恆常模組"
for name in $ALWAYS_DEPLOY; do
  local src="$SRC_DIR/conf/${name}.zsh"
  local dest="$DEST_DIR/conf/${name}.zsh"
  if [[ -f "$dest" ]] && diff -q "$src" "$dest" &>/dev/null; then
    info "${name}.zsh（無變更，略過）"
  else
    cp "$src" "$dest"
    success "${name}.zsh"
  fi
done

# ── 可選模組 ──────────────────────────────────────────────────────
step "部署可選模組（${#SELECTED_MODULES} 個）"
for name in $SELECTED_MODULES; do
  local prefix="${MODULE_PREFIX[$name]}"
  local src="$SRC_DIR/conf/${prefix}-${name}.zsh"
  local dest="$DEST_DIR/conf/${prefix}-${name}.zsh"

  if [[ ! -f "$src" ]]; then
    warn "${prefix}-${name}.zsh 不存在，略過"
    continue
  fi
  if [[ -f "$dest" ]] && diff -q "$src" "$dest" &>/dev/null; then
    info "${prefix}-${name}.zsh（無變更，略過）"
  else
    cp "$src" "$dest"
    success "${prefix}-${name}.zsh"
  fi
done

# ── sheldon plugins.toml ─────────────────────────────────────────
step "部署 sheldon 配置"
local _toml_src="$SRC_DIR/sheldon/plugins.toml"
local _toml_dest="$DEST_DIR/sheldon/plugins.toml"
if [[ -f "$_toml_dest" ]] && diff -q "$_toml_src" "$_toml_dest" &>/dev/null; then
  info "plugins.toml（無變更，略過）"
else
  cp "$_toml_src" "$_toml_dest"
  success "plugins.toml"
fi

# ── sheldon 預下載插件 + 生成快取 ─────────────────────────────────
if command -v sheldon &>/dev/null; then
  step "預載入 sheldon 插件"
  export SHELDON_CONFIG_DIR="$DEST_DIR/sheldon"
  export SHELDON_DATA_DIR="$DEST_DIR/sheldon"
  if sheldon lock --update 2>/dev/null; then
    success "插件已下載"
  else
    warn "插件下載失敗（首次開 shell 時重試）"
  fi
  if sheldon source > "$DEST_DIR/sheldon/cache.zsh" 2>/dev/null && [[ -s "$DEST_DIR/sheldon/cache.zsh" ]]; then
    success "快取已生成"
  else
    warn "快取生成失敗"
    touch "$DEST_DIR/sheldon/cache.zsh"
  fi
  unset SHELDON_CONFIG_DIR SHELDON_DATA_DIR
fi

# ── zcompile 預編譯 ──────────────────────────────────────────────
step "預編譯模組"
local _compiled=0
for f in "$DEST_DIR"/conf/*.zsh(N); do
  zcompile "$f" 2>/dev/null && _compiled=$((_compiled + 1))
done
success "${_compiled} 個模組已編譯"

# ── .gitconfig 合併部署 ───────────────────────────────────────────
step ".gitconfig 配置"
GITCONFIG_SRC="$ZSH_DIR/gitconfig"
GITCONFIG_DST="$HOME/.gitconfig"
if [[ -f "$GITCONFIG_SRC" ]]; then
  if [[ -f "$GITCONFIG_DST" ]]; then
    local _user_section
    _user_section=$(git config --global --get-regexp '^user\.' 2>/dev/null || true)
    cp "$GITCONFIG_SRC" "$GITCONFIG_DST"
    if [[ -n "$_user_section" ]]; then
      while IFS= read -r _line; do
        local _key="${_line%% *}"
        local _val="${_line#* }"
        # 只還原 user.* 欄位，防止異常 gitconfig 污染其他設定
        [[ "$_key" =~ ^user\. ]] || continue
        git config --global "$_key" "$_val"
      done <<< "$_user_section"
    fi
    success ".gitconfig 已更新（保留 user 資訊）"
  else
    cp "$GITCONFIG_SRC" "$GITCONFIG_DST"
    success ".gitconfig 已建立"
  fi
else
  info "gitconfig 模板不存在，略過"
fi

# ── starship.toml 部署 ───────────────────────────────────────────
if command -v starship &>/dev/null; then
  step "Starship 配置"
  STARSHIP_TOML="$HOME/.config/starship.toml"
  STARSHIP_SRC="$ZSH_DIR/starship.toml"
  if [[ -f "$STARSHIP_SRC" ]]; then
    mkdir -p "$(dirname "$STARSHIP_TOML")"
    if [[ -f "$STARSHIP_TOML" ]] && [[ ! -f "${STARSHIP_TOML}.pre-abtao" ]]; then
      cp "$STARSHIP_TOML" "${STARSHIP_TOML}.pre-abtao"
      info "現有 starship.toml 已備份為 .pre-abtao"
    fi
    cp "$STARSHIP_SRC" "$STARSHIP_TOML"
    success "starship.toml 已部署"
  else
    info "starship.toml 模板不存在，略過"
  fi
fi

# ── ~/.ripgreprc ──────────────────────────────────────────────────
if [[ " ${SELECTED_MODULES[*]} " == *" tools "* ]]; then
  if [[ -f ~/.ripgreprc ]]; then
    info "~/.ripgreprc 已存在，保留不動"
  else
    cat > ~/.ripgreprc << 'RGEOF'
--line-number
--color=auto
--hidden
--smart-case
--glob=!.git/*
--glob=!node_modules/*
--glob=!dist/*
--glob=!build/*
RGEOF
    success "~/.ripgreprc 建立完成"
  fi
fi

# ── 寫入版本號 ────────────────────────────────────────────────────
local _version
_version=$(cd "$REPO_DIR" && node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
echo "$_version" > "$DEST_DIR/.version"

# ══════════════════════════════════════════════════════════════════
# ── 完成 ────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║  ✅ zsh 環境模組安裝完成                     ║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${RESET}"
echo -e "  恆常模組：${CYAN}${ALWAYS_DEPLOY[*]}${RESET}"
echo -e "  可選模組：${CYAN}${SELECTED_MODULES[*]}${RESET}"
echo -e "  部署路徑：${DIM}~/.zshrc.d/（conf/ + sheldon/）${RESET}"

# 啟動加速提示
if [[ -f ~/.zshrc ]]; then
  local _has_slow=false
  grep -q 'nvm\.sh' ~/.zshrc 2>/dev/null && _has_slow=true
  grep -q 'pyenv init' ~/.zshrc 2>/dev/null && _has_slow=true
  if $_has_slow; then
    echo ""
    echo -e "  ${YELLOW}💡 啟動加速提示：${RESET}"
    # 只在用戶保留 nvm 時提示（fnm 模式下已自動註解）
    if [[ "$NODE_MGR" != "fnm" ]] && grep -q 'nvm\.sh' ~/.zshrc 2>/dev/null; then
      echo -e "  ${DIM}  移除 source nvm.sh 可省 ~1s（00-env.zsh 已配置 cd 自動切換）${RESET}"
    fi
    grep -q 'pyenv init' ~/.zshrc 2>/dev/null && \
      echo -e "  ${DIM}  移除 eval \"\$(pyenv init -)\" 可省 ~300ms（ab-tao 已提供 lazy load）${RESET}"
  fi
fi

echo ""
echo -e "  執行 ${BOLD}exec zsh${RESET} 立即套用"
