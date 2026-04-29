# profile-system

7 個 ab-tao profile 切換系統，依工作情境快速調整 Claude 的行為模式、成本策略與 hook 組合。

## 觸發場景

- 早上開始日常開發，切換至 `day-to-day` profile 啟用全部 hooks 與標準模型
- 需要快速驗證想法時，切換至 `spike` profile 放寬規格要求，加速迭代
- 月底成本超標，切換至 `frugal` profile 鎖定 Haiku 模型並停用非必要 hooks

## Usage

```bash
# 切換至指定 profile
pnpm run d:profile personal
pnpm run d:profile work
pnpm run d:profile frugal

# 列出所有 7 個 profile 及當前狀態
pnpm run d:profile --list

# 查看指定 profile 的完整設定
pnpm run d:profile --show spike

# 臨時 profile（當前 session 結束後恢復原 profile）
pnpm run d:profile frugal --session-only

# 查看當前啟用的 profile
pnpm run d:profile --current
```

7 個 profile 說明：

| Profile | 一句話描述 | 預設模型 | costRouting |
|---------|-----------|---------|-------------|
| `personal` | 個人開發：全功能啟用，無企業限制 | Sonnet | dynamic |
| `work` | 工作模式：企業規範強制，audit hooks 全開 | Sonnet | dynamic |
| `oss` | 開源貢獻：啟用 PR checklist，關閉私有 source | Sonnet | dynamic |
| `day-to-day` | 日常開發：標準配置，所有 hooks 啟用 | Sonnet | dynamic |
| `spike` | 快速驗證：放寬規格，關閉 audit，允許 `any` 類型 | Sonnet | dynamic |
| `production` | 生產強化：最嚴格審查，強制 Opus，二次確認所有操作 | Opus | static |
| `frugal` | 省錢模式：鎖定 Haiku，停用 adversarial / attribution | Haiku | static |

各 profile 詳細說明：

**personal**
個人信任環境，全功能啟用。關閉企業 Slack 限制，允許 bypassPermissions（本機 trusted 環境）。適合個人 side project。

**work**
企業工作模式。強制 audit hooks、Slack 傳送二次確認、PR checklist 全開。適合公司專案開發時段。

**oss**
開源貢獻模式。啟用 PR stack 驗證與 commit message 規範，關閉私有 source 同步（避免誤帶公司資產進開源 repo）。

**day-to-day**
最常用的日常開發設定。所有 hooks 標準啟用，dynamic cost routing，三態錯誤處理強制。

**spike**
快速驗證 / 技術 spike 模式。允許 `any` 類型、放寬 50 行函式限制、關閉 audit 審查。使用此 profile 的輸出不應直接進 production。

**production**
生產部署強化模式。強制使用 Opus 模型，所有操作前二次確認，adversarial review 自動觸發，最嚴格 CI gate。

**frugal**
成本控制模式。鎖定 Haiku 模型（靜態路由），停用 adversarial review 與 attribution 統計，最小化 token 消耗。

## Troubleshoot

**切換 profile 後 hook 行為未改變**
執行 `pnpm run d:hooks --list` 確認 hook 狀態。profile 切換透過 `settings.json` 生效，若 Claude Code 正在執行中，需重啟 session 套用新設定。

**`spike` profile 下 TypeScript 仍報 `any` 錯誤**
`spike` 放寬的是 ab-tao 規則層，不影響 TypeScript compiler 設定。若要停用 `tsconfig.json` 的 strict mode，需手動修改，不建議。

**`frugal` 模式下某些命令變慢或品質下降**
Haiku 模型在複雜推理任務上能力有限。對需要高品質輸出的任務，臨時切換：`pnpm run d:profile day-to-day --session-only`。

## Uninstall

```bash
pnpm run d:uninstall --feature profile-system
```

移除後：`d:profile` 命令停用；`settings.json` 回復至 `day-to-day` profile 的預設值。已切換的 profile 設定會被重置。
