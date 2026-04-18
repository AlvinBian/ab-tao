# Plans 與 Memory — Per-Project 存放慣例

## 目錄結構

Claude Code 的持久化資料統一存放於 per-project 根目錄，與全域 `~/.claude/` 分離：

```
~/.claude/projects/{encoded-project-path}/
  ├── memory/
  │   ├── MEMORY.md              根索引（每條 ≤ 150 char，指向子資料夾）
  │   └── {topic}/index.md       主題記憶
  └── plans/
      ├── index.md               Plan 目錄索引
      ├── {slug}.md              個別 plan
      └── archive/               封存（不屬於任何活躍週期的舊 plan）
          └── {slug}.md
```

**encoded-project-path**：把 CWD 的 `/` 替換為 `-`。  
範例：`/Users/alvin/ab-projects/ab-tao` → `-Users-alvin-ab-projects-ab-tao`

---

## Plans

### 新 plan 自動歸位

Claude Code plan-mode 會把 `.md` 寫到 `~/.claude/plans/`（原生行為無法更改）。  
`relocate-plan.sh` 在 **SessionEnd / Stop** 時自動把新增的 plan 搬到正確的 per-project 目錄，並更新 `plans/index.md`。

```
SessionEnd/Stop
  └─ ~/.claude/hooks/relocate-plan.sh
       ├── 讀 stdin JSON → 取出 CWD
       ├── 確認 CWD 有 .git（非 repo 跳過）
       ├── 掃描 ~/.claude/plans/*.md（排除 README.md、已追蹤）
       └── 搬到 ~/.claude/projects/{encoded}/plans/{slug}.md
           + 更新 plans/index.md
           + 寫入 ~/.claude/.plans-relocated 冪等標記
```

### 一次性 Migration

已有舊 plan 在 `~/.claude/plans/` 時，用互動式指令手動歸位：

```bash
pnpm run d:migrate-plans
# 或直接
node apps/dotfiles/bin/migrate-plans.mjs
# Dry-run（只預覽，不移動）
node apps/dotfiles/bin/migrate-plans.mjs --dry-run
```

每個檔案會詢問歸屬哪個專案，選項包含已知 `~/.claude/projects/` 子目錄、`archive`（封存）、`skip`（跳過）。

---

## Memory

Memory 使用**主題資料夾**組織，`MEMORY.md` 只存索引（每條一行，指向對應資料夾的 `index.md`）。

```markdown
# Memory Index

- [ab-tao Phase 進度](ab-tao-phases/index.md) — 一行摘要
- [Plans Per-Project 決策](plans-per-project/index.md) — H5 遷移方案與現狀
```

---

## Cold-start 口訣

開新 session 先讀：

1. `~/.claude/projects/{encoded}/memory/MEMORY.md` — 記憶索引
2. `~/.claude/projects/{encoded}/plans/index.md` — 當前 plan 進度

---

## 相關指令

| 指令 | 說明 |
|------|------|
| `pnpm run d:migrate-plans` | 互動式遷移 `~/.claude/plans/` 至 per-project |
| `pnpm run d:setup` | 重新部署（含 hook 腳本） |
| `pnpm run d:hooks` | Hook 管理（查看、切換） |
| `pnpm run d:uninstall` | 移除 ab-tao（含 relocate-plan.sh） |
