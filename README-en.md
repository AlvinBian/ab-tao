[繁體中文](README.md) | [简体中文](README-zh-CN.md) | **English**

# ab-tao

Turborepo monorepo — unified development environment management + shared resource library.

## What is this

**ab-tao** is a development environment automation toolkit that solves the pain of "having to reconfigure everything on every new machine or project." Currently focused on Claude Code ecosystem integration, with more features to be added over time.

Core capabilities:

- **One-click deployment** — Interactive installation wizard that automatically sets up developer tools, ZSH environment, and AI resource sync
- **Tech-stack awareness** — Scans your GitHub repos, uses AI to classify tech stacks, and installs only matching tools and configs
- **AI resource pool** — Integrates community and official AI sources with version tracking + security validation; sync to latest with a single command
- **Quick reference sheet** — Claude Code Traditional Chinese edition, auto-synced daily and deployed to GitHub Pages
- **Web console** — Vue 3 admin GUI for visually managing configs, memory, resources, and actions

Typical use cases:

```
New machine / new job / setting up for a friend → pnpm run d:setup → full dev environment in 10 minutes
Keep AI resources up to date                   → pnpm run c:ai-sync --all → stay current on all tools
Look up Claude Code shortcuts                   → open https://alvinbian.github.io/ab-tao/
Manage configs and memory                       → pnpm run cs:open → open the Web console
```

## Core Advantages

### Smart installation wizard — more than just "copying configs"

- **Tech-stack detection** — Static feature scanning + package.json dependency analysis + confidence scoring for accurate detection
- **AI auto-classification** — Generates tags and tech categories for each repo, processed in parallel with cached results to avoid redundant costs
- **Auto role assignment** — Automatically classifies repos as primary / temporary / utility based on commit count
- **Resumable installation** — Detects previously incomplete installs and supports item-by-item recovery

### Security validation — never trust external resources

When syncing external resources, all files go through multi-layer validation: dangerous pattern blocking, hidden character scanning, SHA256 checksum tracking, and atomic replacement (auto-rollback on failure).

### Version-locked resource sync

- Identical SHA is automatically skipped — no pointless syncs
- `locked` state completely freezes a version; upgrading requires an explicit unlock
- Supports `--pick ecc,superpowers` to sync only specified sources

### Compared to other dotfiles tools

| Dimension              | dotbot / chezmoi   | ab-tao                                               |
| ---------------------- | ------------------ | ---------------------------------------------------- |
| Tech-stack awareness   | ✗ generic configs  | ✓ AI analysis + static feature detection             |
| AI tool integration    | ✗                  | ✓ commands / agents / rules / hooks native support   |
| AI resource management | ✗                  | ✓ multi-source, version tracking, security validated |
| Role-differentiated    | ✗                  | ✓ main / temp / tool three-tier auto classification  |
| Security validation    | ✗                  | ✓ dangerous pattern blocking + SHA256                |
| Resumable install      | ✗                  | ✓ detects incomplete state, supports item recovery   |
| Web console            | ✗                  | ✓ Vue 3 GUI — config / memory / resources / actions  |

## Architecture

```
ab-tao/
├── apps/
│   ├── dotfiles/          @ab-tao/dotfiles — smart filtering, interactive install, dynamic config
│   └── console/           @ab-tao/console  — Vue 3 admin console (GUI management)
└── packages/
    ├── commons/           @ab-tao/commons  — pure resource pool: sync, validate, provide API
    └── share/             @ab-tao/share    — shared utilities (utils/libs)
```

Separation of concerns: `commons` only syncs resources → `dotfiles` filters by tech stack → installs only what matches.

### apps/dotfiles

- **Interactive installation wizard** — 5-phase deployment (env check → feature selection → analysis → confirmation → execution)
- **AI-driven tech-stack detection** — GitHub API + AI classification, dynamically matched by tech stack, installs only what's needed
- **Modular ZSH environment** — 7 modules (aliases, git, fzf, nvm, completion...)
- **Claude Code config generation** — commands + agents + rules + hooks

### apps/console

- **6-section IA** — Dashboard / Resources / Integrations / Configuration / Actions / About
- **Visual management** — config editing, memory browsing, AI resource status, hook management
- **Action execution** — GUI trigger interface for Setup / Scan / Sync / Restore
- **Offline mode** — `cs:open` opens as `file://` static build, no dev server needed

### packages/commons — AI resource sources

| Source                  | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| **ecc**                 | Claude Code community resources (commands/agents/rules/skills) |
| **anthropic**           | Anthropic official Skills                                |
| **superpowers**         | Claude Superpowers — advanced agent capabilities         |
| **context-engineering** | Context Engineering Skills (context optimization/compression/evaluation) |
| **skills-mp**           | Skills Marketplace — curated community skill packs       |
| **openskills**          | OpenSkills — open-source skill collection                |

