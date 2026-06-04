# ── 歷史記錄設定（guard：用戶已設定則跳過）────────────────────────
[[ -n "$_AB_10_HISTORY_LOADED" ]] && return; _AB_10_HISTORY_LOADED=1

(( HISTSIZE > 1 )) || HISTSIZE=50000
(( SAVEHIST > 1 )) || SAVEHIST=50000
[[ -n "$HISTFILE" ]] || HISTFILE="$HOME/.zsh_history"

setopt HIST_EXPIRE_DUPS_FIRST
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_FIND_NO_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_SAVE_NO_DUPS
setopt HIST_REDUCE_BLANKS
setopt INC_APPEND_HISTORY
setopt SHARE_HISTORY
setopt EXTENDED_HISTORY

# ── 專案歷史自動切換（進入 git repo 時切換到專案專屬歷史檔）─────

_ZSH_HISTORY_GLOBAL="$HOME/.zsh_history"
_ZSH_HISTORY_DIR="$HOME/.zsh/history.d"

_update_project_history() {
  local git_root
  git_root=$(git rev-parse --show-toplevel 2>/dev/null)

  if [[ -n "$git_root" ]]; then
    local repo_name=$(basename "$git_root")
    local project_hist="$_ZSH_HISTORY_DIR/$repo_name"
    mkdir -p "$_ZSH_HISTORY_DIR"

    if [[ "$HISTFILE" != "$project_hist" ]]; then
      fc -W 2>/dev/null
      HISTFILE="$project_hist"
      fc -R "$_ZSH_HISTORY_GLOBAL" 2>/dev/null
      fc -R "$project_hist" 2>/dev/null
    fi
  else
    if [[ "$HISTFILE" != "$_ZSH_HISTORY_GLOBAL" ]]; then
      fc -W 2>/dev/null
      HISTFILE="$_ZSH_HISTORY_GLOBAL"
      fc -R "$_ZSH_HISTORY_GLOBAL" 2>/dev/null
    fi
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd _update_project_history
_update_project_history
