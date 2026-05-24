import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SettingsData {
  model?: string
  effortLevel?: string
  statusLine?: { type: string, command: string }
  permissions?: { allow: string[], deny: string[], defaultMode?: string }
  enabledPlugins?: Record<string, boolean>
  hooks?: Record<string, HookEntry[]>
  env?: Record<string, string>
  [key: string]: unknown
}

export interface HookEntry {
  id: string
  description: string
  matcher?: string
  hooks: { type: string, command: string, timeout?: number }[]
}

/** 新增 hook 的請求 body 結構 */
export interface AddHookPayload {
  command: string
  matcher?: string
  hooks?: unknown[]
}

/** patchHook 支援的部分更新欄位 */
export interface PatchHookPayload {
  enabled?: boolean
  command?: string
  matcher?: string
}

/** putSettings 的回傳結果 */
export interface PutSettingsResult {
  success: boolean
  code?: string
}

export interface PrefsData {
  prefs: Record<string, unknown>
  defaults: Record<string, unknown>
}

const TTL_MS = 30_000

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingsData | null>(null)
  const prefs = ref<PrefsData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastFetchedAt = ref(0)
  const saving = ref(false)
  const isReadonly = ref(false)
  const readonlyMessage = ref<string | null>(null)
  /** 從 GET /api/settings 取得的 ETag，用於 PUT /api/settings 樂觀鎖 */
  const etag = ref<string | null>(null)

  const isStale = () => Date.now() - lastFetchedAt.value > TTL_MS

  /**
   * 處理 mutation 回應中的 423 LOCKED。
   * @returns true 若已處理（呼叫者不應繼續）
   */
  function handleMutationResponse(
    res: Response,
    jsonData: { code: number, message: string },
  ): boolean {
    if (res.status === 423) {
      isReadonly.value = true
      readonlyMessage.value = jsonData.message ?? 'd:setup 執行中，設定唯讀'
      // 10 秒後自動重試 fetch 解除 readonly
      setTimeout(() => {
        isReadonly.value = false
        readonlyMessage.value = null
        fetchSettings(true)
      }, 10_000)
      return true
    }
    return false
  }

  async function fetchSettings(force = false) {
    if (!force && !isStale() && settings.value)
      return
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (json.code === 0) {
        // 優先從 HTTP 回應標頭取得 ETag
        const headerEtag = res.headers.get('ETag')
        if (headerEtag) {
          etag.value = headerEtag
        }
        // 若後端將 _etag 嵌入 data，從物件中取出並移除
        const data: SettingsData = json.data ?? {}
        if ('_etag' in data && typeof data._etag === 'string') {
          if (!headerEtag) {
            etag.value = data._etag as string
          }
          delete data._etag
        }
        settings.value = data
        lastFetchedAt.value = Date.now()
      }
      else {
        error.value = json.message
      }
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : '連線失敗'
    }
    finally {
      loading.value = false
    }
  }

  async function fetchPrefs() {
    try {
      const res = await fetch('/api/preferences')
      const json = await res.json()
      if (json.code === 0)
        prefs.value = json.data
    }
    catch {
      // 靜默失敗
    }
  }

  async function patchPermissions(allow: string[], deny: string[]) {
    saving.value = true
    try {
      const res = await fetch('/api/settings/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow, deny }),
      })
      const json = await res.json()
      if (handleMutationResponse(res, json))
        return
      if (json.code === 0 && settings.value?.permissions) {
        settings.value.permissions.allow = allow
        settings.value.permissions.deny = deny
      }
      else {
        throw new Error(json.message)
      }
    }
    finally {
      saving.value = false
    }
  }

  async function patchAi(model: string, effortLevel: string) {
    saving.value = true
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, effortLevel }),
      })
      const json = await res.json()
      if (handleMutationResponse(res, json))
        return
      if (json.code === 0 && settings.value) {
        settings.value.model = model
        settings.value.effortLevel = effortLevel
      }
      else {
        throw new Error(json.message)
      }
    }
    finally {
      saving.value = false
    }
  }

  async function patchPluginEnabled(name: string, enabled: boolean) {
    saving.value = true
    try {
      const res = await fetch(
        `/api/settings/plugins/${encodeURIComponent(name)}/enabled`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        },
      )
      const json = await res.json()
      if (handleMutationResponse(res, json))
        return
      if (json.code === 0 && settings.value) {
        if (!settings.value.enabledPlugins)
          settings.value.enabledPlugins = {}
        settings.value.enabledPlugins[name] = enabled
      }
      else {
        throw new Error(json.message)
      }
    }
    finally {
      saving.value = false
    }
  }

  async function savePrefs(prefs: Record<string, unknown>) {
    saving.value = true
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const json = await res.json()
      if (json.code !== 0)
        throw new Error(json.message)
    }
    finally {
      saving.value = false
    }
  }

  /**
   * 更新 hooks 中特定項目的部分欄位（PATCH）。
   * 對應後端：PATCH /api/settings/hooks/:event/:idx
   */
  async function patchHook(
    event: string,
    idx: number,
    patch: PatchHookPayload,
  ): Promise<void> {
    const r = await fetch(
      `/api/settings/hooks/${encodeURIComponent(event)}/${idx}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    )
    const body = (await r.json()) as { code: number, message?: string }
    if (!r.ok) {
      if (r.status === 423) {
        handleMutationResponse(r, body as { code: number, message: string })
        return
      }
      throw new Error(body.message ?? `patchHook 失敗：${r.status}`)
    }
    await fetchSettings(true)
  }

  /**
   * 刪除 hooks 中特定項目。
   * 對應後端：DELETE /api/settings/hooks/:event/:idx
   */
  async function deleteHook(event: string, idx: number): Promise<void> {
    const r = await fetch(
      `/api/settings/hooks/${encodeURIComponent(event)}/${idx}`,
      { method: 'DELETE' },
    )
    const body = (await r.json()) as { code: number, message?: string }
    if (!r.ok) {
      if (r.status === 423) {
        handleMutationResponse(r, body as { code: number, message: string })
        return
      }
      throw new Error(body.message ?? `deleteHook 失敗：${r.status}`)
    }
    await fetchSettings(true)
  }

  /**
   * 新增一筆 hook 至指定 event。
   * 對應後端：POST /api/settings/hooks/:event
   */
  async function addHook(event: string, entry: AddHookPayload): Promise<void> {
    const r = await fetch(`/api/settings/hooks/${encodeURIComponent(event)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    const body = (await r.json()) as { code: number, message?: string }
    if (!r.ok) {
      if (r.status === 423) {
        handleMutationResponse(r, body as { code: number, message: string })
        return
      }
      throw new Error(body.message ?? `addHook 失敗：${r.status}`)
    }
    await fetchSettings(true)
  }

  /**
   * 儲存 permissions（allow / deny）。
   * 與 patchPermissions 對應同一端點，提供語意更明確的命名。
   * 對應後端：PATCH /api/settings/permissions
   */
  async function savePermissions(
    allow: string[],
    deny: string[],
  ): Promise<void> {
    return patchPermissions(allow, deny)
  }

  /**
   * 全量取代設定檔（樂觀鎖）。
   * - 必須先呼叫 fetchSettings() 取得 etag，否則拋出錯誤。
   * - 409 SETTINGS_STALE：重新載入最新設定，回傳 { success: false, code: 'SETTINGS_STALE' }。
   * - 428 ETAG_REQUIRED：回傳 { success: false, code: 'ETAG_REQUIRED' }。
   * - 423 LOCKED：觸發唯讀橫幅，回傳 { success: false, code: 'LOCKED' }。
   * - 503：拋出錯誤（備份失敗）。
   * - 成功：更新 etag、重新載入設定，回傳 { success: true }。
   * 對應後端：PUT /api/settings
   */
  async function putSettings(
    incoming: Record<string, unknown>,
  ): Promise<PutSettingsResult> {
    if (!etag.value) {
      throw new Error('請先載入設定（etag 未取得）')
    }
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': etag.value,
      },
      body: JSON.stringify(incoming),
    })
    const body = (await r.json()) as {
      code: number
      message?: string
      data?: { _etag?: string }
    }

    if (r.status === 409) {
      // 設定已被其他來源更新，重新載入後通知呼叫者
      await fetchSettings(true)
      return { success: false, code: 'SETTINGS_STALE' }
    }
    if (r.status === 428) {
      return { success: false, code: 'ETAG_REQUIRED' }
    }
    if (r.status === 423) {
      handleMutationResponse(r, body as { code: number, message: string })
      return { success: false, code: 'LOCKED' }
    }
    if (r.status === 503) {
      throw new Error('備份失敗，請稍後再試')
    }
    if (!r.ok) {
      throw new Error(body.message ?? `putSettings 失敗：${r.status}`)
    }

    // 成功：更新 etag 並重新載入設定
    const responseEtag = r.headers.get('ETag') ?? body.data?._etag
    if (responseEtag) {
      etag.value = responseEtag
    }
    await fetchSettings(true)
    return { success: true }
  }

  return {
    settings,
    prefs,
    loading,
    error,
    saving,
    isReadonly,
    readonlyMessage,
    etag,
    fetchSettings,
    fetchPrefs,
    patchPermissions,
    patchAi,
    patchPluginEnabled,
    savePrefs,
    patchHook,
    deleteHook,
    addHook,
    savePermissions,
    putSettings,
  }
})