## Tech Stack

- **Node.js 18+** / **pnpm 10+** — runtime
- **Turborepo** — task orchestration and caching
- **Biome** — formatting and lint
- **Changesets** — version management
- **Vue 3 + Vite** — console frontend framework
- **Element Plus** — console UI component library

## Quick Start

```bash
git clone https://github.com/AlvinBian/ab-tao.git
cd ab-tao
pnpm install
pnpm run build
pnpm run test
pnpm run help              # view all commands
```

## Commands

> Prefix convention: `d:` = dotfiles · `c:` = commons · `cs:` = console

### Global

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `pnpm run help`   | Command overview                     |
| `pnpm run build`  | Build all packages                   |
| `pnpm run test`   | Run tests                            |
| `pnpm run lint`   | Biome lint                           |
| `pnpm run format` | Format code                          |
| `pnpm run clean`  | Clean cache and node_modules         |

### d: dotfiles (interactive, requires TTY)

| Command                     | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `pnpm run d:setup`          | Interactive environment deployment + third-party tool recommendations |
| `pnpm run d:scan`           | Tech-stack scan + skill library generation       |
| `pnpm run d:setup --doctor` | Environment diagnostics (setup Phase 1)          |
| `pnpm run d:status`         | Config status dashboard                          |
| `pnpm run d:restore`        | Restore backup                                   |
| `pnpm run d:hooks`          | Hook management                                  |
| `pnpm run d:prefs-sync`     | Sync preferences to/from iCloud                  |
| `pnpm run d:chrome`         | Chrome bookmarks / settings sync                 |
| `pnpm run d:uninstall`      | Remove ab-tao                                    |

### cs: console (Web admin console)

| Command               | Description                                   |
| --------------------- | --------------------------------------------- |
| `pnpm run cs:dev`     | Vite + API dev server (development mode)      |
| `pnpm run cs:build`   | Build SPA                                     |
| `pnpm run cs:open`    | Build then open as file:// (offline mode)     |
| `pnpm run cs:serve`   | Start API server only                         |

### c: commons (AI resource sync)

| Command                       | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `pnpm run c:ai-sync`          | List AI sources and their status (no sync by default) |
| `pnpm run c:ai-sync --select` | Interactively select sources to sync                |
| `pnpm run c:ai-sync --all`    | Sync all sources                                    |
| `pnpm run c:skills`           | Claude Skills management (list/install/diff)        |
| `pnpm run c:validate`         | Validate resource structure + security check        |
| `pnpm run c:translate`        | Generate multi-language translations                |

Sync specific sources: `pnpm run c:ai-sync -- --pick ecc,superpowers`

### Versioning and release

```bash
pnpm run changeset        # create a changeset
pnpm run version          # bump version numbers
pnpm run release          # build + publish
```

## Documentation

### Core docs

| Document                                                 | Description                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| [CLAUDE.md](CLAUDE.md)                                   | Project commands, architecture overview, development guidelines    |
| [apps/dotfiles/README.md](apps/dotfiles/README.md)       | dotfiles sub-package — install wizard, commands, directory structure, changelog |
| [apps/console/README.md](apps/console/README.md)         | console sub-package — 6-section IA, charts, API server             |
| [packages/commons/README.md](packages/commons/README.md) | commons sub-package — AI resource sources, security validation, commands |

### Claude Code reference

