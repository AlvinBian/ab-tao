/**
 * 安裝通用工具 — selectItems、buildCmdArgs
 *
 * 提供 install-claude 和 install-modules 共用的：
 *   - 項目發現 + smartSelect 選擇流程（selectItems）
 *   - 將選擇結果組裝成命令列參數（buildCmdArgs）
 */

import { isEmpty } from 'lodash-es';
import { countExisting, discoverItems } from '../cli/files.mjs';
import { BACK, smartSelect } from '../cli/prompts.mjs';

/**
 * 通用選擇流程：發現項目 → smartSelect → 回傳選中清單
 *
 * deprecated 項目在 flagAll 模式時被排除（不自動安裝），
 * 但在互動模式下保留在可選列表中（讓用戶手動勾選）。
 *
 * @param {string} repoDir
 * @param {Object} def - { dir, ext, filter, selectLabel }
 * @param {string} key - 選項 key（如 'commands'）
 * @param {Object} opts
 * @param {string} opts.stepLabel
 * @param {boolean} opts.flagAll
 * @param {string[]} [opts.sessionValues] - 上次選擇
 * @param {string[]} [opts.preselected] - 預選（matchWhen 計算結果）
 * @returns {Promise<string[]>}
 */
export async function selectItems(
  repoDir,
  def,
  key,
  { stepLabel, flagAll, sessionValues, preselected },
) {
  const items = discoverItems(repoDir, def.dir, def.ext, def.filter);
  if (isEmpty(items)) return [];

  // flagAll 時排除 deprecated 項目（不自動安裝）
  if (flagAll) {
    return items.filter((i) => !i.deprecated).map((i) => i.value);
  }

  const result = await smartSelect({
    title: `${stepLabel}${def.selectLabel || key}`,
    items,
    preselected: preselected || items.map((i) => i.value),
    session: sessionValues,
  });
  if (result === BACK) return BACK;
  return result;
}

/**
 * 組裝 cmdArgs 和計算 total
 *
 * @param {Object} selected - { commands: [], agents: [], ... }
 * @param {Object} selectableDefs - step.selectable 定義
 * @param {string} repoDir
 * @returns {{ cmdArgs: string[], total: number }}
 */
export function buildCmdArgs(selected, selectableDefs, repoDir) {
  const cmdArgs = [];
  let total = 0;

  for (const [key, values] of Object.entries(selected)) {
    if (!values?.length || !selectableDefs[key]) continue;
    const def = selectableDefs[key];
    total += countExisting(repoDir, def.dir, values, def.ext);
    cmdArgs.push(`--${key} "${values.join(',')}"`);
  }

  return { cmdArgs, total };
}
