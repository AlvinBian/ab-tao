---
name: deploy-plan
description: >
  產生部署計劃：rollout 策略 + rollback 路徑 + feature flag 模板 + staged rollout 檢查表。
  關鍵字觸發：「部署計劃」「deploy plan」「上線計劃」「rollout」「rollback 策略」
tools: Read, Grep, Glob
---

# Deploy Plan Skill

## 觸發時機

使用者需要部署計劃、rollout 策略、rollback 方案、feature flag 設定或 staged rollout 檢查表時。

## 輸出模板

### 1. 部署摘要

```markdown
## 部署計劃：[功能/版本名稱]

> 日期：[YYYY-MM-DD]
> 負責人：[name]
> 票號：[TICKET]（若有）
```

### 2. Rollout 策略

選擇適合的策略：

| 策略 | 適用場景 | 風險 |
|---|---|---|
| **Feature Flag** | 需要快速 kill switch | 低（可瞬間關閉）|
| **Canary（5% → 20% → 100%）** | 有流量的功能 | 中（需監控指標）|
| **Blue-Green** | 需要零停機切換 | 中（需雙環境）|
| **Rolling** | 無狀態服務水平擴展 | 低（逐步替換）|

**本次策略**：[選擇並說明原因]

### 3. Feature Flag 模板（若適用）

```typescript
// 環境變數控制（.env.production）
FEATURE_[FEATURE_NAME]_ENABLED=false

// 程式碼中的 guard
if (process.env.FEATURE_[FEATURE_NAME]_ENABLED === 'true') {
  // 新功能
} else {
  // 舊行為 / fallback
}
```

**開關流程**：
1. 部署後 feature flag 預設 `false`（關閉）
2. 在 staging 驗證 → 開 staging flag
3. 觀察 5 分鐘 → 開 canary 5%
4. 觀察 30 分鐘 → 分批開至 100%
5. 穩定後移除 flag（下一個 sprint）

### 4. Staged Rollout 檢查表

#### 部署前（Pre-deploy）
- [ ] DB migration 已 dry-run 驗證（若有）
- [ ] 環境變數已更新（staging → production）
- [ ] Feature flag 預設值確認（新功能預設關閉）
- [ ] rollback 腳本已測試
- [ ] 告知 oncall / QA

#### 部署中（Deploy）
- [ ] staging 部署成功
- [ ] staging smoke test 通過
- [ ] production 部署啟動
- [ ] 監控 dashboard 開著（golden signals）

#### 部署後 5 分鐘（Post-deploy gate 1）
- [ ] Error rate < 基線 + 1%
- [ ] P95 latency < 基線 × 1.5
- [ ] 關鍵 API 回傳 2xx 正常

#### 部署後 30 分鐘（Post-deploy gate 2）
- [ ] 上述指標持續穩定
- [ ] 無新的 Sentry error
- [ ] 業務指標正常（轉換率 / 成單率）

### 5. Rollback 路徑

**快速 rollback（< 5 分鐘）**：
```bash
# 若有 feature flag：直接關閉
[設定 FEATURE_XX_ENABLED=false 的具體步驟]

# 若無 feature flag：回退部署
[git revert / 重新部署上一版本的具體指令]
```

**DB rollback（若有 migration）**：
```bash
# 回滾 migration
[具體指令]
# 注意：有 down migration 才能執行；若無，需手動 SQL
```

**Rollback 觸發條件**（任一即立即回退）：
- Error rate > 基線 + 5%
- P95 latency > 基線 × 3
- 任何 500 error 超過 10 次/分
- 業務指標異常下滑 > 20%

### 6. 通知模板

**部署開始**：
```
🚀 [功能名稱] 開始部署至 production
負責人：@[name]
預計完成：[時間]
監控：[dashboard 連結]
```

**部署完成**：
```
✅ [功能名稱] 部署完成
版本：[commit sha 前 8 碼]
觀察期：30 分鐘
問題回報：[Slack channel / oncall]
```

## 注意事項

- 每次部署都必須有明確的 rollback 路徑，沒有 rollback 方案不應部署
- Feature flag 是最快的 rollback，有條件都應使用
- 涉及 DB schema 變更時，必須確認 migration 可逆（有 down 方法）
