# ── 現代 CLI 工具 + FZF 環境變數 ──────────────────────────────────

# bat（cat / less 替代）— 語法高亮 + 行號 + git 標記
if _command_exists bat; then
  (( ${+aliases[cat]} ))  || alias cat='bat'
  (( ${+aliases[less]} )) || alias less='bat --pager="less -RF"'
  export BAT_THEME="${AB_BAT_THEME:-TwoDark}"
fi

# eza（ls 替代）— 彩色圖示 + git 狀態
if _command_exists eza; then
  (( ${+aliases[ls]} ))   || alias ls='eza --icons=auto --color=auto --group-directories-first'
  (( ${+aliases[ll]} ))   || alias ll='eza -l --icons --git --group-directories-first'
  (( ${+aliases[la]} ))   || alias la='eza -la --icons --git --group-directories-first'
  (( ${+aliases[lt]} ))   || alias lt='eza --tree --icons --level=2'
  (( ${+aliases[tree]} )) || alias tree='eza -T --icons --git'
fi

# zoxide（智能 cd — 記住常用目錄）
if _command_exists zoxide && [[ $- == *i* ]]; then
  eval "$(zoxide init zsh)"
  (( ${+aliases[cd]} )) || alias cd='z'
fi

# fd（find 替代）
_command_exists fd && (( ! ${+aliases[find]} )) && alias find='fd'

# ripgrep（grep 替代）— 極速搜索
if _command_exists rg; then
  export RIPGREP_CONFIG_PATH="$HOME/.ripgreprc"
  (( ${+aliases[grep]} )) || alias grep='rg'
fi

# dust（du 替代）— 視覺化磁碟使用量
_command_exists dust && (( ! ${+aliases[du]} )) && alias du='dust'

# procs（ps 替代）— 彩色進程列表
_command_exists procs && (( ! ${+aliases[ps]} )) && alias ps='procs'

# bottom（top 替代）— 現代化系統監控
_command_exists btm  && (( ! ${+aliases[top]} )) && alias top='btm'
# btop（保留短命令 bt 用於重度監控）
_command_exists btop && (( ! ${+aliases[bt]} )) && alias bt='btop'

# curlie（curl 替代）— 彩色高亮輸出
_command_exists curlie && (( ! ${+aliases[curl]} )) && alias curl='curlie'

# tldr（man 替代）— 實用範例速查
if _command_exists tldr; then
  (( ${+aliases[help]} )) || alias help='tldr'
  (( ${+aliases[man]} ))  || alias man='tldr'
fi

# navi（互動式 cheatsheet — Ctrl+G 呼出搜索面板）
_command_exists navi && eval "$(navi widget zsh)"

# Claude Code CLI 短命令
_command_exists claude && (( ! ${+aliases[cc]} )) && alias cc='claude'

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
