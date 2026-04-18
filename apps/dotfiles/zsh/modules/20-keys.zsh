# ── 按鍵綁定 ──────────────────────────────────────────────────────

# emacs 模式 → -e；vi 模式 → -v（由 AB_KEYBINDING 偏好控制）
case "${AB_KEYBINDING:-emacs}" in
  vi) bindkey -v ;;
  *)  bindkey -e ;;
esac

bindkey '\e[1;3D' backward-word    # Option+Left
bindkey '\e[1;3C' forward-word     # Option+Right
bindkey '\eb'     backward-word
bindkey '\ef'     forward-word

bindkey '\e[1;5D' backward-word    # Ctrl+Left
bindkey '\e[1;5C' forward-word     # Ctrl+Right

bindkey '^[[A'    history-search-backward  # ↑ 前綴搜尋歷史
bindkey '^[[B'    history-search-forward   # ↓ 前綴搜尋歷史

bindkey '^U'      backward-kill-line
bindkey '^K'      kill-line
bindkey '^W'      backward-kill-word

# Home / End / Delete（terminfo 可攜式，跨終端機相容）
if (( ${+terminfo} )); then
  [[ -n "${terminfo[khome]}" ]] && bindkey "${terminfo[khome]}" beginning-of-line
  [[ -n "${terminfo[kend]}" ]]  && bindkey "${terminfo[kend]}" end-of-line
  [[ -n "${terminfo[kdch1]}" ]] && bindkey "${terminfo[kdch1]}" delete-char
fi

# 在 $EDITOR 中編輯當前命令（Ctrl+X Ctrl+E）
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '^X^E' edit-command-line

# 路徑分隔：移除 / 讓 Ctrl+W / Option+Backspace 在路徑分隔符停止
WORDCHARS=${WORDCHARS//[\/]}