| Resource                                                                      | Description                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------- |
| [Claude Code Quick Reference (Traditional Chinese)](https://alvinbian.github.io/ab-tao/) | Full quick reference sheet, auto-synced daily |
| [Original source cc.storyfox.cz](https://cc.storyfox.cz/)                    | English original, by @phasE89               |

### Integration guides

| Document                                                | Description                          |
| ------------------------------------------------------- | ------------------------------------ |
| [gmail-filters.md](apps/dotfiles/docs/gmail-filters.md) | Gmail auto-classification rules guide |

### Flowcharts (Mermaid)

Located at [`apps/dotfiles/docs/flows/`](apps/dotfiles/docs/flows/):

| Flowchart                                                                   | Description               |
| --------------------------------------------------------------------------- | ------------------------- |
| [setup-main.mmd](apps/dotfiles/docs/flows/setup-main.mmd)                   | Install wizard main flow  |
| [phase-plan.mmd](apps/dotfiles/docs/flows/phase-plan.mmd)                   | Planning phase flow       |
| [phase-execute.mmd](apps/dotfiles/docs/flows/phase-execute.mmd)             | Execution phase flow      |
| [ecc-pipeline.mmd](apps/dotfiles/docs/flows/ecc-pipeline.mmd)               | ECC resource sync pipeline |
| [env-check.mmd](apps/dotfiles/docs/flows/env-check.mmd)                     | Environment check flow    |
| [feature-map.mmd](apps/dotfiles/docs/flows/feature-map.mmd)                 | Feature landscape map     |
| [role-system.mmd](apps/dotfiles/docs/flows/role-system.mmd)                 | Role and permission system |
| [session-lifecycle.mmd](apps/dotfiles/docs/flows/session-lifecycle.mmd)     | Session lifecycle         |
| [repo-select.mmd](apps/dotfiles/docs/flows/repo-select.mmd)                 | Repository selection flow |
| [config-protection.mmd](apps/dotfiles/docs/flows/config-protection.mmd)     | Config protection mechanism |
| [setup-status.mmd](apps/dotfiles/docs/flows/setup-status.mmd)               | Install status tracking   |
| [slack-setup.mmd](apps/dotfiles/docs/flows/slack-setup.mmd)                 | Slack integration setup   |
| [upgrade-legacy.mmd](apps/dotfiles/docs/flows/upgrade-legacy.mmd)           | Legacy upgrade flow       |

## Recommended Third-Party Tools

After setup completes, the following tools will be recommended:

| Tool             | Install command                 | Description                                                    |
| ---------------- | ------------------------------- | -------------------------------------------------------------- |
| **RTK**          | `brew install rtk`              | Bash output compression -89%, auto-activates after install     |
| **Official Plugins** | Run `/plugin` in Claude Code | code-review · commit-commands · feature-dev · simplify     |
| **claude-hud** | Auto-deploy wrapper + inject plugin (during setup) | Claude Code statusline — Git status, Context usage, cost |

### claude-hud Statusline

[claude-hud](https://github.com/jarrodwatts/claude-hud) is a Claude Code statusline tool using the official plugin mechanism. When selecting "🤖 Claude Code configuration" during `pnpm run d:setup`, the following is automatically deployed:

1. Deploy `hud-wrapper.sh` → `~/.claude/plugins/claude-hud/hud-wrapper.sh`
2. Inject `extraKnownMarketplaces` + `enabledPlugins` into `~/.claude/settings.json`
3. **Restart Claude Code** after first deploy — plugin is auto-fetched from GitHub

Features:
- Git branch status (branch, dirty, ahead/behind)
- Claude model display
- Context window usage percentage
- Cost and session duration tracking

After installation, `~/.claude/settings.json` is automatically updated:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/plugins/claude-hud/hud-wrapper.sh"
  }
}
```

`hud-wrapper.sh` is a wrapper script that uses the plugin HUD as core output and appends Node.js / pnpm / Python version segments.

## GitFlow

Uses standard GitFlow branching strategy:

| Branch  | Naming format | Source  | Merges into    | Purpose                   |
| ------- | ------------- | ------- | -------------- | ------------------------- |
| Main    | `main`        | -       | -              | Production stable (protected) |
| Develop | `develop`     | main    | -              | Daily development trunk   |
| Feature | `feature/*`   | develop | develop        | New feature development   |
| Release | `release/v*`  | develop | main + develop | QA and release prep       |
| Hotfix  | `hotfix/*`    | main    | main + develop | Production bug fixes      |

> `main` branch is protected: only mergeable from `develop` or `release/*` via PR; direct pushes are not allowed.

```bash
# develop a new feature
git checkout develop && git checkout -b feature/xxx

# prepare a release
git checkout develop && git checkout -b release/v1.1.0

# emergency hotfix
git checkout main && git checkout -b hotfix/xxx
```

## CI/CD

| Workflow       | Trigger               | Description                                               |
| -------------- | --------------------- | --------------------------------------------------------- |
| **CI**        | push → main           | lint + build + test + resource sync validation           |
| **Git Flow**  | PR + push + tag       | branch validation + PR source check + commit check + Release |
| **Release**   | push → main           | auto-create Version PR + changeset tag + Release         |
| **Translate** | README.md change → main | auto-translate zh-CN + EN (requires `GH_PAT` secret)  |
| **Sync**      | Every Monday 03:00 UTC | auto-sync external AI resources                         |

### Required Secrets

The **Translate workflow** uses the [GitHub Models API](https://models.inference.ai.azure.com) and requires a PAT with `models` permission:

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
2. Create a new token, check the **Models** permission (read access)
3. Repo → Settings → Secrets and variables → Actions → add secret: `GH_PAT`

> The default `GITHUB_TOKEN` does not include `models` permission; you must configure `GH_PAT` separately.

## License

MIT
