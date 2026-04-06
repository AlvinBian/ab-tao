# ab-tao 最終優化清單

> 綜合 Anthropic 官方文檔（costs、context-window、hooks-guide、statusline、
> how-claude-code-works、memory、skills、best-practices）、
> GitHub 項目（ECC 142K⭐、GSD 48K⭐、MemStack 226⭐、Squeez、Claude Launchpad、claudetop）、
> 社區文章（知乎最佳實踐、Academy、ai-codex）的最終可執行清單。

## 已完成 ✅

| # | 項目 | 效果 |
|---|------|------|
| 1 | Rules 遷移（8→4 個精簡 + 2 個→skills） | -21KB/session |
| 2 | Agent 描述 ≤150 字 | -70% 描述量 |
| 3 | Skill 分類（disable-model-invocation/context:fork/paths） | 按需載入 |
| 4 | CLAUDE.md 八大模塊 + 壓縮指令 | 品質↑ |
| 5 | .claudeignore 自動生成 | 減少掃描 |
| 6 | 預索引生成（ai-codex 模式） | -40K token/repo |
| 7 | Hook 過濾 test/build 輸出 | 省命令輸出 token |
| 8 | Plugin 格式適配 | 官方生態 |
| 9 | Report 補全（Token 圖 + 清理面板） | 可視化 |
| 10 | Status 使用監控 + 30天清理 | 可管理 |
| 11 | Plugin 推薦安裝 | 增強能力 |
| 12 | 備份合併 + Plugin 並行 + 預生成合併 | 流程優化 |
| 13 | phase-execute 拆分 3 子模組 | 可維護 |
| 14 | setup.mjs 提取重複 | 消除冗餘 |
| 15 | phase-plan 顯示拆分 | 職責清晰 |
| 16 | deploy-index 深度限制 + SKIP_DIRS | 防卡死 |
| 17 | symlink 路徑穿越防護 | 安全 |
| 18 | source-sync 路徑 encode | 安全 |
| 19 | 95 tests（+98%）| 覆蓋↑ |
| 20 | 三層推薦系統（RTK + Claude-Mem + 官方 Plugins + 增強） | 編排最佳輪子 |
| 21 | deprecated commands（5 個）+ agents（8 個） | 減少維護量 |
| 22 | RTK 偵測 + fallback | 自動互斥 |
| 23 | statusline 預設配置 | 即時監控 |

## 待執行（按 ROI 排序）

### Tier 1：Token 直接節省（高 ROI，每個 <1h）

| # | 項目 | 來源 | 效果 | 實施方式 |
|---|------|------|------|----------|
| **T1** | 通用 Bash 輸出壓縮 | Squeez + 官方 Costs | **-50~95% 命令輸出** | 擴展 filter-output.sh：去重行（≥3行相同→合併）、截斷（>200行→頭50+尾50）、移除 ANSI 色碼、移除空行 |
| **T2** | PreCompact hook 注入必保留 context | 官方 Hooks Guide | compact 不丟信息 | 建立 hooks/pre-compact.sh：echo 最近改動文件 + 未完成任務 + 關鍵決策 |
| **T3** | SessionStart compact 重注入 | 官方 Hooks Guide | 跨 compact 持續 | matcher: "compact"，echo 上次會話摘要（git log -5 + TASKS.md） |
| **T4** | Statusline 預設配置 | 官方 Statusline | 即時監控 context | 建立 ~/.claude/statusline.sh：模型 + context% bar + cost + git branch |
| **T5** | PostToolUse Bash 命令日誌 | 官方 Hooks Guide | 精準使用監控 | jq '.tool_input.command' >> ~/.claude/command-log.txt |

### Tier 2：精準度與便捷性提升（中 ROI）

