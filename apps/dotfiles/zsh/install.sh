#!/usr/bin/env bash
# =============================================================================
# zsh/install.sh — zsh 模組 symlink 部署（v1.2.0）
#
# 職責：將 zsh/modules/*.zsh 以 symlink 方式部署到 ~/.zshrc.d/conf/
#       並在 ~/.zshrc 注入 ab-tao 結構（首次安裝）或補齊缺失項（升級）
#
# ~/.zshrc 結構（首次安裝時注入）：
#   typeset -U path               ← PATH 去重，必須最先
#   個人 PATH                     ← ~/bin、~/.local/bin、pnpm
#   個人偏好 AB_*                  ← d:setup 填入，使用者可見可改
#   # ab-tao:loader               ← 標記（防重複注入）
#   for _f in ~/.zshrc.d/conf/*.zsh(N); do source "$_f"; done; unset _f
#
# 策略：
#   - symlink 部署可重複執行（等冪）
#   - ~/.zshrc 只追加一次（marker 防重複）
#   - 升級時只補齊 typeset -U path，不重複注入 PATH
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
for f in "$MODULES_DIR"/*.zsh; do
  [[ -f "$f" ]] || continue
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
path=("$PNPM_HOME" $path)

# === 個人偏好（控制模組行為，優先於 .prefs.zsh 預設值）===
# AB_* 變數由 pnpm run d:setup 配置，可在此處覆蓋預設值

# === ab-tao:loader ===
for _f in ~/.zshrc.d/conf/*.zsh(N); do source "$_f"; done; unset _f
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
