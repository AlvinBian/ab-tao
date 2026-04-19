[繁體中文](README.md) | **简体中文** | [English](README-en.md)

# ab-tao

Turborepo monorepo — 开发环境统一管理 + 共用资源库。

## 这是什么

**ab-tao** 是一套开发环境自动化工具，解决「每台机器、每个项目都要重新设置一遍」的痛点。目前以 Claude Code 生态整合为主，后续会持续扩充更多功能。

核心能力：

- **一键部署** — 交互式安装向导，自动完成开发工具配置、ZSH 环境、AI 资源同步
- **技术栈感知** — 扫描你的 GitHub repos，用 AI 分类技术栈，只安装匹配的工具与配置
- **AI 资源池** — 整合社区与官方 AI 来源，版本追踪 + 安全验证，一条命令同步到最新
- **快速参考表** — Claude Code 繁体中文版，每日自动同步，部署到 GitHub Pages

典型使用场景：

```
新机器 / 换工作 / 帮朋友设置 → pnpm run d:setup → 10 分钟搞定全套开发环境
定期更新 AI 资源             → pnpm run c:ai-sync --all → 保持所有工具最新
查 Claude Code 快捷键        → 打开 https://alvinbian.github.io/ab-tao/
```

## 核心优势

### 智能安装向导，不只是「复制配置」

- **技术栈检测** — 静态特征扫描 + package.json 依赖分析 + 置信度评分，确保检测准确
- **AI 自动分类** — 为每个 repo 生成标签与技术分类，并行处理，结果缓存避免重复费用
- **角色自动判定** — 依 commit 数自动分为主力 / 临时 / 工具三层配置
- **断点续装** — 检测上次未完成的安装，支持逐项恢复

### 安全验证，不信任外部资源

同步外部资源时，所有文件通过多层验证：危险模式拦截、隐藏字符扫描、SHA256 校验和追踪、原子替换（失败自动回滚）。

### 版本锁定的资源同步

- SHA 相同自动跳过，不做无意义的同步
- `locked` 状态完全冻结版本，升级需要明确解锁
- 支持 `--pick ecc,superpowers` 只同步指定来源

### 对比其他 dotfiles 工具

| 维度           | dotbot / chezmoi | ab-tao                                       |
| -------------- | ---------------- | -------------------------------------------- |
| 技术栈感知     | ✗ 通用配置       | ✓ AI 分析 + 静态特征检测                     |
| AI 工具整合    | ✗                | ✓ commands / agents / rules / hooks 原生支持 |
| AI 资源管理    | ✗                | ✓ 多来源、版本追踪、安全验证                 |
| 角色差异化配置 | ✗                | ✓ main / temp / tool 三层自动分级            |
| 安全验证       | ✗                | ✓ 危险模式拦截 + SHA256                      |
| 断点续装       | ✗                | ✓ 检测未完成状态，支持逐项恢复               |

## 架构

```
ab-tao/
├── apps/
│   └── dotfiles/          @ab-tao/dotfiles — 智能筛选、交互安装、动态配置
└── packages/
    ├── commons/           @ab-tao/commons  — 纯资源池：同步、验证、提供 API
    └── share/             @ab-tao/share    — 共用工具库（utils/libs）
```

职责分离：`commons` 只同步资源 → `dotfiles` 按技术栈筛选 → 只安装匹配的。

### apps/dotfiles

- **交互式安装向导** — 5 阶段部署（环境检查 → 功能选择 → 分析 → 确认 → 执行）
- **AI 驱动技术栈检测** — GitHub API + AI 分类，按技术栈动态匹配，只安装需要的
- **ZSH 模块化环境** — 7 个模块（aliases, git, fzf, nvm, completion...）
- **Claude Code 配置生成** — commands + agents + rules + hooks

### packages/commons — AI 资源来源

| 来源                    | 说明                                                 |
| ----------------------- | ---------------------------------------------------- |
| **ecc**                 | Claude Code 社区资源（commands/agents/rules/skills） |
| **anthropic**           | Anthropic 官方 Skills                                |
| **superpowers**         | Claude Superpowers — 高级 agent 能力                 |
| **context-engineering** | Context Engineering Skills（context 优化/压缩/评估） |

## 技术栈

- **Node.js 18+** / **pnpm 10+** — 运行环境
- **Turborepo** — 任务编排与缓存
- **Biome** — 格式化与 lint
- **Changesets** — 版本管理

## 快速开始

```bash
git clone https://github.com/AlvinBian/ab-tao.git
cd ab-tao
pnpm install
pnpm run build
pnpm run test
pnpm run help              # 查看所有命令
```

## 命令

> 简称规则：`d:` = dotfiles · `c:` = commons

### 全局

| 命令              | 说明                    |
| ----------------- | ----------------------- |
| `pnpm run help`   | 命令总览                |
| `pnpm run build`  | 构建所有包              |
| `pnpm run test`   | 执行测试                |
| `pnpm run lint`   | Biome lint              |
| `pnpm run format` | 格式化                  |
| `pnpm run clean`  | 清理缓存与 node_modules |

### d: dotfiles（交互式，需 TTY）

| 命令                   | 说明                            |
| ---------------------- | ------------------------------- |
| `pnpm run d:setup`     | 交互式环境部署 + 第三方工具推荐 |
| `pnpm run d:scan`      | 技术栈扫描 + 技能库生成         |
| `pnpm run d:setup --doctor` | 环境诊断                   |
| `pnpm run d:status`    | 配置状态仪表板                  |
| `pnpm run cs:open`     | Web 後台控制台（已取代 HTML Dashboard）|
| `pnpm run d:restore`   | 还原备份                        |
| `pnpm run d:hooks`      | Hook 管理                      |
| `pnpm run d:prefs-sync` | iCloud 偏好档同步              |
| `pnpm run d:uninstall`  | 移除 ab-tao                    |

