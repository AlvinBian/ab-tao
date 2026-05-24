<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  projects: Array<{ label: string, count: number }>
  topN?: number
  loading?: boolean
  error?: string | null
  height?: number
}>()

const emit = defineEmits<{ select: [label: string] }>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const primary = useElCssVar('--el-color-primary', '#409eff')
const labelSecondary = useElCssVar('--el-text-color-secondary', '#909399')
const labelRegular = useElCssVar('--el-text-color-regular', '#606266')
const splitLine = useElCssVar('--el-border-color-lighter', '#ebeef5')

const hasData = computed(() => (props.projects?.length ?? 0) > 0)

const option = computed<ECOption>(() => {
  const sorted = [...(props.projects ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, props.topN ?? 10)
  const names = sorted.map(p => p.label).reverse()
  const values = sorted.map(p => p.count).reverse()

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 150, right: 30, top: 10, bottom: 30 },
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
        width: 140,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: { color: primary.value, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 20,
        label: { show: true, position: 'right', fontSize: 11 },
      },
    ],
  }
})

function handleClick(params: { name: string }) {
  emit('select', params.name)
}
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <template v-else-if="hasData">
    <VChart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
      @click="handleClick"
    />
  </template>
  <el-empty v-else description="無 Memory 資料" :image-size="40" />
</template>
