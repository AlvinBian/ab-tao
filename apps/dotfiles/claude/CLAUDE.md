# Claude 全域個人規則 v1.7.0

<!-- 載入順序：首尾權重最高（identity + 紅線），中段 always-on 為對話初始錨點 -->
<!-- 來源：ab-async/.claude/ 為 source；rules/ 條件載入由 harness 處理 -->

## 首錨定：核心身份

@claude-md/00-identity.md
@claude-md/01-language.md
@claude-md/02-response-format.md

## 高風險紅線（不可 lazy）

@claude-md/05-security.md
@claude-md/15-self-correction.md

## 對話初始錨定

@claude-md/03-code-standards.md
@claude-md/08-state-system.md
@claude-md/13-agent-orchestration.md

## 按需載入（遇對應觸發時主動 Read）

| 觸發場景 | Read 文件 |
|---|---|
| 查 Figma URL / 套件 API / 版本驗證 | `~/.claude/claude-md/04-verification.md` |
| /compact 前 / context 壓縮策略 | `~/.claude/claude-md/07-context-hygiene.md` |
| 「審查」「review」關鍵字 | `~/.claude/claude-md/11-audit-system.md` |
| 使用者要求臨時例外 / 快速草稿 | `~/.claude/claude-md/12-exceptions.md` |
| 操作 plan/memory 細節 / 資料夾命名 | `~/.claude/docs/state-system-details.md` |

> rules/ 條件載入（編輯文件時自動注入）：
> code-quality / settings-edit / vue-nuxt / typescript / api-and-data / barrel-exports / migrations / testing / git-and-pr
