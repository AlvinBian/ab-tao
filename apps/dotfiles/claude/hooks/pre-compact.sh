#!/bin/bash
# pre-compact.sh — PreCompact 定向壓縮指令注入

# 通知使用者壓縮即將發生
command -v osascript &>/dev/null && \
  osascript -e 'on run argv' \
    -e '  display notification (item 1 of argv) with title "Claude Code" subtitle "⚠️ 壓縮中"' \
    -e 'end run' -- "Context 即將壓縮，重要資訊保留中" 2>/dev/null &

# 輸出壓縮優先序指令（stdout 注入至壓縮 context）
cat <<'EOF'
在壓縮 context 時請遵守以下優先序：

保留（高優先）：
- 核心需求、硬性約束、API 介面定義
- XML 標籤內所有內容（<identity>、<task>、<constraints> 等）
- 當前任務狀態（進行中的步驟、已確認的決策）
- 最近 3 輪有效工具輸出

可捨棄（低優先）：
- 調試輸出、失敗嘗試、已解決的中間問題
- 超過 3 輪以前的工具輸出摘要
- 重複說明同一概念的冗餘段落
EOF

exit 0
