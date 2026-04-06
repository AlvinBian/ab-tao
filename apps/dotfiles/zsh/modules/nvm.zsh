# ── Node 版本管理（動態偵測 nvm / n）────────────────────────────
#  優先順序：nvm（lazy loading） > n（brew 或手動安裝）

# ── nvm ───────────────────────────────────────────────────────────
if [[ -d "$HOME/.nvm" ]]; then
  export NVM_DIR="$HOME/.nvm"

  # 找到最新已安裝的 node 版本，直接加入 PATH（不需初始化 nvm，零開銷）
  _NVM_DEFAULT_DIR="$NVM_DIR/alias/default"
  if [[ -s "$_NVM_DEFAULT_DIR" ]]; then
    # 有 default alias → 解析版本號
    _NVM_DEFAULT_VER=$(cat "$_NVM_DEFAULT_DIR" | tr -d '[:space:]')
  fi
  # 找到實際的 node 二進制路徑（用 glob 遍歷替代 sort -V，省 200ms）
  _NVM_NODE_DIR=""
  if [[ -n "$_NVM_DEFAULT_VER" ]]; then
    # 嘗試精確匹配 default alias
    for _d in "$NVM_DIR/versions/node/v${_NVM_DEFAULT_VER}"*(N); do
      [[ -d "$_d/bin" ]] && _NVM_NODE_DIR="$_d"
    done
  fi
  if [[ -z "$_NVM_NODE_DIR" ]]; then
    # 沒有 default → 取最新已安裝版本（glob 自動按字母排序，最後一個即最新）
    for _d in "$NVM_DIR/versions/node"/v*(N); do
      [[ -d "$_d/bin" ]] && _NVM_NODE_DIR="$_d"
    done
  fi
  unset _d
  if [[ -n "$_NVM_NODE_DIR" && -d "$_NVM_NODE_DIR/bin" ]]; then
    # 直接加 PATH，不需要 source nvm.sh（省 ~1s）
    [[ ":$PATH:" != *":$_NVM_NODE_DIR/bin:"* ]] && export PATH="$_NVM_NODE_DIR/bin:$PATH"

    # 沒有 default alias → 自動設最新版為 default（異步，不阻塞啟動）
    if [[ ! -s "$_NVM_DEFAULT_DIR" ]]; then
      _NVM_VER_NAME=$(basename "$_NVM_NODE_DIR")  # v22.14.0
      {
        source "$NVM_DIR/nvm.sh" --no-use 2>/dev/null
        nvm alias default "${_NVM_VER_NAME#v}" 2>/dev/null
      } &!
    fi
  else
    # 完全沒有 node → 異步安裝最新 LTS（不阻塞啟動）
    {
      source "$NVM_DIR/nvm.sh" 2>/dev/null
      nvm install --lts 2>/dev/null
      nvm alias default lts/* 2>/dev/null
    } &!
  fi
  unset _NVM_DEFAULT_DIR _NVM_DEFAULT_VER _NVM_NODE_DIR _NVM_VER_NAME

  _nvm_lazy_load() {
    unset -f nvm 2>/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" --no-use
    [ -s "$NVM_DIR/bash_completion" ] && source "$NVM_DIR/bash_completion"
  }

  # nvm 命令本身才需要完整初始化（切版本、安裝等）
  nvm() { _nvm_lazy_load; nvm "$@"; }

  _auto_nvm_use() {
    # 有 .nvmrc/.node-version 時才初始化 nvm 並切換版本
    if [[ -f .nvmrc || -f .node-version ]]; then
      _nvm_lazy_load
      nvm use --silent 2>/dev/null || nvm install --silent
    fi
  }

  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_nvm_use
  _auto_nvm_use

# ── n ─────────────────────────────────────────────────────────────
elif command -v n &>/dev/null || [[ -d "$HOME/n" ]]; then
  # 手動安裝（~/n）vs brew 安裝（PATH 已由 brew 設好，無需額外 N_PREFIX）
  if [[ -d "$HOME/n" ]]; then
    export N_PREFIX="$HOME/n"
    [[ ":$PATH:" != *":$N_PREFIX/bin:"* ]] && export PATH="$N_PREFIX/bin:$PATH"
  fi

  _auto_n_use() {
    local version_file=""
    [[ -f .node-version ]] && version_file=".node-version"
    [[ -f .nvmrc ]]        && version_file=".nvmrc"
    if [[ -n "$version_file" ]]; then
      local ver; ver=$(cat "$version_file" | tr -d '[:space:]')
      n "$ver" --quiet 2>/dev/null || true
    fi
  }

  autoload -U add-zsh-hook
  add-zsh-hook chpwd _auto_n_use
  _auto_n_use
fi
