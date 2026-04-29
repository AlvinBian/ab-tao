/**
 * source-meta.mjs — SOURCES_CONFIG 展示層元資料
 *
 * SOURCE_ICONS 從 SOURCES_CONFIG 動態派生，不硬編碼，新增 source 後自動同步。
 * SOURCE_LABELS 提供 CLI 顯示用的短標籤（padEnd(10) 排版）。
 */

import { SOURCES_CONFIG } from "@ab-tao/commons/sync";

export const SOURCE_ICONS = Object.fromEntries(
	Object.entries(SOURCES_CONFIG).map(([name, cfg]) => [name, cfg.icon ?? "📦"]),
);

export const SOURCE_LABELS = {
	ecc: "ECC",
	anthropic: "Anthropic",
	superpowers: "Superpowers",
	"context-engineering": "CtxEng",
	openskills: "OpenSkill",
	gstack: "gstack",
	"spec-kit": "spec-kit",
	"ai-sdlc": "ai-sdlc",
	bmad: "bmad",
};
