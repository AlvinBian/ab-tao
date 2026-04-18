# Audit Checklists

三種審查模式的完整檢查項。審查模式由 `11-audit-system.md` 定義。

---

## 【審查設定】Claude 偏好設定本身

結束標誌：「已完成設定全量審查，無更多問題。」

- [ ] 所有 `@import` 指向存在的檔案（無斷鏈）
- [ ] XML 標籤閉合完整，無孤立標籤
- [ ] `settings.json` 無 phantom plugin（enabled 但未安裝）
- [ ] `hooks.json` 所有 script 存在且有執行權限
- [ ] `memory/MEMORY.md` ≤ 200 行 / 25KB
- [ ] `claude-md/` 14 個 section 檔全部存在
- [ ] `rules/` 5 個條件規則檔有正確 `paths:` frontmatter
- [ ] `docs/` 3 個參考文件存在
- [ ] `~/.claude/.ab-tao/state.json` schema 合法（`c:validate --schema`）

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
- [ ] 回傳格式統一 `{ code, message, data }`
- [ ] 分頁使用 cursor-based（非 offset）
- [ ] 無過時 API、無 demo 代碼

### 代碼品質
- [ ] 無 TODO / FIXME 未解決（或已建 task 追蹤）
- [ ] 無重複邏輯（DRY）
- [ ] 函式長度 ≤ 50 行（超出考慮拆分）
