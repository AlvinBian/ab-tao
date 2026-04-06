#!/bin/bash
# 過濾 test/build/lint 的大量輸出，只保留錯誤行，減少 token 消耗
# 讀取工具輸入 JSON，檢測是否為 test/build/lint 命令
# 如果是，修改命令以過濾輸出；否則保持原樣

# jq 未安裝時直接跳過，不阻塞 Claude
if ! command -v jq &>/dev/null; then
  cat > /dev/null
  exit 0
fi

# RTK 已安裝時跳過（RTK 提供更完整的 100+ 命令輸出壓縮）
if command -v rtk &>/dev/null; then
  cat > /dev/null
  exit 0
fi

input=$(cat)
cmd=$(echo "$input" | jq -r '.command // empty' 2>/dev/null)

# 空命令直接返回空
[ -z "$cmd" ] && exit 0

# 偵測是否為測試命令 (npm test, pnpm test, vitest, jest, pytest, go test, bun test)
if echo "$cmd" | grep -qiE '(npm|pnpm|npx|bun).*(test|vitest|jest)|pytest|go\s+test'; then
  # 測試命令：只保留錯誤行，限制為 100 行
  filtered_cmd="$cmd 2>&1 | grep -A 5 -E '(FAIL|ERROR|error:|FAILED|✗|✘|×|Test Suites|failed)' | head -100"
  # 輸出修改後的命令
  echo "$input" | jq --arg new_cmd "$filtered_cmd" '.command = $new_cmd'
  exit 0

# 偵測是否為構建和 lint 命令 (npm/pnpm run build/lint)
elif echo "$cmd" | grep -qiE '(npm|pnpm|npm\s+run|pnpm\s+run).*(build|lint)'; then
  # 構建和 lint 命令：只保留最後 50 行
  filtered_cmd="$cmd 2>&1 | tail -50"
  # 輸出修改後的命令
  echo "$input" | jq --arg new_cmd "$filtered_cmd" '.command = $new_cmd'
  exit 0

else
  # 其他命令，原樣輸出
  echo "$input"
  exit 0
fi
