# ab-tao Schema Registry (v1.0.0)

JSON Schema for all ab-tao config files. Validates with `c:validate --all-schemas`.

| Schema | 對應檔案 | 用途 |
|---|---|---|
| `state.schema.json` | `~/.claude/.ab-tao/state.json` | unified manifest |
| `plugins.schema.json` | `apps/dotfiles/claude/plugins.yml` | 宣告式 plugin 清單 |
| `mcp.schema.json` | `apps/dotfiles/claude/mcp.yml` | 宣告式 MCP 配置 |
| `profiles.schema.json` | `~/.claude/.ab-tao/profiles/*.yml` | per-profile overrides |
| `skill-frontmatter.schema.json` | `skills/*/SKILL.md` frontmatter | skill 品質規範 |

## 版本演進規則

- **minor bump**（加欄位）：自動升級，無需遷移
- **major bump**（breaking）：`state.json.version` 同步 bump + 需要 `d:migrate-state`

## 驗證

```bash
pnpm run c:validate --all-schemas   # 驗證所有 config 檔符合 schema
pnpm run c:validate --skills        # 單獨驗證 skill frontmatter
```
