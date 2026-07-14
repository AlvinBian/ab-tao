---
name: handoff
description: 清 context / compact 前的「交接班」—— 把本 session 的记忆·计划·tasks 固化落盘，与 /resume 成对（handoff 写、resume 读）。通用于所有项目。
---

在清 context（`/clear`）或 compact 前运行本命令，把「你脑子里的工作状态」结构化写入磁盘，让下个 session（或队友/另一台机）能无缝接手。**只写状态、不写代码、不 commit**（叠加全局 §05 Git 红线：未授权禁 commit/push）。

设计原则（借鉴社区 `/handoff`+`/resume` 成对模式）：**compass, not novel** —— 简洁、结构化、只留「继续干需要的」；尤其记下**踩过的坑**（防下个 session 重踩）。

## 第一步：定位落盘目标（当前项目）

```bash
cd <当前项目根>
PROJMEM=~/.claude/projects/$(pwd | sed 's#/#-#g')/memory   # 项目记忆目录
git branch --show-current; git status --short | wc -l       # 分支 + 未 commit 规模
```
- 项目记忆目录不存在 → 该项目还没记忆，按需 `mkdir -p` 或提示用户（勿静默创建到错误路径）。
- 全局跨项目偏好放 `~/.claude/memory/`；本命令主要写**项目级** `$PROJMEM`。

## 第二步：审视本 session，抽取交接内容

回看本次对话，按下面五段各抽 1-N 条（无则略，勿凑字数）：
1. **当前状态**（一句话 + 关键事实：分支、部署环境、跑到哪、什么可用）
2. **本次完成**（要点式，已验证的标注「验过」）
3. **踩过的坑 / 失败尝试**（⚠️最重要防重踩：什么不 work + 为什么 + 正确解法）
4. **关键决策**（做了什么架构/方案选择 + 为什么，业务/历史约束）
5. **下一步**（优先级排序的待办；含未授权待办如「分批 commit 需用户授权」）

## 第三步：写入三处（按全局 08-state-system 三温层边界）

1. **记忆（Memory）→ `$PROJMEM/active-context.md`**（Volatile 进行中层）：
   - 顶部维护一个 `🔴 SESSION HANDOFF（<日期>）` 块 = 上面五段 + git 规模。**覆盖旧 handoff 块**（保持当前，不 append 堆叠——handoff 是「当前快照」非流水账）。
   - 稳定偏好/用户 feedback（如「我们都用 pnpm」）→ 写 `system-patterns.md`（Stable 层），**不**混进 active-context。
   - 更新 `MEMORY.md` 的 active-context 索引行（描述反映最新状态）；**禁直接把内容 append 进 MEMORY.md**（它只是 ≤15 行 index）。
   - 相对日期转绝对日期。学习内容/敏感信息（token/个资）禁写。
2. **计划（Plans）**：若有 active plan（生命周期至 PR merge），更新其 frontmatter `status` 与进度勾选；无则跳过。
3. **任务（Tasks）**：原生 Tasks 是**当次对话**生命周期，清 context 即失。用 `TaskList` 读当前未完成任务 → 把它们**并进 active-context 的「下一步」段**（否则下个 session 看不到）。已完成的不搬。

## 第四步：回报 + 收尾

用 3-5 行告诉用户：① 写了哪些文件（active-context / system-patterns / plan）② 交接的「下一步」几条 ③ 未 commit 规模提醒。然后确认「可以安全清 context 了，新 session 跑 `/resume` 恢复」。

**不做**：不 commit/push（§05）、不发 Slack、不改代码、不静默创建记忆到猜测路径、不把 4 段以前的调试噪音写进交接（降噪，见 07-context-hygiene）。
