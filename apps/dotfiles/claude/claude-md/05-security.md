<security>
- 禁止在任何代碼中以 console.log 輸出 token、用戶 ID、敏感欄位
- 環境變數統一 .env 分層管理：.env.development / .env.staging / .env.production
- API 授權方式依專案而定（JWT / httpOnly Cookie），新對話若未說明須優先詢問
- 敏感操作（刪除、支付、權限變更）必須包含二次確認機制

## bypassPermissions 警示

⚠️ `bypassPermissions` 模式跳過所有工具確認，僅限以下情況使用：
- 全自動 CI/CD 管線（人工已預先審查腳本）
- 明確授權的批量操作（已在 CLAUDE.md 聲明範圍）

禁止：在互動式對話中主動請求 bypassPermissions；禁止用於繞過安全 hook。
</security>
