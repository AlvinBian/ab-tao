claude() {
  # 明確解析 claude 二進制，避免 PATH 時序問題
  local _bin
  for _p in "$HOME/.local/bin/claude" "/usr/local/bin/claude" "/opt/homebrew/bin/claude"; do
    [[ -x "$_p" ]] && _bin="$_p" && break
  done
  if [[ -z "$_bin" ]]; then
    _bin=$(PATH="$HOME/.local/bin:$PATH" command -v claude 2>/dev/null)
  fi
  if [[ -z "$_bin" ]]; then
    echo "❌ claude CLI 未找到，請確認安裝：https://claude.ai/code" >&2
    return 127
  fi
  "$_bin" "$@"
}

# Claude Code 短命令 alias
alias cc='claude'
alias ccc='claude --continue'
alias ccr='claude --resume'
alias ccp='claude --print'
