# failure-catalog

append-only 錯誤模式累積系統，session 結束時自動抽取糾正信號並寫入目錄，作為長期自我改進依據。

## 觸發場景

- session 中使用者回應「不對」、「重來」、「應該是 X 不是 Y」→ session-end hook 自動抽取並記錄
- 月度 dedupe cron 執行，合併重複 pattern 並產生可操作的改進建議
- `pnpm run c:failure-patterns --dedupe` 手動觸發清理，移除語義重複的條目

## Usage

```bash
# 查看累積的失敗模式記錄
cat ~/.claude/.ab-tao/corrections/failure-patterns.md

# 手動觸發 dedupe（移除語義重複條目）
pnpm run c:failure-patterns --dedupe

# 查看統計摘要（條目數 / 最近 30 天 / top 5 pattern 類型）
pnpm run c:failure-patterns --stats

# 匯出為 JSON 格式
pnpm run c:failure-patterns --export --format json
```

`failure-patterns.md` 格式範例：
```markdown
## 2026-04-27

### P-0042 版本假設錯誤
- **觸發**：使用者說「應該是 Vue 3 語法，你給的是 Vue 2」
- **糾正信號**：在無 package.json 上下文時，不得假設 Vue 版本
- **規則映射**：03-code-standards.md § 版本管理
- **狀態**：active

---
```

**強制紅線**：`15-self-correction.md` 規則本體永遠不被修改。`failure-patterns.md` 僅作補充累積，不覆蓋、不替換任何既有規則檔案。所有改進建議以 ADR（Architecture Decision Record）形式提交人工審核後才能更新規則本體。

## Troubleshoot

**`failure-patterns.md` 不存在**
目錄尚未初始化。執行一次 `pnpm run d:setup` 或手動建立：
```bash
mkdir -p ~/.claude/.ab-tao/corrections
touch ~/.claude/.ab-tao/corrections/failure-patterns.md
```

**dedupe 後條目數未減少**
表示現有條目語義差異足夠大，無重複。若懷疑誤判，加 `--dry-run` 預覽：
```bash
pnpm run c:failure-patterns --dedupe --dry-run
```

**session-end hook 未自動抽取**
確認 hook 已啟用：`pnpm run d:hooks --list | grep session-end`。若狀態為 disabled，執行 `pnpm run d:hooks --enable session-end`。

## Uninstall

```bash
pnpm run d:uninstall --feature failure-patterns
```

移除後：session-end 糾正信號抽取停用；`failure-patterns.md` 檔案保留，不自動刪除。
