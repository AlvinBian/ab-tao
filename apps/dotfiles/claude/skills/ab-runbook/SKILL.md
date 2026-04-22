---
name: ab-runbook
version: 1.0.0
category: meta
description: 生成結構化維運手冊（Runbook），包含部署步驟、回滾程序、監控指標閾值、常見問題排查路徑與升級流程。
disable-model-invocation: true
model: haiku
effort: low
---

# Runbook — 維運手冊

## 使用流程

詢問用戶：
1. 服務/功能名稱
2. 部署平台（k8s / PM2 / Fly.io / AWS ECS / ...）
3. 有無 DB migration
4. 監控工具（Datadog / Grafana / Sentry / ...）
5. 最常見的問題（可選，協助生成 FAQ）

## 標準結構

```markdown
# Runbook：{服務名稱}

**版本**：{v1.0.0} | **更新**：{YYYY-MM-DD} | **負責人**：{team}

## 1. 服務概述
| 項目 | 說明 |
|------|------|
| 用途 | {一句話} |
| 技術 | {Node.js / Python / Go} |
| 依賴 | {DB / Cache / Queue} |
| SLA | {99.9%} |

## 2. 部署步驟
### 前置條件
- [ ] {DB migration 已執行}
- [ ] {環境變數已設定}

### 部署流程
{具體指令}

### 部署後驗證
curl -I https://{URL}/health

## 3. 回滾程序
### 觸發條件
- 錯誤率 > {閾值}
- 核心功能異常

### 回滾步驟
{回滾指令}

## 4. 監控指標
| 指標 | 正常 | 警告 | 嚴重 |
|------|------|------|------|
| 錯誤率 | < 0.1% | > 1% | > 5% |
| P99 | < 500ms | > 1s | > 3s |

## 5. FAQ
### Q: {常見問題}
**症狀**：{確認方式}
**解法**：{步驟}

## 6. Escalation
| 級別 | 何時 | 聯絡誰 |
|------|------|--------|
| L1 | 問題發生 | on-call |
| L2 | 15 分未解決 | Tech Lead |
| L3 | P0 | 管理層 |
```

依回答填入 `{...}` 佔位符生成完整 Runbook。
