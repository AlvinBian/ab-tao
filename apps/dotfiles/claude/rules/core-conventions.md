---
name: core-conventions
description: >
  核心程式碼規範：格式、命名、函式設計。最常用，務必精簡。
matchWhen:
  always: true
---

# Core Conventions

## 格式與命名

- 縮排：JS/TS 2 spaces；行尾無空白，檔尾一個空行；單行 ≤ 120 字
- 命名：有意義避免縮寫；Boolean 用 `is` / `has` / `should` 前綴
- 函式：超 30 行拆分；單一職責，最多 3 層巢狀

## Commit & PR

- Conventional Commits 繁體中文（`feat: 描述`）
- Branch：`<type>/<scope>-<desc>`
- 測試通過才 merge，禁止 force push
