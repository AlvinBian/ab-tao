import { spinner } from '@clack/prompts'

// 追蹤目前活躍的 spinner 數量，防止並行呼叫互相干擾造成 terminal 抖動
let _activeCount = 0

/**
 * 包住長 I/O 操作，自動顯示 spinner + 成功/失敗狀態。
 * CI / quiet 模式下靜默執行。
 * 若已有外層 spinner 活躍（嵌套呼叫），自動靜默避免 terminal 抖動。
 *
 * @param {string} label - spinner 標籤
 * @param {(update: (msg: string) => void) => Promise<any>} fn - 非同步操作
 * @param {{ hint?: string, silent?: boolean }} [opts]
 */
export async function withSpinner(label, fn, { hint, silent } = {}) {
  const isQuiet
    = silent || process.env.CI || process.env.AB_TAO_QUIET || _activeCount > 0

  if (isQuiet) {
    return fn(() => {})
  }

  _activeCount++
  const s = spinner()
  s.start(label)

  try {
    const result = await fn(msg => s.message(msg))
    s.stop(`✅ ${label}${hint ? ` · ${hint}` : ''}`)
    return result
  }
  catch (err) {
    s.stop(`❌ ${label} 失敗`)
    throw err
  }
  finally {
    _activeCount--
  }
}

/**
 * 將 bytes 轉為人類可讀格式（e.g. "1.2 MB"）
 */
export function humanBytes(bytes) {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 帶進度計數的 spinner（e.g. "[3/27] 處理 xxx"）
 * @param {string} label
 * @param {Array} items
 * @param {(item: any, update: (msg: string) => void) => Promise<any>} processor
 */
export async function withProgressSpinner(label, items, processor, opts = {}) {
  return withSpinner(
    label,
    async (update) => {
      const results = []
      for (let i = 0; i < items.length; i++) {
        update(`[${i + 1}/${items.length}] ${label}`)
        results.push(await processor(items[i], update))
      }
      return results
    },
    { hint: `共 ${items.length} 項`, ...opts },
  )
}
