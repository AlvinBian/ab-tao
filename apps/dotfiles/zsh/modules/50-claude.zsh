# Claude Code iCloud 同步自動設定
# 每次執行 claude 前，確認 ~/.claude 已正確指向 iCloud/ab-async
claude() {
  local sync="$HOME/Library/Mobile Documents/com~apple~CloudDocs/ab-async"

  if [[ -d "$sync/.claude" && ! -L "$HOME/.claude" ]]; then
    echo "[claude] 偵測到 iCloud ab-async，自動建立 symlink..."
    [[ -d "$HOME/.claude" ]] && mv "$HOME/.claude" "$HOME/.claude_backup_$(date +%Y%m%d_%H%M%S)"
    ln -s "$sync/.claude" "$HOME/.claude"
    echo "[claude] ~/.claude → iCloud/ab-async 同步已設定"
  fi

  command claude "$@"
}

# Claude Code 短命令 alias
alias cc='claude'
alias ccc='claude --continue'
alias ccr='claude --resume'
alias ccp='claude --print'
