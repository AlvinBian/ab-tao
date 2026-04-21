# Chrome utilities — ab-tao 35-chrome.zsh

# 強制關閉 Chrome（修改設定前必須先執行）
chrome-kill() {
  if pgrep -x "Google Chrome" >/dev/null; then
    pkill -x "Google Chrome"
    echo "Chrome 已關閉" >&2
  else
    echo "Chrome 未在執行" >&2
  fi
}

# 重啟 Chrome
chrome-relaunch() {
  chrome-kill
  sleep 1
  open -a "Google Chrome"
}

# 顯示 Chrome 記憶體使用量
chrome-mem() {
  ps aux | awk '/Google Chrome/ && !/awk/ {
    name = $11; sum += $6
  }
  END {
    if (sum > 0)
      printf "Chrome 總用量：%.0f MB（%d process）\n", sum/1024, NR
    else
      print "Chrome 未在執行"
  }'
}

# 在 Chrome 開啟 URL
chrome-url() {
  open -a "Google Chrome" "${1:?需要提供 URL}"
}

# 無痕模式開啟 URL
chrome-incognito() {
  open -a "Google Chrome" --args --incognito "${1:-}"
}

# 用指定 profile 開啟 Chrome
chrome-profile() {
  open -a "Google Chrome" --args "--profile-directory=${1:-Default}"
}
