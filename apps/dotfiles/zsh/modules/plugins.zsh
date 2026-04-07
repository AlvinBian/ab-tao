# ── zsh 插件 ──────────────────────────────────────────────────────
# 依賴：brew install zsh-autosuggestions zsh-fast-syntax-highlighting
#   （或 fallback: zsh-syntax-highlighting）

ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=8'
ZSH_AUTOSUGGEST_STRATEGY=(history completion)
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20  # 超過 20 字不建議（省 CPU）

# ── zsh-defer（延遲載入非關鍵插件，若有安裝）────────────────────
# brew install zsh-defer 或 git clone romkatv/zsh-defer
_ZSH_DEFER="${BREW_PREFIX}/share/zsh-defer/zsh-defer.plugin.zsh"
[[ ! -s "$_ZSH_DEFER" ]] && _ZSH_DEFER="$HOME/.zsh/plugins/zsh-defer/zsh-defer.plugin.zsh"

if [[ -s "$_ZSH_DEFER" ]]; then
  source "$_ZSH_DEFER"

  # autosuggestions — 延遲載入（不影響首次 prompt 顯示）
  zsh-defer _safe_source "${BREW_PREFIX}/share/zsh-autosuggestions/zsh-autosuggestions.zsh"

  # syntax-highlighting — 延遲載入（優先 fast-syntax-highlighting）
  _FSH="${BREW_PREFIX}/share/zsh-fast-syntax-highlighting/fast-syntax-highlighting.plugin.zsh"
  _SH="${BREW_PREFIX}/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
  if [[ -s "$_FSH" ]]; then
    zsh-defer source "$_FSH"
  elif [[ -s "$_SH" ]]; then
    zsh-defer source "$_SH"
  fi
  unset _FSH _SH
else
  # 無 zsh-defer 時同步載入（fallback）
  _safe_source "${BREW_PREFIX}/share/zsh-autosuggestions/zsh-autosuggestions.zsh"

  # 優先 fast-syntax-highlighting，fallback zsh-syntax-highlighting
  _FSH="${BREW_PREFIX}/share/zsh-fast-syntax-highlighting/fast-syntax-highlighting.plugin.zsh"
  _SH="${BREW_PREFIX}/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
  if [[ -s "$_FSH" ]]; then
    source "$_FSH"
  else
    _safe_source "$_SH"
  fi
  unset _FSH _SH
fi
unset _ZSH_DEFER

# ── Prompt（starship，若有安裝）──────────────────────────────────
if _command_exists starship && [[ $- == *i* ]]; then eval "$(starship init zsh)"; fi

# ── IDE shell integrations ────────────────────────────────────────
_safe_source "$HOME/.kiro/shell/zsh/init.zsh"
_safe_source "$HOME/.openclaw/init.zsh"
