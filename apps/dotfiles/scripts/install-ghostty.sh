#!/usr/bin/env bash
# =============================================================================
# scripts/install-ghostty.sh
# Ghostty 設定安裝
#
# 用法：bash scripts/install-ghostty.sh [--force]
# 安裝目標：~/.config/ghostty/config
# =============================================================================
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_DIR/ghostty/config"
DEST_DIR="$HOME/.config/ghostty"
DEST="$DEST_DIR/config"
FORCE=false

[[ "$1" == "--force" ]] && FORCE=true

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; DIM='\033[2m'; NC='\033[0m'

# 確認 Ghostty 已安裝
if ! command -v ghostty &>/dev/null && [[ ! -d "/Applications/Ghostty.app" ]]; then
  echo -e "${YELLOW}⚠ 未偵測到 Ghostty，可至 https://ghostty.org 下載${NC}"
  echo "繼續安裝設定檔..."
fi

# 安裝 Catppuccin Mocha 主題（如已安裝 Ghostty）
if command -v ghostty &>/dev/null || [[ -d "/Applications/Ghostty.app" ]]; then
  THEME_DIR="$HOME/.config/ghostty/themes"
  if [[ ! -f "$THEME_DIR/catppuccin-mocha" ]]; then
    mkdir -p "$THEME_DIR"
    # 使用 Ghostty 內建 Catppuccin 主題（v1.0+ 已內建，無需手動安裝）
    echo -e "${DIM}  ─ Catppuccin Mocha 主題為 Ghostty 內建主題${NC}"
  fi
fi

# 安裝 MesloLGS Nerd Font（如未安裝）
if ! fc-list 2>/dev/null | grep -qi "MesloLGS" && \
   ! ls ~/Library/Fonts/MesloLGS* 2>/dev/null | grep -q .; then
  echo -e "${YELLOW}⚠ 未偵測到 MesloLGS Nerd Font${NC}"
  echo "  安裝字體：brew install font-meslo-lg-nerd-font"
  if command -v brew &>/dev/null; then
    read -r -p "  立即安裝？[y/N] " yn
    [[ "${yn,,}" == "y" ]] && brew install font-meslo-lg-nerd-font
  fi
fi

# 安裝設定檔
mkdir -p "$DEST_DIR"

if [[ -f "$DEST" && "$FORCE" != true ]]; then
  if diff -q "$SRC" "$DEST" &>/dev/null; then
    echo -e "${DIM}  ─ ghostty/config 無變更${NC}"
  else
    echo -e "${YELLOW}  ⚠ ~/.config/ghostty/config 已存在，略過（使用 --force 覆蓋）${NC}"
  fi
else
  [[ -f "$DEST" ]] && cp "$DEST" "${DEST}.bak"
  cp "$SRC" "$DEST"
  [[ "$FORCE" == true ]] \
    && echo -e "${GREEN}  ✅ ghostty/config 已安裝 [--force 覆蓋]${NC}" \
    || echo -e "${GREEN}  ✅ ghostty/config 已安裝 → $DEST${NC}"
fi
