/**
 * @ab-tao/share — 統一入口
 *
 * 使用方式：
 *   import { readJson, info, run } from '@ab-tao/share';
 *   import { readJson } from '@ab-tao/share/utils';
 *   import { run } from '@ab-tao/share/libs';
 */

export {
  dim,
  error,
  execInteractive,
  info,
  run,
  step,
  success,
  warn,
} from './libs/index.mjs'
export {
  commandExists,
  ensureDir,
  exec,
  readJson,
  walkFiles,
  writeJson,
} from './utils/index.mjs'
