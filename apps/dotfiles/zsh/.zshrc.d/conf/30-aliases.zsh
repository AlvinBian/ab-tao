# ── 別名與編輯器偵測 ──────────────────────────────────────────────

# 編輯器自動偵測（guard：用戶已設定 EDITOR 則跳過）
if [[ -z "$EDITOR" ]]; then
  for _e in \
    "/Applications/Kiro.app/Contents/Resources/app/bin/code" \
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" \
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; do
    if [[ -x "$_e" ]]; then
      export EDITOR="$_e" VISUAL="$_e"; alias code="$_e"; break
    fi
  done
  unset _e
  [[ -z "$EDITOR" ]] && export EDITOR="vim" VISUAL="vim"
fi

open() {
  if [[ "$1" == "-e" ]]; then shift; "$EDITOR" "$@"
  else command open "$@"; fi
}

# GitHub CLI
_command_exists gh && {
  alias ghpr='gh pr create'
  alias ghprl='gh pr list'
  alias ghprv='gh pr view --web'
}

# uv（Python 套件管理）
_command_exists uv && {
  alias pip='uv pip'
  alias venv='uv venv'
}

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