| # | 項目 | 來源 | 效果 | 實施方式 |
|---|------|------|------|----------|
| **T6** | SessionStart 會話摘要注入 | Squeez + MemStack | 跨會話連續性 | 在 SessionStart startup matcher 中 echo 上次 session 的改動文件 + 決策 |
| **T7** | Stop hook 任務完成驗證 | 官方 Hooks Guide | 確保品質 | type: prompt，檢查任務是否完成，帶 stop_hook_active 防無限循環 |
| **T8** | PermissionRequest auto-approve ExitPlanMode | 官方 Hooks Guide | 減少中斷 | PermissionRequest matcher: ExitPlanMode，return allow |
| **T9** | Token 預算 80% 警報 | Squeez + claudetop | 避免爆滿 | Stop hook 檢查 context_window.used_percentage，>80% 建議 /compact |
| **T10** | InstructionsLoaded hook 日誌 | 官方 Hooks Guide | 調試載入 | 記錄哪些 CLAUDE.md/rules 被載入，排查遺漏 |

### Tier 3：架構與生態（低 ROI，長期價值）

| # | 項目 | 來源 | 效果 |
|---|------|------|------|
| **T11** | 配置評分系統 | Claude Launchpad | doctor 增強 |
| **T12** | build-plugin.sh git fetch 快取（1h TTL） | 性能分析 | 省 2-4s/次 |
| **T13** | Plugin 打包 concurrent: 2 | 性能分析 | 2 個 shell 並行 |
| **T14** | status.mjs 拆分（1091行） | 健康掃描 | 可維護 |
| **T15** | upgrade.mjs 拆分（430行） | 架構審查 | 可維護 |

## Setup 後配置清單

`pnpm run d:setup` 完成後，以下配置自動生效：

### 自動部署的
- ✅ Commands（29）+ Agents（24）+ Rules（4 精簡）+ Skills（4）
- ✅ hooks.json（PreToolUse 過濾 + PostToolUse 格式化 + Stop 通知 + ...）
- ✅ settings.json（permissions + env + autoMemory）
- ✅ CLAUDE.md（八大模塊 + 壓縮指令）per repo
- ✅ .claudeignore per repo
- ✅ 預索引 .claude/index/ per repo
- ✅ Plugin 打包 → dist/release/

### 需要 setup 加入的（Tier 1-2）
- [ ] statusline.sh 自動部署到 ~/.claude/
- [ ] pre-compact.sh 自動部署到 ~/.claude/hooks/
- [ ] session-start.sh 自動部署到 ~/.claude/hooks/
- [ ] command-log hook 加入 hooks.json
- [ ] ExitPlanMode auto-approve 加入 hooks.json
- [ ] 通用輸出壓縮整合到 filter-output.sh

## Context Window 加載順序（官方）

```
1. System prompt                        ~4,200 tokens (hidden)
2. Auto memory (MEMORY.md)              ~680 tokens
3. Environment info                     ~280 tokens
4. MCP tools (deferred, names only)     ~120 tokens
5. CLAUDE.md files (all layers)         依大小
6. .claude/rules/*.md (無 paths 的)      依大小
7. Skill descriptions (名稱+描述)        ~1% context window
8. Agent descriptions (名稱+描述)        依數量
9. Git status + recent commits          ~500 tokens
--- 以上為啟動時自動載入 ---
10. 用戶對話                             每條消息
11. 工具輸出（file reads, bash output）   最大消耗者
12. .claude/rules/*.md (有 paths 的)     按需
13. Skill 完整內容                       調用時
14. 子目錄 CLAUDE.md                     訪問時
```

## Token 預算控制目標

| 項目 | 目標 | 當前 |
|------|------|------|
| Rules（無條件載入） | <2KB | ~4KB（4 個精簡） |
| CLAUDE.md | <200 行 | ✅ 已限制 |
| Skill 描述總量 | <1% context | ✅ |
| Agent 描述 | 每個 <150 字 | ✅ |
| 命令輸出（Hook 壓縮後） | <200 行 | 待做 T1 |
| 基礎 context 消耗 | <10KB | ~12KB |
