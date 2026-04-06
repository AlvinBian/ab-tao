/**
 * @ab-tao/shared — 統一入口
 *
 * 使用方式：
 *   import { readJson, info, exec } from '@ab-tao/shared';
 *   import { readJson } from '@ab-tao/shared/utils';
 *   import { info } from '@ab-tao/shared/libs';
 *   import { run } from '@ab-tao/shared/run';
 */

export { dim, error, execInteractive, info, step, success, warn } from './libs.mjs';
export { run } from './run.mjs';
export { commandExists, ensureDir, exec, readJson, walkFiles, writeJson } from './utils.mjs';
