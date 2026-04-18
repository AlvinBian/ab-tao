# RTK 工具說明

RTK（Read-Truncate-Kill）是 bash 輸出壓縮工具，可將 token 消耗降低 ~89%。

## 安裝

```bash
brew install rtk
```

## Claude Code 整合

ab-tao 的 `hooks/` 在 `PreToolUse (Bash)` 事件自動對長輸出套用 RTK 壓縮。
初始部署由 `d:setup` 配置；可透過 `d:hooks` 管理開關。

## 手動使用

```bash
git log --oneline -20 | rtk
npm test 2>&1 | rtk
cat large-file.json | rtk
```

## Token 預算影響

| 情境 | 不使用 RTK | 使用 RTK | 節省 |
|---|---|---|---|
| `git log` 20 條 | ~2,000 tokens | ~220 tokens | -89% |
| `npm test` 輸出 | ~3,000 tokens | ~330 tokens | -89% |

## 注意事項

- RTK 壓縮為有損壓縮，適合命令輸出；不適合需要完整內容的檔案讀取
- 若需查看完整輸出，直接使用命令不經 hook，或臨時 disable hook
