/**
 * first-run-notice.mjs — 首次部署提示
 *
 * 職責：
 *   1. 讀取 state.json，判斷 firstRunSeen 欄位
 *   2. 若未見過（false 或不存在），印出首次部署說明
 *   3. 將 firstRunSeen 標記為 true，寫回 state.json
 *
 * 呼叫方：config-sync.mjs → syncConfig() 在 renderPlanSummary 之前呼叫
 *
 * 注意：CI / 靜默模式（process.env.CI || process.env.AB_TAO_QUIET）
 *       跳過 UI 輸出，但仍寫入 firstRunSeen = true。
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { stateWrite } from "../state/state.mjs";

/**
 * 顯示首次部署提示（若尚未顯示過）並更新 state.json
 *
 * 首次部署定義：state.json 中 firstRunSeen 為 false 或欄位不存在。
 *
 * @param {object} state  已讀取的 state 物件（由 stateRead() 取得）
 *   需包含 firstRunSeen: boolean | undefined
 */
export function showFirstRunNotice(state) {
	// 已看過首次提示 → 直接返回
	if (state.firstRunSeen === true) return;

	// CI / 靜默模式：跳過 UI，只更新狀態
	const isQuiet = process.env.CI || process.env.AB_TAO_QUIET;

	if (!isQuiet) {
		p.log.info(
			[
				`${pc.cyan("ℹ️  ab-tao 首次部署")}`,
				`  ${pc.dim("•")} 採用 v1.1.0 clean-slate template`,
				`  ${pc.dim("•")} 本地修改觸發 drift prompt`,
				`  ${pc.dim("•")} 重置：${pc.cyan("pnpm run d:setup --reset-choices")}`,
			].join("\n"),
		);
	}

	// 將 firstRunSeen 標記為 true，持久化到 state.json
	stateWrite((draft) => {
		draft.firstRunSeen = true;
	});
}
