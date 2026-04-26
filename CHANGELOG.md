# Changelog

本文件記錄所有重要變更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，版本遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [1.6.0] — 2026-04-27 — Greenfield Release

### 🚀 M1 Foundation

- feat: commons-loader 讀 `_ab-tao-paths.json` manifest，動態解析各 source 安裝路徑（M1.2 P0）
- feat: `P.abTao` 子目錄命名空間正式化（`runtime/memory/corrections/metrics/logs/schemas`）
- chore: 殘留清理 — 刪除 3 個 deprecated skill dirs（`old-skills/`）、plugin 重分類（6 enabled → 4，2 改 on-demand）
- fix: `_ab-tao-paths.json` manifest 補上 gstack / bmad / ai-sdlc 三個 source 條目

### ✨ M2 Core Features

- feat: 10 source `SOURCES_CONFIG` — 加入 `curatedResources` 精選清單 + `installMode`（copy/plugin）欄位
- feat: 5 個新 CLI 指令
  - `d:profile <name>` — profile 快速切換（7 個 preset）
  - `c:plugin [--enable|--disable|--audit]` — plugin 狀態管理
  - `c:metrics [--summary|--export]` — 使用指標查看
  - `c:memory [--list|--list-federated|--decay-scan]` — 記憶體管理
  - `c:skills:curated [--from <source>]` — 精選 skills 查看與安裝
- feat: `state.json` 加入四個 sub-schema（ADR-001）
  - `federated` — 跨來源記憶索引
  - `failurePatterns` — append-only 失敗模式自我演進記錄
  - `intentCache` — `/ai` dispatcher intent 快取
  - `metricsSnapshot` — 使用指標快照
- feat: `FEATURE_REGISTRY` 功能登記表 + `d:uninstall --feature <name>` 精細移除
- feat: `settings.json` 新增 `_abTao` 區段（`voiceTrigger` / `costRouting` / `tddStrictMode` / `securityMode`）
- feat: failure-patterns session-end hook — append-only 自我演進，規則本體永不變

### 🤖 M3 AI Dispatcher & Chain Commands

- feat: `/ai` rule-based dispatcher — 30+ intent 映射，自動路由到對應命令 / agent
- feat: Chain commands
  - `/chain-product` — 完整產品流程（specify → architect → check → verify）
  - `/chain-tdd` — TDD 流程（specify → 測試骨架 → check --tdd-strict → verify）
- feat: federated memory `c:memory --list-federated` — 跨 source 記憶統一視圖
- feat: Console 17 view scaffold + 8 SSE channel（即時推送）
- feat: Profile / Metrics / AI Features view 強化（M3.3）

### 📚 M3 Docs & Polish

- docs: 14 個新文件（5 段式架構）— 完整 API reference + 架構指南
- docs: 3 個新 `claude-md` section（`16-ai-dispatcher.md` / `17-chain-commands.md` / `18-failure-patterns.md`）
- docs: README v1.6.0 完整重寫 — 5 段式 introduction + 能力矩陣表
- docs: 5 個 walkthrough 文件（`apps/dotfiles/docs/walkthroughs/`）
  - `product-flow.md` — 從需求到 ship 完整流程
  - `tdd-flow.md` — TDD 完整流程
  - `solo-founder.md` — 個人 / startup 使用情境
  - `enterprise-team.md` — 多人 / 合規場景
  - `ai-sources-setup.md` — AI sources 設定完整流程

### Breaking Changes

- 本版本為 greenfield 首次正式發布，不維護 v1.5 相容性
- `state.json` schema 加入 4 個新 sub-schema，舊格式需重新初始化
- `plugins.yml` 中 6 個 plugin 改 `enabled: false`（改為 on-demand 模式）
- `bin/profile.mjs` 新 CLI，`d:profile` 取代直接修改 `profiles/active.json`

詳細升級指引見 [MIGRATION-v1.6.md](MIGRATION-v1.6.md)
