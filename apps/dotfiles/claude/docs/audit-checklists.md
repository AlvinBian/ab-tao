# Audit Checklists

四種審查模式的完整檢查項。審查模式由 `11-audit-system.md` 定義。

---

## 【審查設定】Claude 偏好設定本身

結束標誌：「已完成設定全量審查，無更多問題。」

- [ ] 所有 `@import` 指向存在的檔案（無斷鏈）
- [ ] XML 標籤閉合完整，無孤立標籤
- [ ] `settings.json` 無 phantom plugin（enabled 但未安裝）
- [ ] `settings.json` hooks 區段所有 script 存在且有執行權限（hooks 由 settings.json 管理，源自 hooks/defs/*.json）
- [ ] `memory/MEMORY.md` ≤ 200 行 / 25KB
- [ ] `claude-md/` 13 個 section 檔全部存在（00–05, 08, 10–15；09 已併入 08，06→rules/vue-nuxt、07→hooks 已下放，16–18 已移 docs/）
- [ ] `rules/` 10 個條件規則檔有正確 `paths:` frontmatter（api-and-data / vue-nuxt / typescript / html-report / migrations / sql / barrel-exports / git-and-pr / reuse-and-decoupling / php-codeigniter）
- [ ] `rules/barrel-exports.md` 含 7 條 sub-rule（統一導出 3 + 統一引入 2 + 適用範圍 1 + 遷移策略 1）
- [ ] CLAUDE.md「參考資源」為指針文字非 @import（@ 是硬載入；2026-07 修正），4 個指針目標存在（rtk / audit-checklists / config-map / local-tools）；21 個 docs/ 檔完整清單見 config-map.md
- [ ] `~/.claude/.ab-tao/state.json` schema 合法（`c:validate --schema`）
- [ ] Slack 路由 sanity：`settings.json` `env.SLACK_NOTIFY_CHANNEL` 為 Channel ID（`C`開頭）或 `"dm"`
- [ ] 對外發送分級制（2026-07-16）：`claude-md/05` 外部通訊紅線含「結論性=草稿+[Y]／review 工作流產物=直發／唯一豁免=直接發送」三級表述；`claude-md/14` 含「對外通訊硬例外」段
- [ ] `commands/slack.md` A3/A3.5 為雙軌 lint（直發=standard markdown 雙星；手貼=mrkdwn 單星），與「零」節無矛盾；A4.3 無寫死 MCP 工具前綴
- [ ] `slack-principles.md` 含 8 節（語法紅線 / 結構骨架 / Icon 語義字典 / 強調規則 / Mention & URL & 長度 / Anti-patterns / 視覺節奏 / 場景 Icon 快查）
- [ ] `slack-principles.md` Icon 語義字典含 3 組（嚴重度 · 動作 · Audience 區塊）
- [ ] `slack-principles.md` 無殘留 T01~T15 模板（grep `T0[1-9]\|T1[0-5]` 應為 0）
- [ ] `slack-principles.md` 含 Anti-Patterns section
- [ ] `commands/slack.md` Step A2 含「強制」字樣（禁止條件性載入規範）
- [ ] `commands/slack.md` Step A1.5 為 audience-first 4 優先（顯式 → 推斷 → channel hint → ask）
- [ ] `commands/slack.md` Step A2.5 含 multi 模式區塊拼裝邏輯
- [ ] `commands/slack.md` Step A4.2 為 [d]/[m]/[c:]/[t:] 4 選一，無 [y] 預設
- [ ] `slack-audience-profiles.md` 含 7 個 profile（rd / pm / mkt / qa / ops / ued / multi），無 `exec`
- [ ] `slack-audience-profiles.md` 6 個實體 profile（rd/pm/mkt/qa/ops/ued）含 reader mental model + 決策原則 3 條上限；`multi` 為組合器（區塊化拼裝，無獨立 mental model）
- [ ] `slack-audience-profiles.md` 無「完全保留 / 壓縮為 1 句 / 完全移除」舊表格（grep 應為 0）
- [ ] 全 repo 無 `exec` audience 殘留（grep 應為 0）

---

## 【審查 UI】頁面 / 組件 / 設計稿

結束標誌：「已完成 UI 全量審查，無更多問題。」

### 效能
- [ ] LCP < 2.5s（首屏最大內容繪製）
- [ ] CLS < 0.1（累積版面位移）
- [ ] INP < 200ms（下一次繪製互動）
- [ ] 單一路由 JS bundle < 200KB（gzip）

### 圖片與資源
- [ ] 所有圖片含 `loading="lazy"`
- [ ] 提供 WebP 格式 + fallback
- [ ] 圖片使用絕對 URL（郵件模板）

### 兼容性
- [ ] 桌面：Chrome 最新兩版、Safari 16+、Firefox 最新版
- [ ] 移動端：iOS Safari 15+、Android Chrome 最新兩版

### SSR（Nuxt）
- [ ] 無 `window` / `document` 直接存取（應用 `import.meta.client`）
- [ ] 無 hydration mismatch（動態內容已用 `<ClientOnly>`）
- [ ] Cookie 操作走 `useCookie`

---

## 【審查代碼】邏輯與架構

結束標誌：「已完成代碼全量審查，無更多問題。」

### 型別安全
- [ ] 無 `any`（以 `unknown` + type guard 替代）
- [ ] 所有 public API 函式有明確型別標注
- [ ] Interface 定義完整，無隱式 `{}` 型別

### 錯誤處理
- [ ] 三態處理：loading / empty / error
- [ ] 非同步操作有 try/catch 或 .catch()
- [ ] 錯誤訊息不暴露系統內部細節

### 安全
- [ ] 無 `console.log` 輸出 token / userId / 敏感欄位
- [ ] 敏感操作有二次確認機制
- [ ] 環境變數不 hardcode

### API 規範
- [ ] 回傳格式統一（依專案實際契約；Node / Prisma 範本見 `rules/api-and-data.md`）
- [ ] 分頁策略一致（cursor 或 offset，依專案契約統一，勿混用）
- [ ] 無過時 API、無 demo 代碼

### 代碼品質
- [ ] 無 TODO / FIXME 未解決（或已建 task 追蹤）
- [ ] 無重複邏輯（DRY）
- [ ] 函式長度 ≤ 50 行（超出考慮拆分）

---

## 【審查 PR】堆疊 PR 提交前檢查

結束標誌：「已完成 PR 全量審查，無更多問題。」

### 標題與描述
- [ ] PR title 符合 `[TICKET][PROJECT] 主描述 - PR-N 子描述`
- [ ] PR description 列出依賴 `#PR-N` 與合併順序
- [ ] 含 DB migration 已標註（filename + 順序）

### Stack 狀態
- [ ] base branch 為上一支 PR 的 head（非 main，除 PR-1）
- [ ] `pr-stack sync` 已跑（無 outdated parent）
- [ ] 對應 `backup/<branch>` 已建（force push 前必備）

### 工具與安全
- [ ] 無 `gh pr merge` 批次合併指令（必須人工逐 PR）
- [ ] 無未經 backup 的 force push
- [ ] pre-push 測試通過（禁用 `--no-verify` 除 hotfix）
