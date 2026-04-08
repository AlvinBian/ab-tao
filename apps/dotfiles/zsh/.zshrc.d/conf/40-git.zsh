# ── Git 增強 ──────────────────────────────────────────────────────

# delta diff viewer（僅在未配置時設定，避免每次開 shell 寫磁碟）
if _command_exists delta && [[ "$(git config --global core.pager)" != "delta" ]]; then
  git config --global core.pager delta
  git config --global delta.navigate true
  git config --global delta.light false
  git config --global delta.line-numbers true
  git config --global interactive.diffFilter "delta --color-only"
fi

_command_exists lazygit && (( ! ${+aliases[lg]} )) && alias lg='lazygit'

# git aliases（guard：用戶已設定則跳過）
(( ${+aliases[gs]} ))   || alias gs='git status'
(( ${+aliases[gst]} ))  || alias gst='git status --short --branch'
(( ${+aliases[gd]} ))   || alias gd='git diff'
(( ${+aliases[gds]} ))  || alias gds='git diff --staged'
(( ${+aliases[gl]} ))   || alias gl='git log --oneline --graph --decorate --all'
(( ${+aliases[gll]} ))  || alias gll='git log --pretty=format:"%C(yellow)%h%Creset %C(blue)%ad%Creset %s %C(green)[%an]%Creset" --date=short'
(( ${+aliases[ga]} ))   || alias ga='git add'
(( ${+aliases[gaa]} ))  || alias gaa='git add --all'
(( ${+aliases[gc]} ))   || alias gc='git commit -m'
(( ${+aliases[gca]} ))  || alias gca='git commit --amend'
(( ${+aliases[gco]} ))  || alias gco='git checkout'
(( ${+aliases[gcb]} ))  || alias gcb='git checkout -b'
(( ${+aliases[gb]} ))   || alias gb='git branch'
(( ${+aliases[gba]} ))  || alias gba='git branch -a'
(( ${+aliases[gp]} ))   || alias gp='git push'
(( ${+aliases[gpf]} ))  || alias gpf='git push --force-with-lease'
(( ${+aliases[gpl]} ))  || alias gpl='git pull'
(( ${+aliases[gplr]} )) || alias gplr='git pull --rebase'
