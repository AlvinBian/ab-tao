<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  resources: Array<{ name: string, kind: string, count?: number }>
  topN?: number
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const primary = useElCssVar('--el-color-primary', '#409eff')
const success = useElCssVar('--el-color-success', '#67c23a')
const warning = useElCssVar('--el-color-warning', '#e6a23c')
const info = useElCssVar('--el-color-info', '#909399')
const labelSecondary = useElCssVar('--el-text-color-secondary', '#909399')
const labelRegular = useElCssVar('--el-text-color-regular', '#606266')
const splitLine = useElCssVar('--el-border-color-lighter', '#ebeef5')

const kindColor: Record<string, () => string> = {
  skill: () => primary.value,
  command: () => success.value,
  agent: () => warning.value,
  rule: () => info.value,
}

const hasData = computed(() => (props.resources?.length ?? 0) > 0)

const option = computed<ECOption>(() => {
  const sorted = [...(props.resources ?? [])]
    .filter(r => (r.count ?? 0) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, props.topN ?? 10)
  const names = sorted.map(r => r.name).reverse()
  const values = sorted
    .map(r => ({
      value: r.count ?? 0,
      itemStyle: {
        color: kindColor[r.kind]?.() ?? info.value,
        borderRadius: [0, 4, 4, 0],
      },
    }))
    .reverse()

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 130, right: 40, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: labelSecondary.value, fontSize: 11 },
      splitLine: { lineStyle: { color: splitLine.value } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: labelRegular.value,
        fontSize: 11,
        width: 120,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barMaxWidth: 20,
        label: { show: true, position: 'right', fontSize: 11 },
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
  <el-empty v-else description="無使用記錄" :image-size="40" />
</template>
