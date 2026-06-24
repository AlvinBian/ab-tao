# Recipe：精選安裝 Curated AI Resources

## 1. 目標

從多個 AI source（ECC、Anthropic、Superpowers、Context-Engineering 等）精選安裝 curated resources，只安裝符合當前技術棧的內容，避免噪訊。

## 2. 前置條件

- `pnpm install` 已完成，ab-tao monorepo 正常運作
- `pnpm run d:scan` 已執行，技術棧已掃描（確保篩選結果準確）
- 有網路連線（部分 source 需遠端拉取）

## 3. 步驟

1. **掃描當前技術棧**

   ```bash
   pnpm run d:scan
   ```

   輸出各專案偵測到的技術棧（Vue / Nuxt / TypeScript / PHP 等），作為後續篩選依據。

2. **查看 curated source 可用資源**

   ```bash
   pnpm run c:skills:curated --from gstack
   ```

   列出 gstack（或其他 source）提供的所有 skill，含分類、描述、版本。

   若要查看全部 source：

   ```bash
   pnpm run c:ai-sync
   ```

3. **互動式選擇要安裝的資源**

   ```bash
   pnpm run c:ai-sync --select
   ```

   進入互動介面：
   - 使用方向鍵 / 空白鍵選取要安裝的 source
   - 確認後依技術棧自動篩選，只安裝匹配的 skill / rule / agent

4. **（選擇性）安裝全部 source**

   ```bash
   pnpm run c:ai-sync --all
   ```

   ⚠️ 此指令安裝所有可用 source，建議先用 `--select` 精選。

5. **驗證安裝結果**

   ```bash
   pnpm run c:skills
   ```

   列出目前已安裝的所有 skill，確認新安裝的資源出現在清單中。

6. **重新部署至 `~/.claude/`**

   ```bash
   pnpm run d:setup
   ```

   確保新安裝的 skill 同步至 Claude Code 設定。

## 4. 驗證

- `pnpm run c:skills` 輸出中含新安裝的 skill 名稱
- `~/.claude/skills/` 目錄下有對應的 `.md` 文件
- `pnpm run d:status` 顯示 skills 數量已更新

## 5. 相關資源

- [`docs/sync-setup.md`](../sync-setup.md) — 同步設定說明
- [`claude-md/10-config-management.md`](~/.claude/claude-md/10-config-management.md) — 設定管理規則
- [`claude-md/07-context-hygiene.md`](~/.claude/claude-md/07-context-hygiene.md) — 條件載入規則
