# ── 工具速查 ──────────────────────────────────────────────────────

# cheat — 顯示所有現代 CLI 工具替代對照表
cheat() {
  local C='\033[0;36m' G='\033[0;32m' Y='\033[1;33m' D='\033[2m' N='\033[0m'
  cat <<EOF

${Y}ab-tao 現代 CLI 工具速查${N}
$D──────────────────────────────────────────────────$N
${C} 原始命令    替代工具    說明${N}
$D──────────────────────────────────────────────────$N
${G} cat${N}    →   bat        語法高亮 + 行號 + git 標記
${G} ls${N}     →   eza        彩色圖示 + 目錄優先
${G} ll${N}     →   eza -l     長格式 + git 狀態
${G} la${N}     →   eza -la    含隱藏檔
${G} tree${N}   →   eza -T     樹狀檢視 + git
${G} cd${N}     →   z          zoxide 智能跳目錄
${G} find${N}   →   fd         極速檔案搜索
${G} grep${N}   →   rg         ripgrep 極速搜代碼
${G} du${N}     →   dust       視覺化磁碟用量
${G} ps${N}     →   procs      彩色進程列表
${G} top${N}    →   btm        bottom 系統監控
${G} curl${N}   →   curlie     高亮 curl 輸出
${G} man${N}    →   tldr       實用範例速查
${G} help${N}   →   tldr       同上
$D──────────────────────────────────────────────────$N
${C} 專屬命令${N}
$D──────────────────────────────────────────────────$N
${G} bt${N}     →   btop       重度系統監控
${G} cc${N}     →   claude     Claude Code CLI
${G} lg${N}     →   lazygit    終端 Git UI
${G} code${N}   →   GUI 編輯器 偏好偵測順序
${G} fa${N}     →   fzf alias  模糊搜索所有 alias
$D──────────────────────────────────────────────────$N
${D}提示：使用原始命令名時 you-should-use 插件會自動提醒${N}
${D}設定：pnpm run d:setup → 偏好設定（bat 主題 / 編輯器 / preset）${N}

EOF
}

# fa — fzf 模糊搜索所有 alias（選中後複製到剪貼簿）
fa() {
  if ! _command_exists fzf; then
    echo "fa: 需要 fzf（brew install fzf）"
    return 1
  fi
  local sel
  sel=$(alias | sed 's/=/ → /' | fzf --height=40% --border --prompt="alias> " --preview-window=hidden)
  if [[ -n "$sel" ]]; then
    local cmd="${sel%%=*}"
    echo "$cmd" | tr -d "'" | pbcopy 2>/dev/null
    echo "已複製：${cmd}"
  fi
}

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
