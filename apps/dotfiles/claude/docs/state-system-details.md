# State System 詳細規範

> 由 `claude-md/08-state-system.md` 按需指向，操作 plan/memory 細節時 Read。

## 資料夾組織（Memory）

同一需求的記憶統一放一個資料夾：
- 有票號：`{TICKET}-{short-desc}/`（例：`VM-1482-m-new-order-detail/`）
- 無票號：`{short-desc}/`（例：`auth-refactor/`）
- 每個資料夾建 `index.md` 作索引；根層 MEMORY.md 每個專案只佔一行指向 `{folder}/index.md`

## 自動策略（session 中）

- Context 壓縮前：掃描未入記憶的重要決策立即寫入
- Git 事件：新分支 → 更新 reference 欄；PR merge → 標記對應記憶狀態
- 90 天未存取 project 記憶 → decay scan 提示歸檔

## Mid-run 主動記憶細節

> 對應 `claude-md/08-state-system.md § Mid-run 主動記憶`，補充判定標準與時序。

### 觸發條件判定標準

**發現既有 pattern 和預期不同**
- 構成觸發：探索 codebase 時發現「大家用 X 但我以為會用 Y」（例：全域用 `useFetch` 而非 `useAsyncData`）
- 不構成觸發：發現某個檔案有一個邊角 case，太局部、不具有代表性

**確認了設計決策的「為什麼」**
- 構成觸發：使用者說「因為 iOS WebView 不支援 X 所以我們用 Y」/ 程式碼有 WHY 註解且你讀懂了
- 不構成觸發：「這邊用了 computed 屬性」（只是 what，沒有 why）

**踩到 non-obvious 坑**
- 構成觸發：修復後「這個坑如果下次不記得會再踩」
- 不構成觸發：語法錯誤、typo、常見錯誤（已在官方文件說明）

**使用者明示偏好但未說「記住」**
- 構成觸發：「我們團隊都 X」/ 「公司規定要 X」/ 「我個人不喜歡 X」
- 不構成觸發：「這個功能要用 X」（任務指令，不是偏好）

### 三種觸發時機時序

```
手動觸發       ← 使用者說「記住這個」
mid-run 觸發   ← 對話進行中符合上述 4 條件（本節）
PreCompact     ← hook 在 context 壓縮前掃描（claude-md 冷啟動段）
SessionEnd     ← session-end.sh auto-curate 區段（hooks/session-end.sh）
```

越早觸發越好；後續時機是前一層的 safety net，不是主要路徑。

### 寫入 frontmatter 規範

```yaml
---
name: {topic}-{kebab-slug}
description: 一句話摘要，說明這條記憶在哪個 context 下有用
metadata:
  type: feedback | user | project | reference
  source: mid-run  # 標注這是自動觸發，便於日後 decay 判斷
---
```

`source: mid-run` 標注讓使用者在 MEMORY.md 快速識別哪些是系統自動記錄，哪些是自己明確要求記的。
