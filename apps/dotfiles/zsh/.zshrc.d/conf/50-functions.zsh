# ── 實用函式 ──────────────────────────────────────────────────────

# set-ssh-key <hostname> [key-name]
# 產生 Ed25519 SSH key，加入 ssh-agent，更新 ~/.ssh/config，複製公鑰
set-ssh-key() {
  local host="${1:?用法：set-ssh-key <hostname> [key-name]（例：set-ssh-key github.com）}"
  local name="${2:-$(echo "$host" | tr '.' '_' | tr '[:upper:]' '[:lower:]')}"
  local key_path="$HOME/.ssh/id_ed25519_${name}"

  # 產生 Ed25519 金鑰（如果尚不存在）
  if [[ ! -f "$key_path" ]]; then
    local email
    email=$(git config --global user.email 2>/dev/null || echo "$(whoami)@$(hostname -s)")
    ssh-keygen -t ed25519 -C "${email}" -f "$key_path" -N "" || return 1
    echo "✅ 已產生：${key_path}"
  else
    echo "ℹ️  金鑰已存在：${key_path}（略過產生）"
  fi

  # 加入 ssh-agent（macOS 使用 Keychain）
  if ssh-add --apple-use-keychain "$key_path" 2>/dev/null; then
    echo "✅ 已加入 Keychain"
  else
    ssh-add "$key_path" 2>/dev/null && echo "✅ 已加入 ssh-agent"
  fi

  # 寫入 ~/.ssh/config（避免重複）
  local config_file="$HOME/.ssh/config"
  mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
  if ! grep -qF "Host ${host}" "$config_file" 2>/dev/null; then
    {
      printf '\nHost %s\n' "$host"
      printf '  AddKeysToAgent yes\n'
      printf '  UseKeychain yes\n'
      printf '  IdentityFile %s\n' "$key_path"
    } >> "$config_file"
    chmod 600 "$config_file"
    echo "✅ 已寫入 ~/.ssh/config"
  else
    echo "ℹ️  ~/.ssh/config 中已有 Host ${host} 設定"
  fi

  # 複製公鑰到剪貼簿
  if pbcopy < "${key_path}.pub" 2>/dev/null; then
    echo "📋 公鑰已複製到剪貼簿，請貼到 ${host} 的 SSH key 設定頁面"
  fi

  echo ""
  echo "公鑰內容："
  cat "${key_path}.pub"
}

# mkcd <dir> — 建立目錄並進入
mkcd() {
  mkdir -p "$1" && cd "$1" || return 1
}

# extract <file> — 解壓縮任意格式
extract() {
  local f="$1"
  [[ -f "$f" ]] || { echo "extract: '$f' 不是有效檔案"; return 1; }
  case "$f" in
    *.tar.gz|*.tgz)  tar xzf "$f" ;;
    *.tar.bz2|*.tbz) tar xjf "$f" ;;
    *.tar.xz)        tar xJf "$f" ;;
    *.tar)           tar xf  "$f" ;;
    *.gz)            gunzip  "$f" ;;
    *.bz2)           bunzip2 "$f" ;;
    *.zip)           unzip   "$f" ;;
    *.7z)            7z x    "$f" ;;
    *)               echo "extract: 不支援的格式：${f##*.}"; return 1 ;;
  esac
}
