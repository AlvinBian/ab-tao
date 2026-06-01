---
"@ab-tao/dotfiles": minor
---

feat: d:setup 交易化安裝 — 快照+全量回滾防配置失效

新增 `libs/install/transaction.mjs` 交易模組，讓 d:setup 在任何 mutation 前先快照
mutable roots（~/.claude 配置目錄、zsh 模組、settings.json 等），全部成功才 commit，
中途 crash 或取消則自動還原至安裝前狀態。

**核心改動**

- `transaction.mjs`：`beginTransaction / commitTransaction / rollbackTransaction` 狀態包裝 +
  `snapshotTargets / restoreFromSnapshot / removeCreated` 純函式（可注入 targets 供測試）
- `backup.mjs` `cpDir`：新增 `opts.skipNames`（`Set<string>`），命中 basename 整支 subtree 跳過；
  解決 `sheldon/repos/**/.git/objects` 數千小檔觸發 macOS `ETIMEDOUT` 的問題
- `DEFAULT_TARGETS`：`~/.zshrc.d` 由整 dir 改為 per-file（`conf/` + `.prefs.zsh` + `sheldon/plugins.toml`），
  sheldon repos git cache 完全排除於快照範圍
- `setup.mjs`：`beginTransaction()` 包 `withSpinner`，消除 UI hang；8 個接線點覆蓋
  crash / 取消 / 核心缺檔詢問 / commit 全路徑
- 17 個單元測試（含 skipNames、per-file zshrc.d、best-effort rollback）
