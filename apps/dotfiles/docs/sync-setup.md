# ~/.claude/ 跨機器同步設定（Phase 4）

## 工具選擇

| 工具 | 適用場景 | 特色 |
|---|---|---|
| **chezmoi**（推薦）| 多機 Mac 同步 | 三路 diff、Age 加密、模板化 |
| **ab-tao 內建**（預設）| 單機 / 初始部署 | `d:setup` 直接管理 |
| **yadm** | Git 熟悉者 | `.gitattributes` 加密 |

## chezmoi 快速設定

### 1. 安裝

```bash
brew install chezmoi
```

### 2. 初始化（首次）

```bash
chezmoi init
```

### 3. 加入 ~/.claude/ 管理範圍

```bash
# 加入 managed 目錄（依 state.json sync.included）
chezmoi add ~/.claude/CLAUDE.md
chezmoi add ~/.claude/claude-md/
chezmoi add ~/.claude/rules/
chezmoi add ~/.claude/docs/
chezmoi add ~/.claude/agents/
chezmoi add ~/.claude/commands/
chezmoi add ~/.claude/skills/
chezmoi add ~/.claude/hooks/
chezmoi add ~/.claude/memory/preferences/
chezmoi add ~/.claude/memory/patterns/
chezmoi add ~/.claude/settings.json

# 排除不 sync 的路徑（已在 .chezmoiignore 設定）
```

### 4. `.chezmoiignore` 設定

在 `~/.local/share/chezmoi/dot_claude/` 同層建立 `.chezmoiignore`：

```
# 本機狀態（不 sync）
.ab-tao/
projects/
plugins/cache/
plugins/data/
sessions/
memory/archive/
_archive/
statsig/
todos/
image-cache/
history.jsonl
settings.local.json
```

### 5. 更新 state.json sync.tool

```bash
# 告知 ab-tao 改用 chezmoi 管理 sync
node -e "
const fs = require('fs');
const p = '$HOME/.claude/.ab-tao/state.json';
const s = JSON.parse(fs.readFileSync(p));
s.sync.tool = 'chezmoi';
fs.writeFileSync(p, JSON.stringify(s, null, 2));
"
```

### 6. 套用至新機器

```bash
chezmoi init --apply <your-git-repo-url>
```

## Age 加密（敏感檔案）

對含 API key 的檔案加密後再 sync：

```bash
brew install age
chezmoi age-keygen > ~/.config/chezmoi/key.txt

# 在 chezmoi source 標記加密
chezmoi add --encrypt ~/.claude/settings.local.json
```

在 `~/.config/chezmoi/chezmoi.toml`：

```toml
encryption = "age"

[age]
identity = "~/.config/chezmoi/key.txt"
recipients = [ "age1..." ] # 你的 age public key
```

## 注意事項

- `memory/` 個人記憶由使用者自管，ab-tao **絕不覆蓋**
- `projects/` 是每機器獨立的 session state，不 sync
- 切換 sync.tool 後 `d:setup` 會偵測並跳過已由 chezmoi 管理的檔案
