# 個人偏好範例

這個資料夾提供偏好記憶的範例格式。
使用者的實際偏好存放於 ~/.claude/memory/preferences/（ab-tao 不覆蓋）。

## 範例檔案格式

```markdown
---
name: vue-state-management
description: Vue 3 專案狀態管理偏好
type: user
---

偏好 Pinia（Vue 3）取代 Vuex。

**Why:** Pinia 的 TypeScript 支援更好、無 mutation 概念、DevTools 整合更佳。
**How to apply:** 新 Vue 3 專案預設使用 Pinia；遇到 Vuex 提示可考慮遷移。
```
