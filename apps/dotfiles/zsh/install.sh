#!/usr/bin/env bash
# =============================================================================
# zsh/install.sh — zsh 模組 symlink 部署（v1.1.0 簡化版）
#
# 職責：將 zsh/modules/*.zsh 以 symlink 方式部署到 ~/.zshrc.d/
#
# 策略：
#   - 絕不 regenerate，絕不用 heredoc 寫 conf 內容
#   - 使用 ln -sf 建立 symlink（可重複執行，等冪）
#   - ~/.zshrc 只需要一行 loader：
#       for _f in ~/.zshrc.d/*.zsh(N); do source "$_f"; done; unset _f
#
# 用法：
#   bash zsh/install.sh          ← 部署所有模組
# =============================================================================
set -e

MODULES_DIR="$(dirname "$0")/modules"
DEST_DIR="$HOME/.zshrc.d"

# 確保目標目錄存在
mkdir -p "$DEST_DIR"

# 部署模組（symlink）
for f in "$MODULES_DIR"/*.zsh; do
  [[ -f "$f" ]] || continue
  ln -sf "$f" "$DEST_DIR/"
  echo "  → $(basename "$f")"
done

# 追加 loader（標記檢測，防重複）
LOADER_MARKER="# ab-tao:loader"
if ! grep -qF "$LOADER_MARKER" ~/.zshrc 2>/dev/null; then
  printf '\n%s\n%s\n' "$LOADER_MARKER" \
    'for _f in ~/.zshrc.d/*.zsh(N); do source "$_f"; done; unset _f' \
    >> ~/.zshrc
  echo "  → loader 已追加至 ~/.zshrc"
else
  echo "  → loader 已存在，略過"
fi

echo ""
echo "✅ zsh 模組已部署至 ~/.zshrc.d/"
echo "   執行 exec zsh 立即套用"
