/**
 * @ab-tao/share — 統一入口
 *
 * 使用方式：
 *   import { readJson, info, exec } from '@ab-tao/share';
 *   import { readJson } from '@ab-tao/share/utils';
 *   import { info } from '@ab-tao/share/libs';
 *   import { run } from '@ab-tao/share/run';
 */

export { dim, error, execInteractive, info, step, success, warn } from './libs.mjs';
export { run } from './run.mjs';
export { commandExists, ensureDir, exec, readJson, walkFiles, writeJson } from './utils.mjs';