### c: commons（AI 资源同步）

| 命令                          | 说明                                |
| ----------------------------- | ----------------------------------- |
| `pnpm run c:ai-sync`          | 列出 AI 来源与状态（默认不同步）    |
| `pnpm run c:ai-sync --select` | 交互式选择同步                      |
| `pnpm run c:ai-sync --all`    | 同步全部来源                        |
| `pnpm run c:skills`           | Claude Skills 管理（--list / --install / --find） |
| `pnpm run c:validate`         | 验证资源结构 + 安全检查             |
| `pnpm run c:translate`        | 多语系翻译生成                      |

指定同步：`pnpm run c:ai-sync -- --pick ecc,superpowers`

### 版本与发布

```bash
pnpm run changeset        # 建立变更记录
pnpm run version          # 更新版本号
pnpm run release          # 构建 + 发布
```

## 文档

### 核心文档

| 文档                                                     | 说明                                                   |
| -------------------------------------------------------- | ------------------------------------------------------ |
| [CLAUDE.md](CLAUDE.md)                                   | 项目命令、架构说明、开发规范                           |
| [apps/dotfiles/README.md](apps/dotfiles/README.md)       | dotfiles 子包说明 — 安装向导、命令、目录结构、版本记录 |
| [packages/commons/README.md](packages/commons/README.md) | commons 子包说明 — AI 资源来源、安全验证、命令         |

### Claude Code 参考

| 资源                                                                      | 说明                               |
| ------------------------------------------------------------------------- | ---------------------------------- |
| [Claude Code 快速参考表（繁体中文）](https://alvinbian.github.io/ab-tao/) | 完整快速参考表网页版，每日自动同步 |
| [原始来源 cc.storyfox.cz](https://cc.storyfox.cz/)                        | 英文原版，by @phasE89              |

### 集成指南

| 文档                                                    | 说明                       |
| ------------------------------------------------------- | -------------------------- |
| [gmail-filters.md](apps/dotfiles/docs/gmail-filters.md) | Gmail 自动分类规则配置指南 |

## 推荐的第三方工具

setup 完成后会推荐安装以下工具：

| 工具             | 安装命令                        | 说明                                                   |
| ---------------- | ------------------------------- | ------------------------------------------------------ |
| **RTK**          | `brew install rtk`              | Bash 输出压缩 -89%，安装后自动生效                     |
| **官方 Plugins** | 在 Claude Code 中执行 `/plugin` | code-review · commit-commands · feature-dev · simplify |
| **CCometixLine** | 自动安装（setup 时）            | Claude Code statusline — Git 状态、Context 用量、费用  |

### CCometixLine Statusline

[CCometixLine](https://github.com/Haleclipse/CCometixLine) 是一个用 Rust 编写的高性能 Claude Code statusline 工具，在 `pnpm run d:setup` 选择「🤖 Claude Code 配置」时自动安装。

功能：
- Git 分支状态（branch、dirty、ahead/behind）
- Claude 模型显示
- Context window 用量百分比
- 费用与 session 时长追踪
- 交互式 TUI 配置界面（`ccline --config`）
- 多主题支持（cometix、minimal、gruvbox、nord）

安装后 `~/.claude/settings.json` 自动写入：

```json
{
  "statusLine": {
    "type": "command",
    "command": "ccline",
    "padding": 0
  }
}
```

## GitFlow

采用标准 GitFlow 分支策略：

| 分支     | 命名格式     | 来源    | 合并到         | 用途                 |
| -------- | ------------ | ------- | -------------- | -------------------- |
| 主分支   | `main`       | -       | -              | 线上稳定版（受保护） |
| 开发分支 | `develop`    | main    | -              | 日常开发汇总         |
| 功能分支 | `feature/*`  | develop | develop        | 开发新功能           |
| 发布分支 | `release/v*` | develop | main + develop | 提测、发版           |
| 紧急修复 | `hotfix/*`   | main    | main + develop | 线上 BUG             |

> `main` 分支受保护：只能从 `develop` 或 `release/*` 通过 PR 合并，不允许直接推送。

```bash
# 开发新功能
git checkout develop && git checkout -b feature/xxx

# 发布版本
git checkout develop && git checkout -b release/v1.1.0

# 紧急修复
git checkout main && git checkout -b hotfix/xxx
```

## CI/CD

| Workflow       | 触发                  | 说明                                             |
| -------------- | --------------------- | ------------------------------------------------ |
| **CI**        | push → main           | lint + build + test + 资源同步验证             |
| **Git Flow**  | PR + push + tag       | 分支校验 + PR 来源校验 + commit 校验 + Release |
| **Release**   | push → main           | Version PR 自动建立 + changeset tag + Release  |
| **Translate** | README.md 变更 → main | 自动翻译 zh-CN + EN（需要 `GH_PAT` secret）    |
| **Sync**      | 每周一 03:00 UTC      | 自动同步外部 AI 资源                            |

### 必要 Secrets 设置

**Translate workflow** 使用 [GitHub Models API](https://models.inference.ai.azure.com)，需要有 `models` 权限的 PAT：

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
2. 建立新 token，勾选 **Models** 权限（read access）
3. Repo → Settings → Secrets and variables → Actions → 新增 secret：`GH_PAT`

> 默认的 `GITHUB_TOKEN` 不含 `models` 权限，必须另外设置 `GH_PAT`。

## License

MIT
