# 個人 / Startup 使用情境

適用對象：獨立開發者或 startup 早期成員，強調快速迭代、成本意識、輕量工作流。

## 前置需求

1. ab-tao `d:setup` 已完成
2. 建議選擇 `day-to-day` 或 `spike` profile
3. iCloud 同步已啟用（`d:prefs-sync` 跑過一次）

## 完整步驟

### 步驟 1：啟動與 profile 切換

```bash
# 查看目前 active profile
pnpm run d:status

# 切換到輕量個人開發 profile
pnpm run d:profile day-to-day

# 探索型 spike（關掉嚴格閘，快速驗證想法）
pnpm run d:profile spike
```

profile 差異：

| profile | 適用場景 | TDD 嚴格模式 | Cost routing |
|---|---|---|---|
| `day-to-day` | 日常開發 | 關閉 | frugal（省錢） |
| `spike` | PoC / 快速驗證 | 關閉 | frugal |
| `personal` | 個人工具 / 副業 | 關閉 | frugal |

### 步驟 2：frugal cost routing 設定

`day-to-day` profile 預設啟用 frugal routing：輕量任務自動路由到較便宜的模型。

確認設定：

```bash
# 確認 settings.json 中 costRouting 欄位
cat ~/.claude/settings.json | grep costRouting
```

預期輸出：`"costRouting": "frugal"`

### 步驟 3：/ai dispatcher 快速導航

不確定該用哪個命令或 agent 時，用 `/ai` dispatcher：

```bash
/ai 我想快速審查這段 code 的安全性
/ai 幫我生成一份 README
/ai 這個 bug 怎麼調試
```

`/ai` 根據 30+ intent 映射自動路由到對應命令或 agent，省去記憶所有指令的時間。

### 步驟 4：memory lint 保持輕量

個人 memory 容易累積過時條目，定期清理：

```bash
# 查看目前 memory 狀態
pnpm run c:memory --list

# 手動在 Claude Code 中觸發 lint
# 在 session 中輸入：「清理過時記憶」
```

建議每兩週掃描一次，保持 `MEMORY.md` ≤ 15 項。

### 步驟 5：快速發布流程

個人專案發布簡化版：

```bash
# 省略 reviewer agent，直接品質閘
/check

# 建立 changeset
pnpm run changeset

# 發版
pnpm run version && git push
```

## 預期結果

- profile 切換後，Claude 自動使用對應的 cost routing
- `/ai` dispatcher 幫助快速找到對應工具
- memory 保持整潔，不累積無效條目

## 常見問題

**Q：frugal routing 會影響輸出品質嗎？**
A：簡單任務（生成 README、格式調整）幾乎無影響。複雜架構設計建議臨時切到 `work` profile。

**Q：spike profile 下 `/check --gates` 還能跑嗎？**
A：可以，但 tddStrictMode 閘會跳過。需要嚴格閘時手動加 `--force-strict`。

**Q：iCloud 同步失敗怎麼辦？**
A：執行 `pnpm run d:prefs-sync --debug` 查看同步詳情，確認 iCloud Drive 掛載正常。

**Q：memory 太多怎麼快速清理？**
A：在 Claude Code 輸入「幫我做 memory decay scan，90 天未存取的條目列出來」。
