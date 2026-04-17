# ── 環境基礎（所有模組依賴此檔案）─────────────────────────────────

# PATH 去重（防止用戶配置與模組重複追加）
typeset -U path

# 工具函式（所有模組共用）
_command_exists() { command -v "$1" &>/dev/null; }
_safe_source()    { [[ -s "$1" ]] && source "$1"; }

# 個人偏好（ab-tao setup 生成）
[[ -f "$HOME/.zshrc.d/.prefs.zsh" ]] && source "$HOME/.zshrc.d/.prefs.zsh"

# Homebrew（硬編碼路徑，省 ~200ms 的 brew --prefix 調用）
if [[ -d "/opt/homebrew" ]]; then
  export BREW_PREFIX="/opt/homebrew"
elif [[ -d "/usr/local/Cellar" ]]; then
  export BREW_PREFIX="/usr/local"
else
  export BREW_PREFIX="/usr/local"
fi

# sheldon 配置與數據統一放在 ~/.zshrc.d/sheldon/
export SHELDON_CONFIG_DIR="$HOME/.zshrc.d/sheldon"
export SHELDON_DATA_DIR="$HOME/.zshrc.d/sheldon"

# you-should-use：提醒顯示在命令輸出之前 + 顯示級別
export YSU_MESSAGE_POSITION="before"
export YSU_MODE="ALL"

# pnpm PATH（guard：已在 PATH 就跳過）
export PNPM_HOME="$HOME/Library/pnpm"
[[ ":$PATH:" != *":$PNPM_HOME:"* ]] && export PATH="$PNPM_HOME:$PATH"

# Node 版本管理 — 依 AB_NODE_MANAGER_ORDER 優先順序載入
# 預設：fnm > nvm > n（互斥，只載入第一個匹配的）
_setup_fnm() {
  _command_exists fnm || return 1
  eval "$(fnm env --use-on-cd --version-file-strategy=recursive --shell zsh)"
  _auto_fnm_install() {
    { [[ -f ".node-version" ]] || [[ -f ".nvmrc" ]]; } || return
    local _want
    _want=$(cat .node-version 2>/dev/null || cat .nvmrc 2>/dev/null)
    [[ -z "$_want" ]] && return
    fnm list 2>/dev/null | grep -qF "$_want" && return
    echo "fnm: 安裝 Node $_want ..."
    fnm install "$_want" && fnm use "$_want"
  }
  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_fnm_install
  _auto_fnm_install
  return 0
}
_setup_nvm() {
  [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]] || return 1
  _command_exists nvm || source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  _auto_nvm_use() {
    [[ -f ".nvmrc" ]] || return
    local _want=$(<.nvmrc)
    [[ "$(nvm version 2>/dev/null)" == "v${_want}"* ]] && return
    nvm use "$_want" 2>/dev/null || echo "nvm: 版本 $_want 未安裝（nvm install $_want）"
  }
  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_nvm_use
  _auto_nvm_use
  return 0
}
_setup_n() {
  _command_exists n || return 1
  _auto_n_use() {
    { [[ -f ".node-version" ]] || [[ -f ".nvmrc" ]]; } || return
    n auto &>/dev/null || true
  }
  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_n_use
  _auto_n_use
  return 0
}

# 依偏好順序嘗試載入，第一個成功即停止
local -a _node_order=("${AB_NODE_MANAGER_ORDER[@]}")
(( ${#_node_order[@]} )) || _node_order=("fnm" "nvm" "n")
for _mgr in "${_node_order[@]}"; do
  case "$_mgr" in
    fnm) _setup_fnm && break ;;
    nvm) _setup_nvm && break ;;
    n)   _setup_n   && break ;;
  esac
done
unset _mgr _node_order
unfunction _setup_fnm _setup_nvm _setup_n 2>/dev/null || true

# pyenv lazy load（guard：用戶已初始化則跳過）
if [[ -d "$HOME/.pyenv" && -z "$PYENV_SHELL" ]]; then
  export PYENV_ROOT="$HOME/.pyenv"
  [[ ":$PATH:" != *":$PYENV_ROOT/bin:"* ]] && export PATH="$PYENV_ROOT/bin:$PATH"
  pyenv()   { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; pyenv "$@"; }
  python()  { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; python  "$@"; }
  python3() { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; python3 "$@"; }
fi
