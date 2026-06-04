# LSP MCP Server 評估報告

> 評估日期：2026-05-24
> 目的：評估在 Claude Code 中加入 LSP MCP server 以支援 Vue 3 / Nuxt 3 / TypeScript workspace rename、references、diagnostics 的可行性。
> 結論：**DEFER** — 見下方阻塞點摘要。

## 結論摘要

**不採用**，理由：當前所有 Vue LSP MCP 方案均受 `@vue/language-server` v3.x 架構斷層影響，v3 移除了內部 tsserver 通訊層，所有現有 adapter 均鎖在 v2.x，新架構整合尚未有任何方案完成。建議 3-6 個月後重新評估。

**現有需求的替代方案**：
- Workspace rename + 影響範圍 → **GitNexus `rename` + `impact`**（已部署）
- 即時型別診斷 → **VSCode + Volar extension**（主力 IDE 保留）

## 候選方案評估表

| 方案 | 存在 | Vue 支援 | Rename 品質 | 穩定性 | 最後更新 |
|---|---|---|---|---|---|
| `cclsp` (ktnyt) | ✅ | ✅ v2.x | medium | experimental | 活躍開發中 |
| `Piebald-AI/claude-code-lsps` | ✅ | ✅ v2.x | medium | experimental | 2025 |
| `mcp-language-server` (isaacphi) | ✅ | ⚠️ 有已知 bug | low | experimental | 2025-05-16 |
| `lsp-mcp` (Tritlo) | ✅ | ❓ | low | experimental | 未知 |
| `lsp-mcp-server` (ProfessioneIT) | ✅ | ❓ | medium | experimental | 未知 |
| `mcp-lsp-bridge` (rockerBOO) | ✅ | ❓ | low | experimental | 2025-08-01 |
| `@modelcontextprotocol/server-lsp`（官方）| ❌ | — | — | — | 不存在 |
| Volar MCP adapter（社群）| ❌ | — | — | — | 不存在 |

## 關鍵阻塞點

**1. @vue/language-server v3.x 架構斷層（最嚴重）**

v3 在 2025 年移除內建 TypeScript 通訊層，要求 LSP client 自行實作 `tsserver/request` 轉發。cclsp 和 Piebald-AI/claude-code-lsps 均明確要求 v2.x，v3 遷移指南（vuejs/language-tools Discussion #5456）存在，但無任何主流 LSP MCP server 完成 v3 適配。

**2. isaacphi/mcp-language-server Issue #85（已知 bug）**

vue-language-server 支援在此方案中被報告為完全無效：診斷請求永遠掛起 30s，根因是 `tsserver/request` 通知無 handler。Issue 開於 2025-09-26，無後續回覆。

**3. 全部方案均為 experimental**

8 個候選中無一標記為 stable 或有生產環境驗證案例。cclsp 是最可行的，但 15 個 open issues 且未發布正式版本。

## LSP MCP vs GitNexus 能力對比

| 維度 | LSP MCP | GitNexus |
|---|---|---|
| Rename 精確度 | 高（AST 基礎，處理 shadowing / overload）| 中（符號圖譜，跨層級傳遞）|
| 影響範圍分析 | 需逐檔查詢 | 單次 impact 工具，d=1/2/3 層 |
| Vue SFC 語意理解 | ✅ Volar 有 template 語意 | 取決於 GitNexus parser |
| token 效率 | 低（逐檔 round trip）| 高（預計算圖，單次回傳）|
| 即時診斷 | ✅ 型別錯誤即時回傳 | ❌ 靜態圖，不含型別推斷 |
| 設定複雜度 | 高（LSP server 設定、版本相容）| 低（已部署）|
| 穩定性 | experimental | 已生產使用 |

**結論**：兩者互補，LSP 在單次 rename 精確度和即時診斷上有優勢；GitNexus 在跨模組依賴分析和 token 效率上遠優。現有工作流的主要瓶頸不在 LSP 缺失。

## 重新評估時機

建議在以下條件至少一個成立時重新評估：

- `cclsp` 或 `Piebald-AI/claude-code-lsps` 發布支援 `@vue/language-server@3.x` 的版本
- 官方 MCP server 倉庫加入 LSP reference implementation
- isaacphi/mcp-language-server Issue #85 被修復

預估時間：3-6 個月（2026 Q3-Q4）
