/**
 * Branch C: ZSH 環境模組
 *
 * 包含：
 *   - ZSH 模組安裝 → ~/.zsh/modules/
 */

import { runTarget } from '../../install/index.mjs';

/**
 * 構建 ZSH 安裝任務陣列
 *
 * @param {Object} plan - generateInstallPlan 產出
 * @param {Object} opts
 * @param {string} opts.repoDir - @ab-tao/dotfiles 根目錄
 * @param {string} opts.previewDir - dist/preview 路徑
 * @param {Object} opts.targets - config.json targets 定義
 * @param {Object|null} opts.prev - session
 * @param {boolean} opts.isManual - 是否手動模式
 * @param {Object} opts.installSelections - 共享狀態（寫入）
 * @returns {Array} Listr2 task 陣列
 */
export function buildZshTasks(
  plan,
  { repoDir, previewDir, targets, prev, isManual, installSelections },
) {
  const features = new Set(plan.features || ['claude', 'claudemd', 'ecc', 'slack', 'zsh']);
  const has = (f) => features.has(f);

  return [
    {
      title: '🐚 ZSH 環境模組',
      enabled: () => has('zsh'),
      task: (_, task) =>
        task.newListr(
          [
            {
              title: `🐚 ZSH 模組（${plan.zshModules?.length ?? 0} 個）→ ~/.zsh/modules/`,
              enabled: () =>
                (plan.targets || []).includes('zsh') && (plan.zshModules?.length ?? 0) > 0,
              task: async (_, subtask) => {
                if (targets.zsh) {
                  const result = await runTarget(repoDir, previewDir, 'zsh', targets.zsh, {
                    selectedTargets: ['zsh'],
                    completed: new Set(),
                    flagAll: true,
                    manual: isManual,
                    skillIds: [],
                    session: prev,
                    silent: true,
                  });
                  if (result) Object.assign(installSelections, result);
                }
                subtask.output = `已安裝 ${plan.zshModules?.length ?? 0} 個模組：${plan.zshModules?.join('、') ?? ''}`;
              },
            },
          ],
          { concurrent: false },
        ),
    },
  ];
}
