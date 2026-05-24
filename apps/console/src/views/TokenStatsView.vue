<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import TokensPerDayBar from '@/charts/TokensPerDayBar.vue'
import { useStatusStore } from '@/stores/status'

type Range = '7d' | '30d' | 'all'
type Dimension = 'tokens' | 'requests'

const store = useStatusStore()

const range = ref<Range>('7d')
const dimension = ref<Dimension>('tokens')
const visibleModels = ref<string[]>([])

const allModels = computed(() => store.aiUsage?.allModels ?? [])
const byDay = computed(() => store.aiUsage?.byDay ?? null)
const meta = computed(() => store.aiUsage?.meta ?? null)
const byModel = computed(() => store.aiUsage?.byModel ?? [])

const totalTokens = computed(() =>
  byModel.value.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0),
)

function fmt(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtModel(name: string) {
  return name.replace('claude-', '').replace(/-\d+$/, m => ` v${m.slice(1)}`)
}

async function load() {
  await store.loadAiUsage(range.value)
  // 預設全選
  if (visibleModels.value.length === 0 && allModels.value.length > 0) {
    visibleModels.value = [...allModels.value]
  }
}

watch(range, () => load())
onMounted(() => load())

const rangeOptions: { label: string, value: Range }[] = [
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
  { label: '全部', value: 'all' },
]

const dimOptions: { label: string, value: Dimension }[] = [
  { label: 'Tokens', value: 'tokens' },
  { label: 'Requests', value: 'requests' },
]
</script>

<template>
  <div class="token-stats">
    <!-- 控制列 -->
    <div class="controls">
      <el-segmented v-model="range" :options="rangeOptions" size="small" />
      <el-segmented v-model="dimension" :options="dimOptions" size="small" />
      <el-button
        size="small"
        :loading="store.aiUsageLoading"
        @click="load"
      >
        刷新
      </el-button>
    </div>

    <!-- 統計卡 -->
    <div v-if="meta && meta.source !== 'absent'" class="stat-cards">
      <div class="stat-card">
        <div class="label">
          Total Tokens
        </div>
        <div class="value">
          {{ fmt(totalTokens) }}
        </div>
      </div>
      <div class="stat-card">
        <div class="label">
          Requests
        </div>
        <div class="value">
          {{ meta.totalRequests.toLocaleString() }}
        </div>
      </div>
      <div class="stat-card">
        <div class="label">
          Sessions
        </div>
        <div class="value">
          {{ meta.fileCount }}
        </div>
      </div>
      <div class="stat-card">
        <div class="label">
          Models
        </div>
        <div class="value">
          {{ allModels.length }}
        </div>
      </div>
    </div>

    <!-- 主圖表 -->
    <div class="chart-wrap">
      <TokensPerDayBar
        :data="byDay"
        :all-models="allModels"
        :visible-models="visibleModels"
        :dimension="dimension"
        :loading="store.aiUsageLoading"
        :error="store.aiUsageError"
        :height="320"
      />
    </div>

    <!-- Model 篩選 + 明細 -->
    <div v-if="allModels.length > 0" class="model-section">
      <div class="section-title">
        Model 篩選
      </div>
      <el-checkbox-group v-model="visibleModels" size="small">
        <el-checkbox
          v-for="m in allModels"
          :key="m"
          :label="m"
          :value="m"
          border
        >
          {{ fmtModel(m) }}
        </el-checkbox>
      </el-checkbox-group>

      <!-- Model 明細表 -->
      <el-table
        :data="byModel"
        size="small"
        style="margin-top: 16px"
        :border="false"
      >
        <el-table-column prop="model" label="Model" min-width="180">
          <template #default="{ row }">
            <span class="model-name">{{ fmtModel(row.model) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="requests" label="Requests" align="right" width="90">
          <template #default="{ row }">
            {{ row.requests.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="Input" align="right" width="100">
          <template #default="{ row }">
            {{ fmt(row.inputTokens) }}
          </template>
        </el-table-column>
        <el-table-column label="Output" align="right" width="100">
          <template #default="{ row }">
            {{ fmt(row.outputTokens) }}
          </template>
        </el-table-column>
        <el-table-column label="Cache Read" align="right" width="110">
          <template #default="{ row }">
            {{ fmt(row.cacheReadTokens) }}
          </template>
        </el-table-column>
        <el-table-column label="Total" align="right" width="100">
          <template #default="{ row }">
            {{ fmt(row.inputTokens + row.outputTokens) }}
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-empty
      v-if="!store.aiUsageLoading && meta?.source === 'absent'"
      description="尚未找到 session 資料"
      :image-size="60"
    />
    <el-empty
      v-else-if="!store.aiUsageLoading && meta?.source === 'empty'"
      description="此時間範圍內無資料"
      :image-size="60"
    />
  </div>
</template>

<style scoped>
.token-stats {
  padding: 4px 0;
}

.controls {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
}

.stat-card .label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.stat-card .value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.chart-wrap {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 10px;
}

.model-section {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 16px;
}

.model-name {
  font-size: 12px;
  font-family: monospace;
}
</style>
