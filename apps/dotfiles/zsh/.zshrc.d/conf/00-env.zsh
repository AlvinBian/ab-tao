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

# fnm — Node 版本管理（Rust，~1ms 啟動，自動讀取 .nvmrc / .node-version）
# guard：用戶 .zshrc 可能已有 nvm.sh 或 fnm env，不重複初始化
if _command_exists fnm && [[ -z "$FNM_DIR" ]]; then
  eval "$(fnm env --use-on-cd --shell zsh)"
fi

# pyenv lazy load（guard：用戶已初始化則跳過）
if [[ -d "$HOME/.pyenv" && -z "$PYENV_SHELL" ]]; then
  export PYENV_ROOT="$HOME/.pyenv"
  [[ ":$PATH:" != *":$PYENV_ROOT/bin:"* ]] && export PATH="$PYENV_ROOT/bin:$PATH"
  pyenv()   { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; pyenv "$@"; }
  python()  { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; python  "$@"; }
  python3() { unset -f pyenv python python3 2>/dev/null; eval "$(command pyenv init - zsh)"; python3 "$@"; }
fi
