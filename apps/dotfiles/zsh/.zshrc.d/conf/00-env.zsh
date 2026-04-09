# ── 環境基礎（所有模組依賴此檔案）─────────────────────────────────

# PATH 去重（防止用戶配置與模組重複追加）
typeset -U path

# 工具函式（所有模組共用）
_command_exists() { command -v "$1" &>/dev/null; }
_safe_source()    { [[ -s "$1" ]] && source "$1"; }

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

# pnpm PATH（guard：已在 PATH 就跳過）
export PNPM_HOME="$HOME/Library/pnpm"
[[ ":$PATH:" != *":$PNPM_HOME:"* ]] && export PATH="$PNPM_HOME:$PATH"

# Node 版本管理 — 自動偵測 fnm / nvm / n，啟用 cd 自動切換
# 優先級：fnm > nvm > n（互斥，只載入第一個匹配的）
if _command_exists fnm; then
  # fnm — 官方推薦寫法，無 guard（冪等 ~1ms，避免 IDE 繼承 stale 環境）
  eval "$(fnm env --use-on-cd --version-file-strategy=recursive --shell zsh)"
  # fnm — 自動安裝缺少的版本（--use-on-cd 只切換不安裝，這裡補足）
  _auto_fnm_install() {
    { [[ -f ".node-version" ]] || [[ -f ".nvmrc" ]]; } || return
    local _want
    _want=$(cat .node-version 2>/dev/null || cat .nvmrc 2>/dev/null)
    [[ -z "$_want" ]] && return
    # 已安裝則跳過（避免每次 cd 都呼叫 fnm list）
    fnm list 2>/dev/null | grep -qF "$_want" && return
    echo "fnm: 安裝 Node $_want ..."
    fnm install "$_want" && fnm use "$_want"
  }
  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_fnm_install
  _auto_fnm_install
elif [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # nvm — 用戶選擇保留，確保 nvm.sh 已載入 + cd 自動切換（讀取 .nvmrc）
  # 用戶 .zshrc 中的 source nvm.sh 可能已被註解，這裡補載入
  if ! _command_exists nvm; then
    source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  fi
  _auto_nvm_use() {
    [[ -f ".nvmrc" ]] || return
    local _want=$(<.nvmrc)
    [[ "$(nvm version 2>/dev/null)" == "v${_want}"* ]] && return
    nvm use "$_want" 2>/dev/null || echo "nvm: 版本 $_want 未安裝（nvm install $_want）"
  }
  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_nvm_use
  _auto_nvm_use
elif _command_exists n; then
  # n — cd 自動切換（讀取 .node-version / .nvmrc）
  _auto_n_use() {
    { [[ -f ".node-version" ]] || [[ -f ".nvmrc" ]]; } || return
    n auto &>/dev/null || true
  }
  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_n_use
  _auto_n_use
fi

# pyenv lazy load（guard：用戶已初始化則跳過）
if [[ -d "$HOME/.pyenv" && -z "$PYENV_SHELL" ]]; then
  export PYENV_ROOT="$HOME/.pyenv"
  [[ ":$PATH:" != *":$PYENV_ROOT/bin:"* ]] && export PATH="$PYENV_ROOT/bin:$PATH"
  pyenv()   { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; pyenv "$@"; }
  python()  { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; python  "$@"; }
  python3() { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; python3 "$@"; }
fi
