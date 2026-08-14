# @ab-tao/share

## 1.0.1

### Patch Changes

- a7aaaac: 修復測試基建：node:test runner 對齊 + 孤兒測試納入執行

  - dotfiles/commons/share 的 `__tests__` 由誤用 `import from 'vitest'`（未宣告依賴 → `ERR_MODULE_NOT_FOUND`，整套件 0 執行）改為零依賴 `node:test`，對齊 `rules/testing.md`「CLI/工具庫採 node:test」。
  - `eslint.config.js`：為這三套件 `__tests__` 關閉 antfu 預設 `test/no-import-node-test`（該規則強制 vitest import，與 node:test runner 自相矛盾；`apps/console` 仍走 vitest 不在範圍）。
  - `rules-whitelist.test.mjs`：預期規則數 8 → 9（補 `php-codeigniter`，v1.10.6 已新增但測試漏更新）。
  - dotfiles test glob 擴至 `libs/*/__tests__/*.test.mjs`，納入先前未被 `node --test` 執行的 6 個孤兒測試（`transaction.test.mjs` 的 `beforeAll`/`afterAll` → node:test 的 `before`/`after`）。
  - 結果：dotfiles 113 → 163、commons 36、share 3 全數通過；lint 0 error。
