---
name: observe
description: >
  定義 SLO、dashboard spec、alert 規則，涵蓋 golden signal 4 維（latency / traffic / errors / saturation）。
  關鍵字觸發：「SLO」「監控」「observability」「alert」「dashboard」「golden signal」「上線後觀察」
tools: Read, Grep, Glob
---

# Observe Skill

## 觸發時機

功能上線後需要定義觀測標準、設定 alert、或建立 dashboard spec 時。

## Golden Signal 4 維框架

### L — Latency（延遲）
服務回應時間，區分成功與失敗的延遲。

**標準指標**：
- P50（中位數延遲）
- P95（95th percentile，代表大多數使用者體驗）
- P99（最慢 1%，用於找長尾問題）

**建議 SLO 起點**：
```
P95 API latency < 500ms（CRUD 操作）
P95 API latency < 2000ms（複雜查詢 / 報表）
P95 頁面載入 < 3000ms（LCP）
```

### T — Traffic（流量）
服務接收的請求量，作為系統負載基線。

**標準指標**：
- RPS（Requests Per Second）
- DAU / MAU（業務層）
- 特定關鍵路徑的 event count

### E — Errors（錯誤率）
失敗請求的比例。

**標準指標**：
```
Error rate = (5xx count) / (total requests) × 100%
```

**建議 SLO 起點**：
```
Error rate < 0.1%（P2 功能）
Error rate < 0.5%（P3 功能）
```

### S — Saturation（飽和度）
系統資源使用率，預測何時會撐不住。

**標準指標**：
- CPU 使用率 < 70%（alert threshold）
- Memory 使用率 < 80%
- DB connection pool 使用率 < 80%
- Queue 積壓長度（若有）

## SLO 定義模板

```markdown
## SLO：[功能/服務名稱]

> 生效日期：[YYYY-MM-DD]
> 負責人：[name]
> 審核週期：每季

### Availability（可用性）
- 目標：99.5%（每月 < 3.6 小時 downtime）
- 測量：成功回應（非 5xx）/ 總請求

### Latency
- P95 < [X]ms（API endpoint: [path]）
- P99 < [Y]ms

### Error Rate
- < [Z]%（5xx errors / total requests）

### 觀測期
- 上線後前 24 小時：每 5 分鐘確認一次
- 第 2-7 天：每天 check dashboard
- 7 天後：納入常規監控週期

### SLO 違反處理
1. 自動 alert → oncall 收到
2. Oncall 15 分鐘內確認
3. 超過 30 分鐘未解決 → 啟動 rollback
```

## Alert 規則模板

```yaml
# 嚴重（立即處理，PagerDuty）
- name: high_error_rate
  condition: error_rate > 5% for 5 minutes
  severity: critical
  message: "[服務名] error rate 超過 5%，立即調查"

# 警告（30 分鐘內處理，Slack）
- name: elevated_latency
  condition: p95_latency > [SLO × 2] for 10 minutes
  severity: warning
  message: "[服務名] P95 latency 超標"

# 預警（業務時間內處理）
- name: high_saturation
  condition: cpu_usage > 70% for 15 minutes
  severity: info
  message: "[服務名] CPU 接近飽和，考慮擴容"
```

## Dashboard Spec 模板

```markdown
## Dashboard：[功能/服務名稱]

### Row 1: 總覽
- 面板 1: Availability（最近 24h）
- 面板 2: Error Rate（最近 1h，折線圖）
- 面板 3: P95 Latency（最近 1h）
- 面板 4: RPS（最近 1h）

### Row 2: Latency 詳細
- 面板 5: P50/P95/P99 latency 對比（最近 6h）
- 面板 6: 各 endpoint latency heatmap

### Row 3: Error 分析
- 面板 7: Error rate by HTTP status code
- 面板 8: Top 5 error messages

### Row 4: Saturation
- 面板 9: CPU / Memory usage
- 面板 10: DB query time（P95）
- 面板 11: External API latency（若有）
```

## 上線後觀察清單

### 部署後 5 分鐘
- [ ] Error rate 正常（< SLO）
- [ ] Latency 正常（P95 < SLO）
- [ ] 無新 Sentry exception

### 部署後 30 分鐘
- [ ] 上述指標持續穩定
- [ ] Traffic pattern 正常（無異常 spike / drop）
- [ ] DB CPU < 70%

### 部署後 24 小時
- [ ] 無新告警
- [ ] SLO dashboard 綠燈
- [ ] Retro 記錄部署觀察（使用 /retro 或 runbook skill）

## 注意事項

- SLO 數字應基於歷史基線 × 1.5 作為 alert threshold
- 首次上線沒有歷史基線時，從 P95 < 500ms / Error < 1% 開始，調整後更新
- Alert 必須有 runbook 連結（on-call 收到 alert 知道怎麼處理）
