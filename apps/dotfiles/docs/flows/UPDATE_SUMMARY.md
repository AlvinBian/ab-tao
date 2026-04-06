# 流程圖更新總結（v3 架構）

日期：2026-04-06

## 更新範圍

### 1. phase-execute.mmd — 完全重構（10 步 → 4 大執行組）

**舊版問題**：
- 8 步流程線性，未充分利用並行機制
- 備份重複邏輯（[1a] + [1b]）
- Plugin 打包與 Stacks 序列執行，可並行

**新版架構**：
```
Group A: Claude Code + 專案配置（寫 ~/.claude/）
  [1a] 備份 Claude
  [2]  全局配置
  [3]  Claude 安裝
  [4a] ECC 外部資源
  [4b] Stacks 生成（併行）
  [5]  CLAUDE.md 生成
  [6]  Plugin 打包（可併行）

Group B: ZSH 環境（與 A 併行）✓
  [1b] 備份 ZSH
  [7]  ZSH 模組安裝

Group C: 驗證 + 預索引（順序，依賴 A+B）
  [8]  .claudeignore 部署
  [9]  預索引生成
  [10] 驗證安裝完整性
```

**優勢**：
- 清晰展示並行策略
- 標示可優化點（✓ 符號）
- Frontmatter 列出現狀問題

### 2. setup-main.mmd — 微調（功能選擇 + AI 來源）

**變更**：
- ✅ Splash 由 "ab-dotfiles" → "ab-tao"
- ✅ 功能選擇移除 Gmail（已獨立）
- ✅ 加入 "AI 來源選擇" 步驟（ECC 同步來源）
- ✅ Frontmatter 描述 v3 更新內容

### 3. feature-map.mmd — 全面更新（6 功能 → 5 功能）

**變更**：
- ✅ 移除 Gmail 選擇框
- ✅ CLAUDE.md 加入 .claudeignore 自動生成
- ✅ ECC 加入「AI 來源選擇」節點
- ✅ Skills 標記分類（disable-model-invocation / context:fork / paths）
- ✅ 新增預索引生成步驟
- ✅ 新 v3 功能用綠色標記

### 4. 新增文件：OPTIMIZATION_ANALYSIS.md

完整分析文件，涵蓋：
1. **重複步驟** — [1a]+[1b] 備份可合併、[8]+[9] 驗證可合併
2. **可並行優化** — [4b] Stacks + [6] Plugin 耗時節省 10-20%
3. **代碼質量** — build-plugin.sh spinner 雙重輸出問題根因
4. **實施優先順序** — 高/中/低三層級建議
5. **影響評估表** — 耗時/改動/風險/測試覆蓋

## 核心發現

### 1. 最快修復：spinner 重複輸出（build-plugin.sh）
```bash
# 現狀：_spin_stop() 內部已輸出，調用方再次輸出 → 重複
# 影響：視覺混亂，難以追蹤進度
# 修復：改 _spin_stop() 只清除動畫，不輸出（10 行改動）
```

### 2. 最大效果：[4b] Stacks + [6] Plugin 並行化
```
耗時節省：10-20%（Stacks 生成 + Plugin 打包 ~30s 可並行）
代碼改動：40 行（重組 Group 1 結構）
風險等級：中（需測試並行副作用）
```

### 3. 架構優化：[8]+[9] 合併預生成步驟
```
耗時節省：5-10%（減少重複迭代）
代碼改動：30 行
風險等級：低
```

## 檔案清單

| 檔案 | 狀態 | 變更行數 |
|------|------|--------|
| phase-execute.mmd | ✅ 完成 | ~65（重構） |
| setup-main.mmd | ✅ 完成 | ~20（微調） |
| feature-map.mmd | ✅ 完成 | ~60（更新） |
| OPTIMIZATION_ANALYSIS.md | ✅ 新增 | 250+ |
| UPDATE_SUMMARY.md | ✅ 新增（本檔） | — |

## 如何使用

1. **查看流程圖**：用 Mermaid 渲染工具開啟 .mmd 檔案
   - GitHub Web UI 直接支持 Mermaid 預覽
   - VS Code 需 Markdown Preview Mermaid 插件
   - Online: https://mermaid.live/

2. **實施最佳化**：按 OPTIMIZATION_ANALYSIS.md 的優先順序
   - 高優先：spinner 修復 + [8]+[9] 合併
   - 中優先：[4b]+[6] 並行化
   - 低優先：runTarget 統一 + 架構重構

3. **驗證更新**：
   ```bash
   # 確保 .mmd 文件格式正確
   # 在 GitHub 上預覽或用 mermaid-cli 驗證
   npx @mermaid-js/mermaid-cli@latest phase-execute.mmd -o /tmp/test.svg
   ```

## 後續工作

- [ ] 實施 spinner 修復（build-plugin.sh）
- [ ] 實施 [8]+[9] 合併（phase-execute.mjs）
- [ ] 實施 [4b]+[6] 並行化（phase-execute.mjs）
- [ ] 更新對應測試用例
- [ ] 性能基準測試（before/after）
- [ ] 更新 CLAUDE.md 文檔

