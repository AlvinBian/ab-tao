# ── 別名與編輯器偵測 ──────────────────────────────────────────────

# CLI 編輯器（git commit / 終端工具）— 由 AB_CLI_EDITOR 偏好控制
[[ -z "$EDITOR" ]] && export EDITOR="${AB_CLI_EDITOR:-vim}" VISUAL="${AB_CLI_EDITOR:-vim}"

# GUI 編輯器偵測（open -e / code alias）— 依 AB_GUI_EDITOR_ORDER 優先順序
if [[ -z "$GUI_EDITOR" ]]; then
  local -a _gui_order=("${AB_GUI_EDITOR_ORDER[@]}")
  (( ${#_gui_order[@]} )) || _gui_order=(
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"
    "/Applications/Kiro.app/Contents/Resources/app/bin/code"
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
  )
  for _e in "${_gui_order[@]}"; do
    [[ -x "$_e" ]] && { export GUI_EDITOR="$_e"; alias code="$_e"; break; }
  done
  unset _e _gui_order
fi

open() {
  if [[ "$1" == "-e" ]]; then shift; "${GUI_EDITOR:-${EDITOR:-vim}}" "$@"
  else command open "$@"; fi
}

# GitHub CLI
_command_exists gh && {
  alias ghpr='gh pr create'
  alias ghprl='gh pr list'
  alias ghprv='gh pr view --web'
}

# GitNexus 知識圖譜 CLI
if _command_exists gitnexus; then
  # Index 管理
  alias gna='gitnexus analyze --index-only'
  alias gnaf='gitnexus analyze --index-only --force'
  alias gnidx='gitnexus index'
  alias gnc='gitnexus clean'
  alias gnrm='gitnexus remove'

  # 狀態 / 列表
  alias gns='gitnexus status'
  alias gnl='gitnexus list'
  alias gndr='gitnexus doctor'

  # UI / Server
  alias gnui='gitnexus serve'
  alias gnmcp='gitnexus mcp'

  # 查詢 / 分析
  alias gnq='gitnexus query'
  alias gnctx='gitnexus context'
  alias gnimp='gitnexus impact'
  alias gncy='gitnexus cypher'
  alias gndc='gitnexus detect-changes'

  # 輸出 / 發佈
  alias gnw='gitnexus wiki'
  alias gnpub='gitnexus publish'

  # Group（跨 repo）
  alias gngrp='gitnexus group'
  alias gngrpl='gitnexus group list'
  alias gngrps='gitnexus group sync'
  alias gngrpi='gitnexus group impact'
  alias gngrpq='gitnexus group query'

  # 初始設定
  alias gnsetup='gitnexus setup'
fi

# uv（Python 套件管理）— AB_UV_OVERRIDE_PIP=false 可關閉覆蓋
if [[ "${AB_UV_OVERRIDE_PIP:-true}" == "true" ]]; then
  _command_exists uv && { alias pip='uv pip'; alias venv='uv venv'; }
fi

# 通用（guard：用戶已設定則跳過）
(( ${+aliases[reload]} ))  || alias reload='source ~/.zshrc && echo "✔ reloaded"'
alias zshconfig='${EDITOR:-vim} ~/.zshrc'
alias zshmodules='${EDITOR:-vim} ~/.zshrc.d/conf/'
(( ${+aliases[path]} ))    || alias path='echo $PATH | tr ":" "\n"'
(( ${+aliases[myip]} ))    || alias myip='curl -s https://ipinfo.io/ip'
(( ${+aliases[ports]} ))   || alias ports='lsof -iTCP -sTCP:LISTEN -P'
(( ${+aliases[dud]} ))     || alias dud='du -d 1 -h | sort -hr'
(( ${+aliases[..]} ))      || alias ..='cd ..'
(( ${+aliases[...]} ))     || alias ...='cd ../..'
(( ${+aliases[....]} ))    || alias ....='cd ../../..'
