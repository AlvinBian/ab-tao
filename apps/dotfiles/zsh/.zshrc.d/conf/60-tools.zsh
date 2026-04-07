# ── 現代 CLI 工具 + FZF 環境變數 ──────────────────────────────────

# bat（cat / less 替代）
if _command_exists bat; then
  (( ${+aliases[cat]} ))  || alias cat='bat --style=plain'
  (( ${+aliases[less]} )) || alias less='bat --pager="less -RF"'
  export BAT_THEME="TwoDark"
fi

# eza（ls 替代）
if _command_exists eza; then
  (( ${+aliases[ls]} )) || alias ls='eza --icons --group-directories-first'
  (( ${+aliases[ll]} )) || alias ll='eza -alF --icons --group-directories-first --git'
  (( ${+aliases[la]} )) || alias la='eza -a --icons --group-directories-first'
  (( ${+aliases[lt]} )) || alias lt='eza --tree --icons --level=2'
fi

# fd（find 替代）
_command_exists fd && (( ! ${+aliases[find]} )) && alias find='fd'

# zoxide（cd 替代）
_command_exists zoxide && [[ $- == *i* ]] && eval "$(zoxide init zsh)" && alias cd='z'

# ripgrep
_command_exists rg && export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"

# tldr（help 替代）
_command_exists tldr && (( ! ${+aliases[help]} )) && alias help='tldr'

# FZF 環境變數（key-bindings 由 90-plugins.zsh 延遲載入）
if _command_exists fzf; then
  if _command_exists fd; then
    export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'
    export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
    export FZF_ALT_C_COMMAND='fd --type d --hidden --follow --exclude .git'
  fi
  _command_exists bat && export FZF_CTRL_T_OPTS="--preview 'bat --color=always --line-range=:50 {}' --preview-window=right:50%"
  export FZF_DEFAULT_OPTS="--height 40% --layout=reverse --border --info=inline"
fi
