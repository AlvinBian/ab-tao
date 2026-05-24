import { onUnmounted, ref } from 'vue'

export interface SseEvent {
  type: 'log' | 'progress' | 'done' | 'error' | 'meta'
  message?: string
  level?: 'info' | 'warn' | 'error'
  step?: number
  total?: number
  stage?: string
  code?: number
  success?: boolean
  traceId?: string
  [key: string]: unknown
}

export interface UseSseOptions {
  onEvent?: (_event: SseEvent) => void
  onDone?: (_event: SseEvent) => void
  onError?: (_event: SseEvent) => void
  maxLogs?: number
}

export function useSse(options: UseSseOptions = {}) {
  const { maxLogs = 500 } = options

  const running = ref(false)
  const done = ref(false)
  const success = ref<boolean | null>(null)
  const logs = ref<{ level: string, message: string }[]>([])
  const progress = ref(0)
  const stage = ref('')
  const errorMsg = ref('')
  const traceId = ref('')

  let abortCtrl: AbortController | null = null

  function reset() {
    running.value = false
    done.value = false
    success.value = null
    logs.value = []
    progress.value = 0
    stage.value = ''
    errorMsg.value = ''
    traceId.value = ''
  }

  function start(url: string, body?: Record<string, unknown>) {
    abortCtrl?.abort()
    abortCtrl = null
    reset()
    running.value = true

    // 直接用 fetch + ReadableStream 讀 SSE（EventSource 只支援 GET）
    const controller = new AbortController()
    abortCtrl = controller;

    (async () => {
      try {
        const resp = await fetch(url, {
          method: body !== undefined ? 'POST' : 'GET',
          headers:
            body !== undefined ? { 'Content-Type': 'application/json' } : {},
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        if (!resp.ok || !resp.body) {
          throw new Error(`HTTP ${resp.status}`)
        }

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone)
            break

          buffer += decoder.decode(value, { stream: true })
          // SSE events are separated by blank lines; handle both LF and CRLF
          const parts = buffer.split(/\r?\n\r?\n/)
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            // Collect all data: lines (SSE spec allows multiple per event)
            const dataLines = part
              .split(/\r?\n/)
              .filter(l => l.startsWith('data:'))
              .map(l => l.replace(/^data:\s?/, ''))
            if (dataLines.length === 0)
              continue
            try {
              const event: SseEvent = JSON.parse(dataLines.join('\n'))
              handleEvent(event)
            }
            catch {
              // 忽略非 JSON 行
            }
          }
        }

        // stream ended cleanly
        if (!done.value) {
          handleEvent({ type: 'done', success: true })
        }
      }
      catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError')
          return
        running.value = false
        done.value = true
        success.value = false
        errorMsg.value = (err as Error)?.message ?? '連線失敗'
        options.onError?.({ type: 'error', message: errorMsg.value })
      }
    })()
  }

  function handleEvent(event: SseEvent) {
    options.onEvent?.(event)

    if (event.type === 'meta') {
      if (event.traceId)
        traceId.value = event.traceId
    }
    else if (event.type === 'log') {
      const entry = {
        level: event.level ?? 'info',
        message: event.message ?? '',
      }
      logs.value.push(entry)
      if (logs.value.length > maxLogs) {
        logs.value = logs.value.slice(-maxLogs)
      }
    }
    else if (event.type === 'progress') {
      if (event.step !== undefined && event.total) {
        progress.value = Math.round((event.step / event.total) * 100)
      }
      if (event.stage)
        stage.value = event.stage
      if (event.message) {
        logs.value.push({ level: 'info', message: event.message })
      }
    }
    else if (event.type === 'done') {
      // 冪等保護：多次 done 只處理第一次
      if (done.value)
        return
      running.value = false
      done.value = true
      success.value = event.success ?? true
      options.onDone?.(event)
    }
    else if (event.type === 'error') {
      running.value = false
      done.value = true
      success.value = false
      errorMsg.value = event.message ?? '未知錯誤'
      options.onError?.(event)
    }
  }

  function stop() {
    abortCtrl?.abort()
    abortCtrl = null
    running.value = false
  }

  onUnmounted(() => stop())

  return {
    running,
    done,
    success,
    logs,
    progress,
    stage,
    errorMsg,
    traceId,
    start,
    stop,
    reset,
  }
}
