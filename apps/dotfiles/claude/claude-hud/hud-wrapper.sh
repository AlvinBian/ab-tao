#!/usr/bin/env bash
# hud-wrapper.sh — 以 claude-hud plugin 為主體、尾接工具版本段
# plugin: https://github.com/jarrodwatts/claude-hud

set -u

# 設定 COLUMNS 防止 stty 在非互動環境截斷輸出
cols=$(stty size </dev/tty 2>/dev/null | awk '{print $2}')
export COLUMNS=$(( ${cols:-120} > 4 ? ${cols:-120} - 4 : 1 ))

# 動態解析 node 路徑：優先 PATH，fnm/nvm/volta fallback
NODE="$(command -v node 2>/dev/null || true)"
if [[ -z "$NODE" ]]; then
  for _candidate in \
    "$HOME/.local/share/fnm/aliases/default/bin/node" \
    "$HOME/.fnm/aliases/default/bin/node" \
    "$NVM_DIR/versions/node/$(cat "$NVM_DIR/alias/default" 2>/dev/null)/bin/node" \
    "$VOLTA_HOME/bin/node"
  do
    [[ -x "$_candidate" ]] && { NODE="$_candidate"; break; }
  done
fi
if [[ -z "$NODE" ]]; then
  # node 完全找不到 → 靜默退出，Claude Code 顯示 fallback
  exit 0
fi

# 找最新版本的 claude-hud plugin 安裝目錄（glob，跨版本 forward-compatible）
PLUGIN_DIR=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/*/claude-hud/*/ 2>/dev/null \
  | awk -F/ '{ print $(NF-1) "\t" $(0) }' \
  | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\t' \
  | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n \
  | tail -1 | cut -f2-)

if [[ -z "$PLUGIN_DIR" ]]; then
  # plugin 尚未安裝（等待 Claude Code 重啟拉取）→ 靜默退出
  exit 0
fi

# 工具版本快取（5 分鐘 TTL），避免每次 statusline 重跑慢指令
CACHE="/tmp/.hud-runtimes"
cache_age=$(( $(date +%s) - $(stat -f %m "$CACHE" 2>/dev/null || echo 0) ))
if [[ ! -f "$CACHE" ]] || (( cache_age > 300 )); then
  {
    node_ver=$(node -v 2>/dev/null)
    pnpm_ver=$(pnpm -v 2>/dev/null)
    py_ver=$(python3 --version 2>/dev/null | awk '{print $2}')

    seg() {
      local ver="$1" label="$2" color="$3"
      [[ -n "$ver" ]] && printf '\033[2m%s\033[0m\033[1m%s\033[0m\033[%sm %s\033[0m' " | " "$label" "$color" "$ver"
    }

    printf '%s' "$(
      seg "$node_ver" "🔰" "38;5;64"
      seg "$pnpm_ver" "📦" "38;5;214"
      seg "$py_ver"   "🐍" "38;5;68"
    )"
  } > "$CACHE" 2>/dev/null
fi

INPUT=$(cat)
HUD=$(printf '%s' "$INPUT" | "$NODE" "${PLUGIN_DIR}dist/index.js" 2>/dev/null)
VERSIONS=$(cat "$CACHE" 2>/dev/null)

# 版本段接在第 1 行尾，其餘 HUD 行原樣輸出
printf '%s%s\n' "$(printf '%s\n' "$HUD" | head -n 1)" "$VERSIONS"
printf '%s\n' "$HUD" | tail -n +2
