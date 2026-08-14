# audit-checklists-v160

v1.6.0 新功能三層級審查 checklist，覆蓋 Core / Scaffold / Hook 三個 tier，對應 CI gate 說明。

## 觸發場景

- 執行 `pnpm run d:setup` 安裝 v1.6.0 後，以此 checklist 驗證安裝完整性
- PR 合併前，確認所有 v1.6.0 新功能均通過對應 tier 的審查條件
- CI pipeline 失敗時，對照 Hook tier 條目定位失敗的 hook 定義

## Usage

```bash
# 執行完整 v1.6.0 三層級審查
pnpm run c:validate --checklist v160

# 只執行 Core tier 審查
pnpm run c:validate --checklist v160 --tier core

# 只執行 Hook tier 審查
pnpm run c:validate --checklist v160 --tier hook

# 輸出 JSON 格式審查結果
pnpm run c:validate --checklist v160 --format json
```

### Core Tier（9 條）— 必須全部通過才能部署

- [ ] `~/.claude/.ab-tao/state.json` 含 `federatedMemory` 區段（schema v1.6）
- [ ] `~/.claude/.ab-tao/memory/federated/projects.json` 存在且 JSON 合法
- [ ] `~/.claude/.ab-tao/corrections/failure-patterns.md` 存在（可為空檔）
- [ ] `~/.claude/.ab-tao/runtime/intent-cache.json` 存在且 JSON 合法
- [ ] `~/.claude/.ab-tao/runtime/cost-routing.jsonl` 可寫入
- [ ] `claude-md/16-ai-dispatcher.md` 存在
- [ ] `claude-md/17-federated-memory.md` 存在
- [ ] `claude-md/18-self-evolution.md` 存在
- [ ] `settings.json._abTao.version` 值為 `"1.6.0"`

### Scaffold Tier（5 條）— 功能可用但不阻斷部署

- [ ] `docs/ai-dispatcher.md` 存在且含「Uninstall」章節
- [ ] `docs/federated-memory.md` 存在且含「Uninstall」章節
- [ ] `docs/failure-catalog.md` 存在且含「Uninstall」章節
- [ ] `docs/cost-routing.md` 存在且含「Uninstall」章節
- [ ] `docs/profile-system.md` 存在且含 7 個 profile 說明

### Hook Tier（5 條）— hook 定義完整性

- [ ] `hooks/defs/session-end.json` 含 `failure-patterns` 抽取邏輯
- [ ] `hooks/defs/pre-tool-bash.json` 含 `cost-router` 評估邏輯
- [ ] `hooks/defs/session-start.json` 含 `federated-memory` 讀取邏輯
- [ ] `hooks/defs/session-start.json` 含 `intent-cache` 初始化邏輯
- [ ] 所有 hook defs 的 `id` 欄位符合 `ab-tao:<scope>:<action>` 格式

### CI Gate 對應說明

| CI Gate | 對應 Tier | 失敗行為 |
|---------|----------|---------|
| `gate:core` | Core（9條）| 阻斷 deploy，必須修復 |
| `gate:scaffold` | Scaffold（5條）| 警告，不阻斷 |
| `gate:hooks` | Hook（5條）| 阻斷 d:setup，需手動修復 |

## Troubleshoot

**`c:validate --checklist v160` 找不到此 checklist**
確認 ab-tao 版本 ≥ v1.6.0：`pnpm run --filter @ab-tao/dotfiles -- version`。v1.5.x 不含此 checklist。

**Core tier 某條失敗但確定已安裝**
執行 `pnpm run d:setup --repair` 嘗試自動修復遺漏的目錄或檔案。若仍失敗，查看 `~/.claude/.ab-tao/state.json` 確認 schema 版本。

**Hook tier 失敗：`id` 格式不符**
手動檢查 `apps/dotfiles/claude/hooks/defs/` 下所有 JSON 的 `id` 欄位，確認符合 `ab-tao:<scope>:<action>` 格式（例：`ab-tao:session:end`）。

## Uninstall

```bash
pnpm run d:uninstall --feature audit-checklists-v160
```

移除後：`c:validate --checklist v160` 命令停用；v1.5 及以前的 checklist 不受影響。
