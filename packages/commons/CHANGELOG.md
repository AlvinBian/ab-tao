# @ab-tao/commons

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
