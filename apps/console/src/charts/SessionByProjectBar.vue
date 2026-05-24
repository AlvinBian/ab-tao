<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  byProject: Record<string, number>
  topN?: number
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

// ECharts canvas 不解析 CSS 變數，runtime 解析後注入實色
const primaryColor = useElCssVar('--el-color-primary', '#409eff')
const labelSecondary = useElCssVar('--el-text-color-secondary', '#909399')
const labelRegular = useElCssVar('--el-text-color-regular', '#606266')
const splitLine = useElCssVar('--el-border-color-lighter', '#ebeef5')

const hasData = computed(() => Object.keys(props.byProject ?? {}).length > 0)

const option = computed<ECOption>(() => {
  const sorted = Object.entries(props.byProject)
    .sort(([, a], [, b]) => b - a)
    .slice(0, props.topN ?? 8)

  // byProject key 已由 server-side humanizeProjectPath 還原為可讀路徑，取最後一段即可
  const names = sorted.map(([k]) => k.split('/').pop() ?? k)
  const values = sorted.map(([, v]) => v)

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 170, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { color: labelSecondary.value, fontSize: 11 },
      splitLine: { lineStyle: { color: splitLine.value } },
    },
    yAxis: {
      type: 'category',
      data: names.reverse(),
      axisLabel: {
        color: labelRegular.value,
        fontSize: 11,
        width: 160,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        data: values.reverse(),
        itemStyle: { color: primaryColor.value, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 20,
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
  <el-empty v-else description="無 Session 資料" :image-size="40" />
</template>
