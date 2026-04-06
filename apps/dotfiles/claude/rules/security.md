---
name: security
description: >
  安全基線規範：輸入驗證、secrets 處理、錯誤訊息、依賴安全。
matchWhen:
  always: true
---

# Security

## 絕對禁止

- Secrets 用環境變數，`.env` 在 `.gitignore`
- 日誌不記密碼、token、信用卡；SQL 用參數化，不拼接
- Token 用 httpOnly cookie；所有外部輸入驗證型別、長度、格式

## 輸入驗證 & 授權

- API 入口驗證；檔案上傳驗證 MIME 與大小；Redirect URL 白名單
- 密碼用 bcrypt；認證檢查在 server 端；敏感操作要求重新驗證

## 錯誤處理

- 業務錯誤 → 4xx；外部失敗 → Retry + fallback；邏輯錯誤 → 500 + 日誌
- 禁止：空 `catch {}`；吞錯誤；忽略 Promise rejection

## 依賴安全

定期 `npm audit`；CVSS ≥ 7.0 漏洞 72h 內處理；鎖定版本提交 lock file
