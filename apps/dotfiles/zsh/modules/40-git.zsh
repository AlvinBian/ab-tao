# ── Git 增強 ──────────────────────────────────────────────────────

_command_exists lazygit && (( ! ${+aliases[lg]} )) && alias lg='lazygit'

# Stacked PR dispatcher — 偵測 gh-stack 優先，退回 git-spice
pr-stack() {
  if command -v gh-stack >/dev/null 2>&1; then
    [[ -z "$_PR_STACK_BANNER" ]] && {
      echo "→ 使用 gh-stack（GitHub 內部工具）" >&2
      export _PR_STACK_BANNER=1
    }
    gh-stack "$@"
  elif command -v gs >/dev/null 2>&1; then
    [[ -z "$_PR_STACK_BANNER" ]] && {
      echo "→ 使用 git-spice（gs）" >&2
      export _PR_STACK_BANNER=1
    }
    gs "$@"
  else
    echo "✗ 未安裝堆疊 PR 工具。請執行：" >&2
    echo "  brew install abhinav/tap/git-spice  # 推薦（OSS）" >&2
    echo "  或申請 gh-stack 組織授權後安裝" >&2
    return 127
  fi
}

pr-stack-reset() { unset _PR_STACK_BANNER; }

# 建立新 PR-N leaf 分支（在當前 trunk 上）
pr-stack-init() {
  command -v gh-stack >/dev/null 2>&1 || command -v gs >/dev/null 2>&1 || {
    echo "[pr-stack] 未安裝堆疊 PR 工具，請先 brew install abhinav/tap/git-spice" >&2
    return 127
  }
  pr-stack branch create "$@"
}

# 上游 PR 變更後同步下游 stack（cascade restack，draft push 跳測試）
pr-stack-sync() {
  command -v gh-stack >/dev/null 2>&1 || command -v gs >/dev/null 2>&1 || {
    echo "[pr-stack] 未安裝堆疊 PR 工具，請先 brew install abhinav/tap/git-spice" >&2
    return 127
  }
  pr-stack stack restack --push-args="-o stack-draft=1" "$@"
}

# 將 stack 推上線（移除 draft，仍需人工逐 PR 點擊 merge）
pr-stack-land() {
  command -v gh-stack >/dev/null 2>&1 || command -v gs >/dev/null 2>&1 || {
    echo "[pr-stack] 未安裝堆疊 PR 工具，請先 brew install abhinav/tap/git-spice" >&2
    return 127
  }
  pr-stack stack submit --no-draft "$@"
}
