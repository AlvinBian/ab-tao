# 17-federated-memory

第四溫層 — 跨專案 memory 讀取（唯讀），讓 Claude 在任一 repo 工作時也能存取其他相關 repo 的知識。

## 三溫層 vs 四溫層差異

| 溫層 | 位置 | 生命週期 | 讀寫 |
|------|------|---------|------|
| Hot（第一層） | `memory/MEMORY.md` | 永久，≤15 項 | 讀寫 |
| Warm（第二層） | `{topic}/index.md` | 永久，按需載入 | 讀寫 |
| Cold（第三層） | `archive/` | 永久，封存 | 唯讀 |
| Federated（第四層） | 其他 repo 的 `memory/MEMORY.md` | 即時 pointer | **唯讀** |

第四溫層的核心差異：
- **唯讀**：永遠不寫入，任何修改只能回到本專案 memory
- **即時**：每次冷啟動重新讀取，反映 federated source 的最新狀態
- **可選**：未設定 `projects.json` 時靜默略過，不影響現有三溫層行為

## `projects.json` 格式

路徑：`~/.claude/.ab-tao/memory/federated/projects.json`

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

欄位說明：
- `alias`：在 session 中識別來源的簡稱
- `path`：目標 repo 的絕對路徑
- `memoryIndex`：相對於 `path` 的 memory 索引位置（預設 `memory/MEMORY.md`）
- `readonly`：必須為 `true`，federated layer 不允許 `false`
- `description`：說明此 source 的知識領域（顯示於冷啟動摘要）

## 如何讀取

冷啟動讀取順序：
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
