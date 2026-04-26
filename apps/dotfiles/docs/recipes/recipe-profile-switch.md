# Recipe：在 Profile 之間切換

## 1. 目標

在 7 個預設 profile 之間切換，快速適配不同工作場景（開發、審查、寫文件、除錯等），避免每次手動調整設定。

## 2. 前置條件

- `pnpm run d:setup` 已完成，profile 系統已初始化
- `~/.claude/.ab-tao/state.json` 存在（首次 setup 後自動產生）
- 了解目標 profile 的用途（可透過 `--list` 查看說明）

## 3. 步驟

1. **列出所有可用 profile**

   ```bash
   pnpm run d:profile --list
   ```

   輸出範例：

   ```
   Available profiles:
     default     — 通用開發（預設）
     review      — 程式碼審查模式（載入 reviewer + check gates）
     debug       — 除錯模式（載入 debugger agent + verbose output）
     write       — 文件撰寫模式（關閉 lint hook，強化語言輸出）
     spec        — 需求分析模式（載入 pm agent + specify command）
     minimal     — 最小化模式（僅核心工具，適合低 context 場景）
     infra       — 基礎設施模式（載入 db-migration + deploy-plan skills）
   ```

2. **切換至目標 profile**

   ```bash
   pnpm run d:profile <profile-name>
   ```

   範例：切換至除錯模式

   ```bash
   pnpm run d:profile debug
   ```

3. **確認 profile 已生效**

   ```bash
   # 查看 state.json 中的 activeProfile
   cat ~/.claude/.ab-tao/state.json | grep activeProfile
   ```

   預期輸出：

   ```json
   "activeProfile": "debug"
   ```

4. **（選擇性）確認設定差異**

   ```bash
   pnpm run d:status
   ```

   `d:status` 儀表板會顯示當前 profile 與啟用的 agent / skill / hook 清單。

5. **切換回預設 profile**

   ```bash
   pnpm run d:profile default
   ```

## 4. 驗證

- `~/.claude/.ab-tao/state.json` 的 `runtime.activeProfile` 值與目標 profile 一致
- `pnpm run d:status` 顯示 `Active profile: <name>`
- 新開 Claude Code session 後，對應的 agent / skill 已自動載入

## 5. 相關資源

- [`docs/sync-setup.md`](../sync-setup.md) — 同步與設定說明
- [`claude-md/10-config-management.md`](~/.claude/claude-md/10-config-management.md) — 設定優先級規則
- [`claude-md/13-agent-routing.md`](~/.claude/claude-md/13-agent-routing.md) — Agent 調度規則
