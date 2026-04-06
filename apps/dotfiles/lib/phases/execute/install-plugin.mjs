/**
 * Branch B: Plugin 打包
 *
 * 包含：
 *   - ab-claude-dev.plugin 打包
 *   - ab-slack-message.plugin 打包
 */

import { spawn } from 'node:child_process';

/**
 * 構建 Plugin 打包任務陣列
 *
 * @param {Object} plan - generateInstallPlan 產出
 * @param {Object} opts
 * @param {string} opts.repoDir - @ab-tao/dotfiles 根目錄
 * @returns {Array} Listr2 task 陣列
 */
export function buildPluginTasks(plan, { repoDir }) {
  return [
    {
      title: '🔌 Plugin 打包 → dist/release/',
      task: (_, subtask) =>
        subtask.newListr(
          [
            {
              title: 'ab-claude-dev.plugin',
              enabled: () => plan.targets.includes('claude-dev'),
              task: async () => {
                await new Promise((resolve, reject) => {
                  const child = spawn('bash', ['scripts/build-claude-dev-plugin.sh'], {
                    cwd: repoDir,
                  });
                  child.on('close', (code) =>
                    code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
                  );
                  child.on('error', reject);
                });
              },
            },
            {
              title: 'ab-slack-message.plugin',
              enabled: () => plan.targets.includes('slack'),
              task: async () => {
                await new Promise((resolve, reject) => {
                  const child = spawn('bash', ['scripts/build-slack-plugin.sh'], { cwd: repoDir });
                  child.on('close', (code) =>
                    code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
                  );
                  child.on('error', reject);
                });
              },
            },
          ],
          { exitOnError: false },
        ),
    },
  ];
}
