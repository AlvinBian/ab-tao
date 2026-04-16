#!/usr/bin/env node

/**
 * dotfiles 指令定義與執行
 */

import { run } from "@ab-tao/share/libs";

export const pkg = "@ab-tao/dotfiles";

export const commands = {
	setup: "完整環境部署精靈",
	scan: "技術棧掃描 + 技能庫生成",
	doctor: "環境診斷",
	status: "配置狀態儀表板",
	report: "打開上次 setup 部署報告",
	restore: "還原備份",
	hooks: "Hook 管理",
	skills: "Skills 維護（列出、搜尋、更新）",
	uninstall: "移除 ab-tao",
};

export const aliases = {};

run(pkg, aliases);
