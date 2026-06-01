#!/usr/bin/env bash
# =============================================================================
# zsh/install.sh — zsh 模組 symlink 部署（v1.3.0）
#
# 職責：將 zsh/modules/*.zsh 以 symlink 方式部署到 ~/.zshrc.d/conf/
#       並在 ~/.zshrc 注入 ab-tao 結構（首次安裝）或補齊缺失項（升級）
#
# 模組清單（zsh/modules/）：
#   00-env / 05-options / 10-history / 20-keys / 30-aliases /
#   35-chrome / 40-git / 50-claude / 50-functions / 60-tools /
#   90-plugins  （共 11 個，sheldon 插件管理另見 .zshrc.d/sheldon/）
#
# ~/.zshrc 結構（首次安裝時注入）：
#   typeset -U path               ← PATH 去重，必須最先
#   個人 PATH                     ← ~/bin、~/.local/bin、pnpm
#   個人偏好 AB_*                  ← d:setup 填入，使用者可見可改
#   # ab-tao:loader               ← 標記（防重複注入）
#   for _f in ~/.zshrc.d/conf/*.zsh(N); do source "$_f"; done; unset _f
#   [[ -f ~/.zshrc.local ]] && source ~/.zshrc.local  ← 本機專屬（不受管控）
#
# 策略：
#   - symlink 部署可重複執行（等冪）
#   - ~/.zshrc 只追加一次（marker 防重複）
#   - 升級時只補齊 typeset -U path，不重複注入 PATH
#   - 本機專屬設定請寫入 ~/.zshrc.local（不在 repo 內，不會被覆蓋）
#
# 用法：
#   bash zsh/install.sh          ← 部署所有模組
# =============================================================================
set -e

MODULES_DIR="$(cd "$(dirname "$0")" && pwd)/modules"
DEST_DIR="$HOME/.zshrc.d/conf"

# 確保目標目錄存在
mkdir -p "$DEST_DIR"

# 部署模組（symlink）
# 先清除舊版架構遺留的非 symlink 檔案或 " N.zsh" 重複 symlink，確保等冪
for f in "$MODULES_DIR"/*.zsh; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f" .zsh)"
  # 移除 "<name> N.zsh" 重複 symlink（空格 + 數字命名，由舊版 ln 行為產生）
  find "$DEST_DIR" -maxdepth 1 -name "${base} [0-9].zsh" -delete 2>/dev/null || true
  # 若目標為非 symlink 的實體檔案（舊版複製遺留），先刪再建
  if [[ -e "$DEST_DIR/$(basename "$f")" && ! -L "$DEST_DIR/$(basename "$f")" ]]; then
    rm -f "$DEST_DIR/$(basename "$f")"
  fi
  ln -sf "$f" "$DEST_DIR/"
  echo "  → $(basename "$f")"
done

# ── ~/.zshrc 結構注入 ──────────────────────────────────────────────
LOADER_MARKER="ab-tao:loader"
LOADER_LINE='for _f in ~/.zshrc.d/conf/*.zsh(N); do source "$_f"; done; unset _f'

if ! grep -qF "$LOADER_MARKER" ~/.zshrc 2>/dev/null; then
  # 首次安裝 — 注入完整結構
  cat >> ~/.zshrc << 'ZSHRC_BLOCK'

# PATH 去重（必須最先，確保後續所有追加自動去重）
typeset -U path

# === 個人 PATH ===
[[ -d "$HOME/bin" ]]        && path=("$HOME/bin"        $path)
[[ -d "$HOME/.local/bin" ]] && path=("$HOME/.local/bin" $path)
export PNPM_HOME="$HOME/Library/pnpm"
path=("$PNPM_HOME" "$PNPM_HOME/bin" $path)

# === 個人偏好（控制模組行為，優先於 .prefs.zsh 預設值）===
# AB_* 變數由 pnpm run d:setup 配置，可在此處覆蓋預設值

# === ab-tao:loader ===
for _f in ~/.zshrc.d/conf/*.zsh(N); do source "$_f"; done; unset _f
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local
ZSHRC_BLOCK
  echo "  → 已注入結構至 ~/.zshrc（typeset-U + PATH + loader）"
else
  echo "  → loader 已存在，略過注入"

  # 升級路徑 — 補齊 typeset -U path（若缺失）
  if ! grep -qF "typeset -U path" ~/.zshrc 2>/dev/null; then
    python3 - ~/.zshrc "$LOADER_MARKER" << 'PY'
import sys
content = open(sys.argv[1]).read()
marker = sys.argv[2]
insert = '\n# PATH 去重（必須最先）\ntypeset -U path\n\n'
content = content.replace(marker, insert + marker, 1)
open(sys.argv[1], 'w').write(content)
PY
    echo "  → 已補充 typeset -U path 至 loader 前"
  fi
fi

echo ""
echo "✅ zsh 模組已部署至 ~/.zshrc.d/conf/"
echo "   執行 exec zsh 立即套用"
