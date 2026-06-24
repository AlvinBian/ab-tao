<script setup lang="ts">
// Requires: Vue 3.x / Element Plus

import type { SectionTabConfig } from '@/components/SectionTabs.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import SectionTabs from '@/components/SectionTabs.vue'

// ── 型別定義 ─────────────────────────────────────────────────────────────────

interface MetricRow {
  id: number
  timestamp: string
  event_type: string
  value: string
}

interface TriggerRow {
  feature: string
  trigger: string
  currentStatus: string
}

// ── Tab 設定 ─────────────────────────────────────────────────────────────────

const tabs: SectionTabConfig[] = [
  { key: 'realtime-metrics', label: '即時指標' },
  { key: 'trigger-conditions', label: '自動化觸發條件' },
  { key: 'failure-patterns', label: 'Failure Patterns' },
]

// ── Tab 1: 即時指標 ───────────────────────────────────────────────────────────

const metricsRows = ref<MetricRow[]>([])
const metricsError = ref<string | null>(null)
const metricsConnected = ref(false)
let metricsEs: EventSource | null = null
let metricsRowCounter = 0

function connectMetrics(): void {
  if (metricsEs) {
    metricsEs.close()
  }
  metricsError.value = null
  metricsEs = new EventSource('http://localhost:5478/api/sse/metrics')

  metricsEs.onopen = () => {
    metricsConnected.value = true
  }

  metricsEs.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as {
        type: string
        data?: Record<string, unknown>
        raw?: string
        message?: string
      }
      if (payload.type === 'metric') {
        const data = payload.data ?? { raw: payload.raw }
        metricsRowCounter += 1
        metricsRows.value.push({
          id: metricsRowCounter,
          timestamp:
            typeof data.timestamp === 'string'
              ? data.timestamp
              : new Date().toISOString(),
          event_type:
            typeof data.event_type === 'string'
              ? data.event_type
              : typeof data.type === 'string'
                ? data.type
                : 'unknown',
          value: JSON.stringify(
            Object.fromEntries(
              Object.entries(data).filter(
                ([k]) =>
                  k !== 'timestamp' && k !== 'event_type' && k !== 'type',
              ),
            ),
          ),
        })
      }
    }
    catch {
      // 忽略無法解析的事件
    }
  }

  metricsEs.onerror = () => {
    metricsConnected.value = false
    metricsError.value = 'SSE 連線中斷，請確認 Console API 伺服器是否運行中'
  }
}

function disconnectMetrics(): void {
  if (metricsEs) {
    metricsEs.close()
    metricsEs = null
    metricsConnected.value = false
  }
}

// ── Tab 2: 自動化觸發條件 ─────────────────────────────────────────────────────

const triggerRows: TriggerRow[] = [
  {
    feature: 'chain-sdlc',
    trigger: 'chain_invocations ≥ 10/month',
    currentStatus: '尚未就緒',
  },
  {
    feature: '/codex review',
    trigger: 'adversarial_invocations ≥ 5',
    currentStatus: '尚未就緒',
  },
  {
    feature: 'Full SDLC',
    trigger: 'skill_invocation_rate ≥ 20%',
    currentStatus: '尚未就緒',
  },
  {
    feature: 'LLM dispatcher',
    trigger: 'unmatched_intents ≥ 30',
    currentStatus: '尚未就緒',
  },
]

// ── Tab 3: Failure Patterns ───────────────────────────────────────────────────

const failurePatternsContent = ref<string>('（載入中…）')
const failurePatternsError = ref<string | null>(null)
const failurePatternsConnected = ref(false)
let failurePatternsEs: EventSource | null = null

function connectFailurePatterns(): void {
  if (failurePatternsEs) {
    failurePatternsEs.close()
  }
  failurePatternsError.value = null
  failurePatternsEs = new EventSource(
    'http://localhost:5478/api/sse/failure-patterns',
  )

  failurePatternsEs.onopen = () => {
    failurePatternsConnected.value = true
  }

  failurePatternsEs.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as {
        type: string
        content?: string
      }
      if (payload.type === 'content' && typeof payload.content === 'string') {
        failurePatternsContent.value = payload.content
      }
    }
    catch {
      // 忽略無法解析的事件
    }
  }

  failurePatternsEs.onerror = () => {
    failurePatternsConnected.value = false
    failurePatternsError.value
      = 'SSE 連線中斷，請確認 Console API 伺服器是否運行中'
  }
}

function disconnectFailurePatterns(): void {
  if (failurePatternsEs) {
    failurePatternsEs.close()
    failurePatternsEs = null
    failurePatternsConnected.value = false
  }
}

// ── 生命週期 ─────────────────────────────────────────────────────────────────

onMounted(() => {
  connectMetrics()
  connectFailurePatterns()
})

