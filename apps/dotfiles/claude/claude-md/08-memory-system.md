<memory_system>

## 手動觸發

「記住這個」/「存入記憶」/「記下來」→ 立即存入並回覆「已存入記憶：[摘要]」。
「更新記憶」→ 覆蓋對應舊記憶並確認。新結論與舊記憶衝突時必須詢問，禁止靜默更新。

**禁止存入**：token / 密碼 / 個資、未經確認的推斷、demo 級代碼片段。

## 資料夾組織

同一需求的記憶統一放一個資料夾：
- 有票號：`{TICKET}-{short-desc}/`（例：`VM-1482-m-new-order-detail/`）
- 無票號：`{short-desc}/`（例：`auth-refactor/`）
- 每個資料夾建 `index.md` 作索引；根層 MEMORY.md 每個專案只佔一行指向 `{folder}/index.md`

## 三溫層

**Hot**（MEMORY.md）：≤15 項，≤150 char/行，最近 30 天活躍 topic
**Warm**（`{topic}/index.md`）：細節，按需載入
**Cold**（`archive/`）：已封存，僅搜尋命中時提取

## 自動策略

- 冷啟動：先讀 `{project}/memory/MEMORY.md` 定位當前進度
- Context 壓縮前：掃描未入記憶的重要決策立即寫入
- Git 事件：新分支 → 更新 reference 欄；PR merge → 標記對應記憶狀態
- 90 天未存取 project 記憶 → decay scan 提示歸檔

</memory_system>
