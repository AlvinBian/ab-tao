# 多人 / 合規場景

適用對象：團隊共用環境或有合規要求的專案，強調一致性、安全性、可審計性。

## 前置需求

1. 所有成員已安裝 ab-tao（`d:setup` 完成）
2. 建議選擇 `work` 或 `production` profile
3. security-guidance plugin 已啟用（見步驟 2）

## 完整步驟

### 步驟 1：Team 統一安裝

每位成員在本機執行：

```bash
git clone https://github.com/AlvinBian/ab-tao.git
cd ab-tao
pnpm install
pnpm run d:setup
```

`d:setup` 互動精靈中建議選項：
- **技術棧掃描**：選擇掃描 team GitHub org 的 repos
- **AI 資源**：選擇 `ecc` + `anthropic` 作為基礎來源
- **Profile**：選 `work`（團隊預設）

### 步驟 2：切換到 work/production profile

```bash
# 開發環境
pnpm run d:profile work

# 發布 / 高合規要求
pnpm run d:profile production
```

`production` profile 特性：
- `voiceTrigger: false`（關閉語音觸發，避免誤觸）
- `tddStrictMode: true`（強制測試先行）
- `costRouting: standard`（不限制模型）

### 步驟 3：啟用 security-guidance plugin

在 Claude Code 中執行：

```
/plugin install security-guidance
```

或透過 `pnpm run c:plugin --enable security-guidance`

security-guidance 會在代碼審查中自動標記：
- SQL injection 風險
- XSS 漏洞
- 敏感資訊洩漏（token / password in logs）
- 不安全的隨機數生成

### 步驟 4：關閉 voice trigger（team 環境強制）

合規環境中語音觸發需關閉，避免無意間執行指令：

```bash
# 確認 settings.json
cat ~/.claude/settings.json | grep voiceTrigger
# 預期：false
```

若未關閉，透過 `/settings voiceTrigger false` 或 `update-config` skill 更新。

### 步驟 5：PR 流程（9 閘全跑）

```bash
# 提交前強制執行完整品質閘
/check --gates
```

`production` profile 下 `--gates` 追加兩個閘：
- **Security scan**：security-guidance 全量掃描
- **Dependency audit**：`pnpm audit` 無高危漏洞

### 步驟 6：堆疊 PR 合規流程

```bash
# 建立 stacked PR
# PR-1: 基礎架構
gh pr create --title "[TICKET][PROJECT] 主描述 - PR-1 基礎架構"

# PR-2: 業務邏輯（base 指向 PR-1）
gh pr create --title "[TICKET][PROJECT] 主描述 - PR-2 業務邏輯" --base feat/TICKET/1-base
```

合規要求：
- 每個 PR 須有 `/verify` 輸出的 AC 覆蓋報告
- DB migration 須在 PR description 標明 filename 與執行順序
- 禁止 `gh pr merge`，必須人工 UI 點擊合併

## 預期結果

- 團隊所有成員使用相同 profile，行為一致
- security-guidance 自動攔截常見安全問題
- 9 閘品質閘確保每個 PR 達到生產標準

## 常見問題

**Q：team 成員的 settings.json 怎麼統一？**
A：將 `settings.json` 的 `_abTao` 區段提交到 repo 的 `.claude/` 目錄，成員 `d:setup` 時自動繼承。

**Q：production profile 的 `tddStrictMode` 太嚴，老代碼無法通過怎麼辦？**
A：可在 `.claude/settings.local.json`（gitignored）臨時覆蓋，但需在 PR 說明原因。

**Q：security-guidance plugin 誤報率高怎麼辦？**
A：在 `/plugin config security-guidance` 調整 severity threshold，或在代碼添加 `// security-guidance: ignore` 注釋並附理由。

**Q：多人使用同一台機器的 Claude Code 怎麼隔離？**
A：ab-tao 目前不支援多用戶隔離，建議每人使用獨立 API key，並各自執行 `d:setup`。
