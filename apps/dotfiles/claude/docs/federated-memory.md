# federated-memory

跨專案 memory 讀取機制（第四溫層），以 read-only pointer 系統讓多個 repo 共享同一份知識，不複製不覆蓋。

## 觸發場景

- 多個 repo 需要共用同一份 API 規範記憶（如 `kkday-bff-patterns`）
- 新專案冷啟動時，自動掛載父專案的 Hot/Warm 記憶作為背景知識
- monorepo 子 package 需要讀取根 package 的架構決策記憶

## Usage

```bash
# 列出目前已註冊的 federated 來源
pnpm run c:memory --list-federated

# 註冊新的 federated memory 路徑（唯讀掛載）
pnpm run c:memory --register-federated /Users/alvin/ab-projects/kkday-bff

# 取消掛載
pnpm run c:memory --unregister-federated /Users/alvin/ab-projects/kkday-bff

# 手動刷新 pointer 狀態（確認來源路徑仍有效）
pnpm run c:memory --refresh-federated
```

federated pointer 設定路徑：`~/.claude/.ab-tao/memory/federated/projects.json`

`projects.json` 格式範例：
```json
{
  "version": "1.0",
  "sources": [
    {
      "alias": "kkday-bff",
      "path": "/Users/alvin/ab-projects/kkday-bff",
      "memoryIndex": "memory/MEMORY.md",
      "readonly": true,
      "registeredAt": "2026-04-27T10:00:00Z"
    }
  ]
}
```

Claude 讀取邏輯：
- 冷啟動時，先讀本專案 `memory/MEMORY.md`
- 接著逐一讀取 `projects.json` 中所有 `readonly: true` 的 `memoryIndex`
- 第四溫層僅供閱讀，任何寫入操作仍回寫本專案 memory

## Troubleshoot

**`--list-federated` 回傳空清單**
表示尚未註冊任何來源，屬正常狀態。執行 `--register-federated <path>` 掛載第一個來源。

**來源路徑不存在（invalid path error）**
確認目標 repo 路徑正確且包含 `memory/MEMORY.md`。federated-memory 要求來源路徑為有效 ab-tao managed repo。

**跨專案記憶產生衝突（矛盾決策）**
本專案記憶優先級永遠高於 federated 來源。如需覆蓋，在本專案 `memory/MEMORY.md` 明確記錄覆蓋原因；不得直接修改 federated 來源。

## Uninstall

```bash
pnpm run d:uninstall --feature federated-memory
```

移除後：`projects.json` 保留，但 Claude 不再自動讀取 federated 來源。重新安裝後需執行 `--register-federated` 重新掛載。
