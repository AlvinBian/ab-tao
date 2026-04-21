# @ab-tao/console

Vue 3 Web 後台控制台 — 可視化管理 Claude Code 配置、記憶體、AI 資源與執行動作。

## 職責

以 GUI 方式呈現 `@ab-tao/dotfiles` 管理的所有狀態，提供配置編輯、資源瀏覽、動作觸發等功能，取代純命令列的管理方式。

```
src/
├── views/           — 頁面視圖（6 區）
├── components/      — 共用組件（ResourceListView、SettingRow...）
├── composables/     — Vue composables（useSse、useFormatRelative...）
├── charts/          — ECharts 圖表組件
├── stores/          — Pinia stores（status、settings、resources）
├── router/          — Vue Router 路由定義
└── layouts/         — 頁面佈局（ConsoleLayout）
server/
├── index.mjs        — Express API server（port 5478）
├── routes/          — API 路由（status、settings、resources、actions...）
└── utils/           — 工具函式（scanner、backup...）
```

## 資訊架構（6 區）

| 區域              | 說明                                                       |
| ----------------- | ---------------------------------------------------------- |
| **Dashboard**     | 系統總覽、健康度、環境狀態、Memory / Plans 統計            |
| **Resources**     | Skills / Commands / Agents / Rules — 啟用狀態、來源、版本  |
| **Integrations**  | MCP servers、Hooks 健檢、Repos 列表、Tech Stacks           |
| **Configuration** | settings.json 編輯、Permissions CRUD、AI Model、Hooks 開關 |
| **Actions**       | Setup / Scan / Sync / Restore — 帶進度串流（SSE）          |
| **About**         | 版本資訊、模組安裝狀態、文件連結                           |

## 圖表組件

| 組件                    | 說明                                   |
| ----------------------- | -------------------------------------- |
| `MemoryStackedBar`      | Memory / Plans / Tasks 分佈堆疊柱狀圖 |
| `MemorySizeBar`         | 各專案記憶體檔案數排行                 |
| `ResourcesBarChart`     | 資源數量按來源分組                     |
| `SetupStepFlowDiagram`  | Setup 安裝精靈步驟流程圖               |
| `SetupPhaseDag`         | Setup Phase 依賴 DAG 圖                |
| `HooksStatusChart`      | Hooks 狀態健檢圖                       |

## API Server

Express server 監聽 `localhost:5478`，所有端點需同源請求（`assertTrustedOrigin` 防護）。

| 端點                        | 說明                                 |
| --------------------------- | ------------------------------------ |
| `GET /api/status`           | 完整系統狀態（config + resources + memory）|
| `GET /api/settings`         | 讀取 `~/.claude/settings.json`       |
| `PATCH /api/settings/:key`  | 更新單個設定值                       |
| `GET /api/resources/:type`  | 列出指定類型資源（skills/commands/agents/rules）|
| `POST /api/actions/:action` | 觸發動作（setup/scan/sync/restore）  |
| `GET /api/actions/:action/stream` | SSE 進度串流                   |

## 技術棧

- **Vue 3** + **TypeScript** — 前端框架
- **Vite** — 構建工具 + dev server
- **Element Plus** — UI 組件庫
- **Pinia** — 狀態管理
- **Apache ECharts** + **vue-echarts** — 圖表
- **Express** — API server
- **Biome** — 格式化與 lint
- **Vitest** — 單元測試

## 指令

```bash
pnpm run cs:dev     # Vite + API dev server（開發模式，port 5478）
pnpm run cs:build   # 構建 SPA → apps/console/dist/
pnpm run cs:open    # 構建後以 file:// 開啟（離線靜態模式）
pnpm run cs:serve   # 僅啟動 API server（不含 Vite）
```

## 開發

```bash
# 在 monorepo 根目錄
pnpm run cs:dev

# 瀏覽器開啟
open http://localhost:5478
```

dev server 同時啟動 Vite HMR（前端）和 Express（`/api` 路由），透過 Vite proxy 統一在 port 5478。

## 離線模式

`cs:open` 先執行 `build` 再以 `file://` 協定開啟 `dist/index.html`，適用於無網路或快速查看場景。離線模式下 API server 不啟動，部分需要即時資料的功能將降級為靜態展示。

## 安全設計

- API server 限制僅接受來自 `localhost` 的請求（`Origin` / `Referer` 檢查）
- 所有寫入操作（settings PATCH）執行前自動備份
- 不開放外部網路存取，無需認證機制
