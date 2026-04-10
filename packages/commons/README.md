# @ab-tao/commons

AI 資源同步層 — 純資源池，負責同步、驗證、版本追蹤，供 `@ab-tao/dotfiles` 按需取用。

## 職責

不直接安裝到 `~/.claude/`，只負責管理外部 AI 資源的同步與驗證，提供 API 給 dotfiles。

```
scripts/      — 核心腳本
  index.mjs             — 公開 API 入口（re-export 所有模組）
  paths.mjs             — 資源路徑常數定義
  sync-sources.mjs      — 多來源同步引擎
  sync-manager.mjs      — 同步協調器（7 天 TTL 快取，setup 時呼叫）
  security-validator.mjs — 安全驗證（危險模式攔截 + SHA256）
  version-tracker.mjs   — 版本鎖定（.versions.json）
  tech-detection.mjs    — 技術棧偵測 / TECH_TO_LANG 映射
  resource-loader.mjs   — 運行時資源載入
  validate-structure.mjs — 資源結構驗證
resources/    — 同步下來的 AI 資源（按來源分目錄）
```

## AI 資源來源

| 來源                    | 說明                                                 |
| ----------------------- | ---------------------------------------------------- |
| **ecc**                 | Claude Code 社群資源（commands/agents/rules/skills） |
| **anthropic**           | Anthropic 官方 Skills                                |
| **superpowers**         | Claude Superpowers — 進階 agent 能力                 |
| **context-engineering** | Context Engineering Skills（context 優化/壓縮/評估） |

## 指令

```bash
pnpm run c:sync           # 列出來源與版本狀態
pnpm run c:sync:select    # 互動式選擇同步
pnpm run c:sync:all       # 同步全部來源
pnpm run c:validate       # 驗證資源結構 + 安全檢查

# 指定同步
pnpm run c:sync -- --pick ecc,superpowers
```

## 安全驗證

所有同步檔案通過多層驗證：危險模式攔截（eval/Function/sudo/rm-rf 等）、隱藏字元掃描、512KB 大小限制、SHA256 校驗和追蹤、原子替換（失敗自動回滾）。`.md` 文件採警告模式，可執行邏輯採錯誤模式。
