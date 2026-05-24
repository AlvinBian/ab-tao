import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface WorklogDraft {
  id: string
  createdAt: string
  sessionId: string
  project: string
  branch: string
  ticketKey: string
  startedAt: string
  endedAt: string
  durationSec: number
  commits: { sha: string, subject: string }[]
  comment: string
}

export const useWorklogStore = defineStore('worklog', () => {
  const drafts = ref<WorklogDraft[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const r = await fetch('/api/worklog/drafts')
      const j = await r.json()
      if (j.code === 0)
        drafts.value = j.data.drafts
      else error.value = j.message
    }
    catch (e) {
      error.value = (e as Error).message
    }
    finally {
      loading.value = false
    }
  }

  async function dismiss(ids: string[]) {
    await fetch('/api/worklog/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    await load()
  }

  async function patch(id: string, updates: Partial<WorklogDraft>) {
    await fetch('/api/worklog/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch: updates }),
    })
    await load()
  }

  return { drafts, loading, error, load, dismiss, patch }
})
