# Federated Memory

第四溫層 — 跨專案 memory 讀取（唯讀），讓 Claude 在任一 repo 工作時也能存取其他相關 repo 的知識。

## 三溫層 vs 四溫層

| 溫層 | 位置 | 生命週期 | 讀寫 |
|------|------|---------|------|
| Hot（第一層） | `memory/MEMORY.md` | 永久，≤15 項 | 讀寫 |
| Warm（第二層） | `{topic}/index.md` | 永久，按需載入 | 讀寫 |
| Cold（第三層） | `archive/` | 永久，封存 | 唯讀 |
| Federated（第四層） | 其他 repo 的 `memory/MEMORY.md` | 即時 pointer | **唯讀** |

第四溫層核心差異：
- **唯讀**：永遠不寫入，任何修改只能回到本專案 memory
- **即時**：每次冷啟動重新讀取，反映 federated source 的最新狀態
- **可選**：未設定 `projects.json` 時靜默略過，不影響現有三溫層行為

## 冷啟動讀取順序

1. 本專案 `memory/MEMORY.md`（Hot layer）
2. `projects.json` 中每個 source 的 `memoryIndex`（Federated layer，依序讀取）
3. 本專案記憶優先級永遠高於 federated source

在 session 中引用 federated 知識時，標注來源：
> 「以下基於 federated source [kkday-bff] 的記憶：...」

## 何時不使用

- **不要**用 federated memory 存放需要更新的內容（寫入必須走本專案 memory）
- **不要**跨 federated source 建立依賴（source A 參考 source B 的記憶）
- **不要**將 federated source 指向個人私有記憶目錄（僅指向 repo 內的 `memory/`）
- 若 federated source 路徑失效（repo 被刪除或移動），靜默略過，不報錯

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
      "registeredAt": "2026-04-27T10:00:00Z",
      "description": "KKday BFF 層架構決策與 API 規範"
    }
  ]
}
```

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
