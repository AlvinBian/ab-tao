# ai-dispatcher

rule-based 意圖映射 dispatcher，輸入自然語言意圖 → 輸出對應命令，無需記憶特定命令名稱。

## 觸發場景

- 使用者輸入 `/ai "PR review"` → dispatcher 映射至 `/verify`，自動執行
- 使用者輸入 `/ai "釐清需求"` → 映射至 `/specify`，進入需求結構化流程
- 使用者輸入 `/ai "unit test"` → 映射至 `/test`，自動偵測框架並生成測試

## Usage

```bash
# 基本意圖觸發
pnpm run /ai "PR review"         # → /verify
pnpm run /ai "釐清需求"          # → /specify
pnpm run /ai "unit test"         # → /test
pnpm run /ai "stack PR 狀態"     # → /pr-stack
pnpm run /ai "build 壞了"        # → /check
pnpm run /ai "部署計劃"          # → /deploy-plan
pnpm run /ai "發 Slack"          # → /slack

# 查看 intent cache（30 天命中記錄）
cat ~/.claude/.ab-tao/runtime/intent-cache.json

# 清空 intent cache
pnpm run d:hooks --clear-intent-cache
```

intent-cache.json 位置：`~/.claude/.ab-tao/runtime/intent-cache.json`

intent-cache.json 格式範例：
```json
{
  "entries": [
    {
      "input": "PR review",
      "resolved": "/verify",
      "ts": "2026-04-27T10:00:00Z",
      "hit": true
    }
  ],
  "lastPurge": "2026-04-01T00:00:00Z"
}
```

## Troubleshoot

**意圖未命中（unmatched）**
dispatcher 找不到對應命令時，回傳候選清單並詢問使用者確認。未命中記錄累積至 `intent-cache.json` 的 `unmatched` 陣列；若 30 天內 unmatched ≥ 30 條，觸發 v1.7+ 機器學習升級提示。

**命令存在但未觸發**
確認 `~/.claude/.ab-tao/runtime/intent-cache.json` 是否可寫入（`ls -la ~/.claude/.ab-tao/runtime/`）。若目錄不存在，執行 `pnpm run d:setup` 重建 runtime 目錄。

**誤觸發至錯誤命令**
在 `settings.json._abTao.intentOverrides` 新增覆蓋規則：
```json
{
  "_abTao": {
    "intentOverrides": {
      "PR review": "/pr-stack"
    }
  }
}
```

## Uninstall

```bash
pnpm run d:uninstall --feature ai-dispatcher
```

移除後：dispatcher hook 停用，`/ai` 命令失效；intent-cache.json 保留於 `~/.claude/.ab-tao/runtime/`，不自動刪除。
