<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  drift: ReadonlyArray<{ decision: string, path: string }>
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const warning = useElCssVar('--el-color-warning', '#e6a23c')
const danger = useElCssVar('--el-color-danger', '#f56c6c')
const info = useElCssVar('--el-color-info', '#909399')

const decisionColor: Record<string, () => string> = {
  modified: () => warning.value,
  deleted: () => danger.value,
  added: () => info.value,
}

const hasData = computed(() => (props.drift?.length ?? 0) > 0)

const option = computed<ECOption>(() => {
  const counts = new Map<string, number>()
  for (const d of props.drift ?? []) {
    counts.set(d.decision, (counts.get(d.decision) ?? 0) + 1)
  }
  const data = [...counts.entries()].map(([dec, count]) => ({
    name: dec,
    value: count,
    itemStyle: { color: decisionColor[dec]?.() ?? info.value },
  }))
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '45%'],
        data,
        label: { formatter: '{b}: {c}', fontSize: 11 },
      },
    ],
  }
})
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="hasData">
    <VChart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
    />
  </template>
  <el-empty v-else description="無 Drift 異動" :image-size="40" />
</template>
