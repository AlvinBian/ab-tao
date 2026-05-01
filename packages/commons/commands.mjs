#!/usr/bin/env node

/**
 * commons 指令定義與執行（v1.0.0）
 */

import { run } from "@ab-tao/share/libs";

export const pkg = "@ab-tao/commons";

export const commands = {
	"ai-sync": "外部 AI 來源同步（--select / --all / --source <name> / --force）",
	locals:
		"本地整合服務管理（--status / --start / --stop / --doctor / --install）",
	skills:
		"Claude Skills 管理（--list / --install / --update / --diff / --remove / --find）",
	validate: "驗證 resources/ai/sources/ 結構 + 安全檢查",
	translate: "多語系翻譯生成",
};

export const aliases = {};

run(pkg, aliases);
