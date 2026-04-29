# @ab-tao/commons

## 1.1.0

### Minor Changes

- feat: v1.6.0 Greenfield Release — AI Dispatcher、Chain Commands、Federated Memory

  **M1 Foundation**

  - commons-loader 讀 `_ab-tao-paths.json` manifest，動態解析各 source 安裝路徑
  - `P.abTao` 子目錄命名空間正式化（runtime/memory/corrections/metrics/logs/schemas）
  - 殘留清理：deprecated skill dirs、plugin 重分類（6 → 4 enabled，2 改 on-demand）

  **M2 Core Features**

  - 9 source `SOURCES_CONFIG` 加入 `curatedResources` 精選清單 + `installMode`（copy/plugin）欄位
  - 5 個新 CLI：`d:profile` / `c:plugin` / `c:metrics` / `c:memory` / `c:skills:curated`
  - `state.json` 加入 4 個 sub-schema：federated / failurePatterns / intentCache / metricsSnapshot
  - `FEATURE_REGISTRY` + `d:uninstall --feature` 精細移除
  - `settings.json._abTao` 區段（voiceTrigger / costRouting / tddStrictMode / securityMode）

  **M3 AI Dispatcher & Chain Commands**

  - `/ai` rule-based dispatcher — 39 條 intent 映射，自動路由到對應命令 / agent
  - `/chain-product` / `/chain-tdd` Chain commands
  - Federated memory CLI 三件套
  - Console 17 view scaffold + 8 SSE channel（即時推送）
  - M3.6：session-end failure-collect hook、voice-trigger hook、cost-aware routing hook

  **Bug Fixes（AI sources sync）**

  - `ai-source-select` needSync 改用 .versions.json sha 判斷，spinner 顯示真實計數
  - `sync-sources` 移除 skills-mp，git clone 錯誤改串接 stderr
  - 新增 `source-meta.mjs` 集中管理 icon/label map（消除三處重複）
  - `prune-orphans` KNOWN_SOURCES 改從 SOURCES_CONFIG 自動派生

## 1.0.3

### Patch Changes

- feat(dotfiles): ccline → claude-hud 遷移 + 互動選單 UX 改進

  - 移除 CCometixLine（ccline）整合，改為 claude-hud plugin
  - 新增 claude-hud wrapper 腳本與配置（config.json、hud-wrapper.sh）
  - CLAUDE.md 安裝預設由 keep 改為 install
  - 所有互動選單 hint 欄位合併至 label（選擇前即可見完整說明）
  - 選項標題與說明之間的 「—」分隔符改為單一空格

## 1.0.2

### Patch Changes

- 修正 version-tracker 未知來源測試（實作已改為動態建立條目，自動支援新來源加入）

## 1.0.1

### Patch Changes

- 2c8440d: 移除 mempalace 翻譯條目（translations.json）
