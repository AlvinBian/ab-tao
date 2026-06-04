# ── 插件載入（sheldon）+ 補全 + Prompt ────────────────────────────
[[ -n "$_AB_90_PLUGINS_LOADED" ]] && return; _AB_90_PLUGINS_LOADED=1

# sheldon source 快取（只在 plugins.toml 變動時重新生成）
_sheldon_cache="$HOME/.zshrc.d/sheldon/cache.zsh"
_sheldon_toml="$HOME/.zshrc.d/sheldon/plugins.toml"

if [[ ! -f "$_sheldon_cache" || "$_sheldon_toml" -nt "$_sheldon_cache" ]]; then
  if _command_exists sheldon; then
    sheldon source > "$_sheldon_cache" 2>/dev/null
    if [[ ! -s "$_sheldon_cache" ]]; then
      rm -f "$_sheldon_cache"
    fi
  fi
fi
[[ -f "$_sheldon_cache" ]] && source "$_sheldon_cache"
unset _sheldon_cache _sheldon_toml

# fzf shell 整合（有 zsh-defer 就延遲，沒有就同步）
if (( ${+functions[zsh-defer]} )); then
  zsh-defer _safe_source "${BREW_PREFIX}/opt/fzf/shell/key-bindings.zsh"
  zsh-defer _safe_source "${BREW_PREFIX}/opt/fzf/shell/completion.zsh"
else
  _safe_source "${BREW_PREFIX}/opt/fzf/shell/key-bindings.zsh"
  _safe_source "${BREW_PREFIX}/opt/fzf/shell/completion.zsh"
fi

# compinit（sheldon 加完 fpath 之後統一執行）
autoload -Uz compinit
if [[ -f ~/.zcompdump && -z ~/.zcompdump(#qN.mh+24) ]]; then
  compinit -C
else
  compinit
fi

# 補全樣式
zstyle ':completion:*' completer _expand _complete _correct _approximate
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list '' 'm:{a-zA-Z}={A-Za-z}' 'r:|[._-]=* r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*:descriptions' format '%F{yellow}── %d ──%f'
zstyle ':completion:*:warnings' format '%F{red}找不到符合項目%f'
zstyle ':completion:*' group-name ''
zstyle ':completion:*' rehash true
zstyle ':completion:*' use-cache on
zstyle ':completion:*' cache-path "$HOME/.zsh/cache"
zstyle ':completion:*:*:*:*:processes' command "ps -u $USER -o pid,user,comm -w -w"
zstyle ':completion:*:*:kill:*:processes' list-colors '=(#b) #([0-9]#) ([0-9a-z-]#)*=01;34=0=01'

# fzf-tab（必須在 compinit 之後同步載入，用 glob 避免硬編碼 sheldon 內部路徑）
if [[ -n "$SHELDON_DATA_DIR" ]]; then
  for _fzf_tab in "$SHELDON_DATA_DIR"/repos/*/Aloxaf/fzf-tab(N); do
    [[ -f "$_fzf_tab/fzf-tab.plugin.zsh" ]] && source "$_fzf_tab/fzf-tab.plugin.zsh"
    break
  done
  unset _fzf_tab
fi

# starship prompt（必須同步，不可 defer — prompt 必須在首次渲染前就緒）
# fallback：starship 未安裝時顯示簡易 prompt
if _command_exists starship && [[ $- == *i* ]]; then
  eval "$(starship init zsh)"
else
  PROMPT='%F{blue}%~%f %# '
fi