onUnmounted(() => {
  disconnectMetrics()
  disconnectFailurePatterns()
})
</script>

<template>
  <SectionTabs :tabs="tabs" default-tab="realtime-metrics">
    <!-- ── Tab 1: 即時指標 ────────────────────────────────────────────────── -->
    <template #realtime-metrics>
      <div class="metrics-tab">
        <div class="tab-header">
          <h3 class="tab-title">
            即時指標
          </h3>
          <p class="tab-desc">
            即時讀取 <code>~/.claude/.ab-tao/metrics.jsonl</code>，每 2 秒更新一次。
          </p>
          <div class="connection-status">
            <el-tag
              :type="metricsConnected ? 'success' : 'danger'"
              size="small"
              effect="plain"
            >
              {{ metricsConnected ? '已連線' : '未連線' }}
            </el-tag>
            <el-button size="small" plain @click="connectMetrics">
              重新連線
            </el-button>
          </div>
        </div>
        <el-alert
          v-if="metricsError"
          :title="metricsError"
          type="error"
          show-icon
          :closable="false"
          style="margin-bottom: 12px"
        />
        <el-table :data="metricsRows" stripe style="width: 100%" max-height="480">
          <el-table-column prop="timestamp" label="Timestamp" min-width="200">
            <template #default="{ row }">
              <el-text size="small" type="info">
                {{ row.timestamp }}
              </el-text>
            </template>
          </el-table-column>
          <el-table-column prop="event_type" label="Event Type" min-width="160">
            <template #default="{ row }">
              <el-tag type="primary" size="small" effect="plain">
                {{ row.event_type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="value" label="Value" min-width="320">
            <template #default="{ row }">
              <el-text size="small" truncated>
                {{ row.value }}
              </el-text>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="metricsRows.length === 0 && !metricsError" class="empty-hint">
          <el-text type="info" size="small">
            尚無指標資料，等待 metrics.jsonl 寫入…
          </el-text>
        </div>
      </div>
    </template>

    <!-- ── Tab 2: 自動化觸發條件 ──────────────────────────────────────────── -->
    <template #trigger-conditions>
      <div class="metrics-tab">
        <div class="tab-header">
          <h3 class="tab-title">
            自動化觸發條件
          </h3>
          <p class="tab-desc">
            v1.7+ 升級功能的觸發指標門檻，達標後自動解鎖對應功能。
          </p>
        </div>
        <el-table :data="triggerRows" stripe style="width: 100%">
          <el-table-column prop="feature" label="功能" min-width="160">
            <template #default="{ row }">
              <el-tag type="primary" size="small" effect="plain" style="font-family: monospace">
                {{ row.feature }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="trigger" label="觸發條件" min-width="240">
            <template #default="{ row }">
              <el-text size="small">
                {{ row.trigger }}
              </el-text>
            </template>
          </el-table-column>
          <el-table-column prop="currentStatus" label="當前狀態" min-width="120">
            <template #default="{ row }">
              <el-tag type="warning" size="small" effect="plain">
                {{ row.currentStatus }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- ── Tab 3: Failure Patterns ───────────────────────────────────────── -->
    <template #failure-patterns>
      <div class="metrics-tab">
        <div class="tab-header">
          <h3 class="tab-title">
            Failure Patterns
          </h3>
          <p class="tab-desc">
            即時讀取 <code>~/.claude/.ab-tao/corrections/failure-patterns.md</code>，檔案異動時自動更新。
          </p>
          <div class="connection-status">
            <el-tag
              :type="failurePatternsConnected ? 'success' : 'danger'"
              size="small"
              effect="plain"
            >
              {{ failurePatternsConnected ? '已連線' : '未連線' }}
            </el-tag>
            <el-button size="small" plain @click="connectFailurePatterns">
              重新連線
            </el-button>
          </div>
        </div>
        <el-alert
          v-if="failurePatternsError"
          :title="failurePatternsError"
          type="error"
          show-icon
          :closable="false"
          style="margin-bottom: 12px"
        />
        <pre class="failure-patterns-content">{{ failurePatternsContent }}</pre>
      </div>
    </template>
  </SectionTabs>
</template>

<style scoped>
.metrics-tab {
  padding: 8px 0;
}

.tab-header {
  margin-bottom: 20px;
}

.tab-title {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tab-desc {
  margin: 0 0 10px;
  font-size: 0.85rem;
  color: var(--el-text-color-secondary);
}

.tab-desc code {
  font-family: monospace;
  font-size: 0.82rem;
  background-color: var(--el-fill-color-light);
  padding: 1px 4px;
  border-radius: 3px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-hint {
  padding: 16px 0;
  text-align: center;
}

.failure-patterns-content {
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 560px;
  overflow-y: auto;
  margin: 0;
}
</style>
