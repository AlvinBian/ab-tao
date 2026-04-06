#!/usr/bin/env node

/**
 * commons 指令定義與執行
 */

import { run } from '@ab-tao/shared/run';

export const pkg = '@ab-tao/commons';

export const commands = {
  sync: '列出 AI 來源與狀態',
  validate: '驗證資源結構 + 安全檢查',
};

export const aliases = {
  'sync:select': { cmd: 'sync', args: '--select', desc: '互動式選擇同步' },
  'sync:all': { cmd: 'sync', args: '--all', desc: '同步全部 7 個來源' },
};

run(pkg, aliases);
