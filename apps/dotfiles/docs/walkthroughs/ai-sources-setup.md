# AI Sources 設定完整流程

適用對象：初次設定或需要調整 AI 資源來源的使用者，確保安裝正確的 skills / commands / agents。

## 前置需求

1. ab-tao `d:setup` 已完成（基礎環境就緒）
2. pnpm 10+ 已安裝
3. 網路可存取 GitHub（用於下載 AI sources）

## 完整步驟

### 步驟 1：查看目前 AI sources 狀態

```bash
pnpm run c:ai-sync
```

列出所有可用來源與狀態，不執行同步。

輸出範例：

```
AI Sources Status
─────────────────────────────────────
ecc          ✓ 已安裝  v2.1.0  (2026-04-20)
anthropic    ✓ 已安裝  v1.5.0  (2026-04-15)
superpowers  ✗ 未安裝
gstack       ✗ 未安裝
bmad         ✗ 未安裝
ai-sdlc      ✗ 未安裝
```

### 步驟 2：互動式選擇 sources 安裝

```bash
pnpm run c:ai-sync --select
```

進入互動選擇介面，可勾選要安裝或更新的來源：

```
? 選擇要同步的 AI sources（空格勾選，Enter 確認）
  ◉ ecc              — Claude Code 社群資源（commands/agents/rules/skills）
  ◉ anthropic        — Anthropic 官方 Skills
  ○ superpowers      — Claude Superpowers — 進階 agent 能力
  ○ gstack           — Google Stack 最佳實踐
  ○ bmad             — BMAD 方法論框架
  ○ ai-sdlc          — AI-SDLC 完整開發生命週期
  ○ context-engineering  — Context 優化 / 壓縮 / 評估
```

建議個人用戶選 `ecc` + `anthropic`；進階用戶加選 `superpowers` + `context-engineering`。

### 步驟 3：同步選定的 sources

確認選擇後自動執行同步，或手動指定：

```bash
# 同步特定來源
pnpm run c:ai-sync -- --pick ecc,anthropic

# 同步全部來源（謹慎：可能覆蓋已自訂的 skills）
pnpm run c:ai-sync --all
```

同步過程會進行安全驗證（SHA256 校驗 + 危險模式掃描），確保外部資源安全。

### 步驟 4：查看精選 Skills（curatedResources）

```bash
# 查看來自 gstack 的精選 skills
pnpm run c:skills:curated --from gstack

# 查看所有來源的精選
pnpm run c:skills:curated
```

輸出精選 skills 清單，含說明與安裝狀態：

```
精選 Skills（gstack）
─────────────────────────────────────
backend-patterns     ✓ 已安裝  — Node.js / Express 最佳實踐
api-design           ✓ 已安裝  — REST API 設計模式
deploy-plan          ✗ 未安裝  — 部署計劃生成
observe              ✗ 未安裝  — SLO / Alert 規則定義
```

### 步驟 5：設定 profile_overrides（選用）

若特定 profile 需要不同的 sources 設定：

```bash
# 編輯 profile 覆蓋設定
pnpm run d:profile work --edit
```

在 profile 設定中加入 `ai_sources` 覆蓋：

```json
{
  "profile": "work",
  "ai_sources": ["ecc", "anthropic", "security-guidance"],
  "costRouting": "standard"
}
```

切換 profile 時，`c:ai-sync` 會自動使用對應的 sources 設定。

### 步驟 6：驗證安裝結果

```bash
# 確認 skills 已安裝
pnpm run c:skills -- --list

# 驗證資源結構完整性
pnpm run c:validate
```

`c:validate` 輸出各來源的安裝完整性報告，標記缺漏或 SHA 不符的檔案。

## 預期結果

- `~/.claude/skills/` 包含選定來源的所有 skills
- `~/.claude/commands/` 包含對應 commands
- `c:validate` 報告全部通過，無安全警告

## 常見問題

**Q：同步後 skills 沒有出現在 Claude Code 怎麼辦？**
A：重啟 Claude Code session，新安裝的 skills 在下次 session 啟動時才載入。

**Q：同步失敗，報 SHA 校驗錯誤？**
A：外部 source 可能有更新但 manifest 未同步，執行 `c:ai-sync -- --force` 強制重新下載。

**Q：我自訂了某個 skill，`c:ai-sync --all` 會覆蓋嗎？**
A：已在 `state.json` 標記為 `locked` 的資源不會被覆蓋。執行 `c:ai-sync -- --lock <skill-name>` 鎖定。

**Q：curatedResources 和一般 skills 有什麼差別？**
A：curatedResources 是各 source 維護者精選的高品質 subset，品質把關更嚴格，適合初次安裝時優先選擇。
