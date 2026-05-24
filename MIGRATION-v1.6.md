# Migration Guide — v1.5 → v1.6.0

> v1.6.0 為 greenfield 首次正式發布，不維護向後相容性。
> 若你使用的是 v1.5.x，**建議全新安裝**（`d:setup` 完整跑一遍），而非就地升級。

## 主要破壞性變更

### 1. state.json schema 變更

v1.6.0 在 `~/.claude/.ab-tao/state.json` 新增四個 sub-schema（ADR-001）：

```json
{
  "federated": {}, // 跨來源記憶索引（新增）
  "failurePatterns": [], // append-only 失敗模式記錄（新增）
  "intentCache": {}, // /ai dispatcher intent 快取（新增）
  "metricsSnapshot": {} // 使用指標快照（新增）
}
```

舊版 `state.json` 缺少這些欄位，部分 CLI 指令會報 schema validation 錯誤。

### 2. plugins.yml — on-demand 模式調整

6 個 plugin 從 `enabled: true` 改為 `enabled: false`（需要時手動啟用）：

| Plugin | v1.5 | v1.6.0 | 改變原因 |
|---|---|---|---|
| `superpowers` | enabled | on-demand | 大多數用戶不需要 |
| `context-engineering` | enabled | on-demand | 按需載入 |
| `bmad` | enabled | on-demand | 重量級，按需 |
| `ai-sdlc` | enabled | on-demand | 按需載入 |
| `gstack` | enabled | on-demand | 按需載入 |

啟用方式：`pnpm run c:plugin --enable <plugin-name>`

### 3. d:profile CLI 取代直接修改 profiles/active.json

v1.5 直接編輯 `~/.claude/.ab-tao/profiles/active.json` 切換 profile。
v1.6.0 統一使用：

```bash
# 正確方式
pnpm run d:profile <name>

# 舊方式（v1.6.0 起不再支援）
# 直接編輯 profiles/active.json → 可能導致 state 不一致
```

### 4. _ab-tao-paths.json manifest 更新

v1.6.0 新增 `gstack` / `bmad` / `ai-sdlc` 三個 source 的 manifest 條目。
舊版 `_ab-tao-paths.json` 缺少這些條目，`c:ai-sync` 會顯示 source 不可用。

## 升級步驟

### 方案 A：全新安裝（推薦）

```bash
# 步驟 1：備份舊配置
cp -r ~/.claude ~/.claude.backup-v1.5-$(date +%Y%m%d)

# 步驟 2：更新 ab-tao
cd /path/to/ab-tao
git pull origin main
pnpm install

# 步驟 3：全新部署
pnpm run d:setup

# 步驟 4：重設 active profile
pnpm run d:profile personal   # 或 day-to-day / work，依需求選擇

# 步驟 5：確認 plugin 狀態
pnpm run c:plugin --audit

# 步驟 6：環境診斷
pnpm run d:doctor
```

### 方案 B：就地升級（有風險，謹慎操作）

```bash
# 步驟 1：備份 state.json
cp ~/.claude/.ab-tao/state.json ~/.claude/.ab-tao/state.json.v1.5.backup

# 步驟 2：更新並重新初始化 state schema
pnpm run c:validate --schema --fix

# 步驟 3：重設 profile
pnpm run d:profile personal

# 步驟 4：重新同步 AI sources
pnpm run c:ai-sync --all

# 步驟 5：診斷
pnpm run d:doctor
```

## 驗證升級成功

```bash
# 確認 state.json 有新欄位
cat ~/.claude/.ab-tao/state.json | grep -E "federated|failurePatterns|intentCache"

# 確認 profile CLI 正常
pnpm run d:profile --list

# 確認新 CLI 可用
pnpm run c:memory --list
pnpm run c:metrics --summary

# 完整環境診斷
pnpm run d:doctor
```

## 需要幫助？

- 升級問題：`pnpm run d:setup --doctor`
- Schema 錯誤：`pnpm run c:validate --schema`
- 回滾：`pnpm run d:restore`（從 v1.5 備份還原）
