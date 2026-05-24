/**
 * Logger 依賴注入 — 解耦 install 流程的顯示邏輯
 *
 * 問題背景：
 *   install 函式（handleInstallClaude、handleInstallModules 等）
 *   原本直接呼叫 p.log.* 和 console.log，在 Listr2 執行期間
 *   這些 stdout 寫入會污染 Listr2 的 ANSI 渲染，造成任務標題重複輸出。
 *
 * 解決方案：
 *   將顯示邏輯從業務邏輯抽離，改由呼叫方注入 logger 物件：
 *   - 互動模式 → CLACK_LOGGER（p.log.* 直接輸出）
 *   - Listr2 模式 → listrLogger(subtask)（訊息寫入 subtask.output）
 *
 * Logger 介面：
 *   info(msg)                       — 資訊訊息
 *   success(msg)                    — 成功訊息
 *   warn(msg)                       — 警告訊息
 *   progress(current, total, label) — 進度行（每安裝一個項目呼叫一次）
 *   failure(current, total)         — 失敗行
 *   done(total)                     — 完成行（全部安裝完成）
 *   createSpinner()                 — { start(msg), message(msg), stop(msg) }
 *   throwOnError                    — true=錯誤時拋出（Listr2），false=warn 繼續（互動）
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { stripAnsi } from './progress.mjs'

/**
 * 互動模式 Logger — 使用 @clack/prompts 直接輸出到 stdout
 *
 * 用於 pnpm run d:setup 互動流程中，直接在終端機顯示帶色彩的訊息。
 */
export const CLACK_LOGGER = {
  throwOnError: false,
  info: msg => p.log.info(msg),
  success: msg => p.log.success(msg),
  warn: msg => p.log.warn(msg),
  progress(current, total, label) {
    console.log(
      `  ${pc.green('✔')} ${pc.dim(`[${current}/${total}]`)} ${label}`,
    )
  },
  failure(current, total) {
    console.log(
      `  ${pc.red('✗')} ${pc.dim(`[${current}/${total}]`)} ${pc.red('失敗')}`,
    )
  },
  done(total) {
    console.log(`  ${pc.green('✔')} ${pc.dim(`[${total}/${total}]`)} 完成`)
  },
  createSpinner: () => p.spinner(),
}

/**
 * Listr2 模式 Logger — 訊息寫入 subtask.output（Listr2 安全）
 *
 * 在 Listr2 任務內部使用，所有訊息透過 subtask.output 顯示，
 * 不直接寫 stdout，避免與 Listr2 的 ANSI 渲染衝突。
 * 執行期間 subtask.output 會持續更新（顯示當前進度），
 * 任務結束後由 Listr2 任務本身設定最終摘要。
 *
 * @param {object} subtask - Listr2 subtask 物件（含 output 屬性）
 * @returns {object} Logger 介面
 */
export function listrLogger(subtask) {
  return {
    throwOnError: true,
    info: (msg) => {
      subtask.output = stripAnsi(msg)
    },
    success: (msg) => {
      subtask.output = stripAnsi(msg)
    },
    warn: (msg) => {
      subtask.output = `⚠️ ${stripAnsi(msg)}`
    },
    progress(current, total, label) {
      subtask.output = `[${current}/${total}] ${label}`
    },
    failure(current, total) {
      subtask.output = `✗ [${current}/${total}] 失敗`
    },
    done(total) {
      subtask.output = `[${total}/${total}] 完成`
    },
    createSpinner() {
      return {
        start: (msg) => {
          subtask.output = stripAnsi(msg)
        },
        message: (msg) => {
          subtask.output = stripAnsi(msg)
        },
        stop: (msg) => {
          subtask.output = stripAnsi(msg)
        },
      }
    },
  }
}
