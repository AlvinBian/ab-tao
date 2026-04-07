/**
 * build-plugin 步驟：打包 .plugin 檔案
 *
 * 透過 shell 腳本產生壓縮的 .plugin 套件，
 * 解析腳本 stdout 中的階段標記並更新 spinner 進度。
 */

import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import * as p from '@clack/prompts';
import { isEmpty } from 'lodash-es';
import pc from 'picocolors';
import { stripAnsi } from '../cli/progress.mjs';

/**
 * 執行 plugin 打包腳本並顯示進度
 *
 * 透過 spawn 執行 step.script，解析 stdout 輸出中的
 * 階段名稱（phases 陣列）更新 spinner 訊息；
 * 打包失敗時以 warn 記錄但不中斷流程。
 *
 * @param {string} repoDir - @ab-tao/dotfiles 根目錄（腳本執行目錄）
 * @param {Object} step - config.json 中的 step 定義
 * @param {string} step.script - 要執行的 shell 指令
 * @param {string[]} [step.phases] - 要追蹤的階段名稱陣列
 * @param {string} [step.successMsg] - 成功訊息文字
 * @param {string} stepLabel - 步驟前綴（如 '[2/3] '）
 * @returns {Promise<void>}
 */
export async function handleBuildPlugin(repoDir, step, stepLabel, { silent = false } = {}) {
  const phases = step.phases || [];
  const seen = new Set();

  // silent 模式（在 listr2 內）：不使用 clack spinner，避免渲染衝突
  const spinner = silent ? null : p.spinner();
  spinner?.start(`${stepLabel}打包 plugin...`);

  try {
    const [scriptCmd, ...scriptArgs] = step.script.split(/\s+/);
    const child = spawn(scriptCmd, scriptArgs, { cwd: repoDir });
    let buf = '';
    const decoder = new StringDecoder('utf8');
    const completedPhases = [];

    await new Promise((resolve, reject) => {
      child.stdout.on('data', (chunk) => {
        buf += decoder.write(chunk);
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const clean = stripAnsi(line);
          for (const phase of phases) {
            if (seen.has(phase)) continue;
            if (phase === '打包完成') {
              if (/✅.*打包完成/.test(clean)) seen.add(phase);
            } else if (clean.includes(phase)) {
              seen.add(phase);
              completedPhases.push(phase);
              spinner?.message(`${stepLabel}打包中 — ${phase}`);
            }
          }
        }
      });
      child.stderr.on('data', () => {});
      child.on('close', (code) =>
        code !== 0 ? reject(new Error(`執行失敗（代碼 ${code}）`)) : resolve(),
      );
    });

    const phaseLines = !isEmpty(completedPhases)
      ? `\n${completedPhases.map((ph) => `  ${pc.green('✔')} ${ph}`).join('\n')}`
      : '';
    spinner?.stop(`${stepLabel}✔ ${step.successMsg || '打包完成'}${phaseLines}`);
  } catch (e) {
    if (silent) throw e;
    p.log.warn(`${stepLabel}打包失敗：${e.message.slice(0, 60)}`);
  }
}
