<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { getCategoryColor } from './categoryColors'
import '@/charts/registry'

const props = defineProps<{
  stacks: Record<string, string[]>
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const hasData = computed(() => Object.keys(props.stacks ?? {}).length > 0)

const option = computed<ECOption>(() => {
  const sorted = Object.entries(props.stacks)
    .filter(([, t]) => t.length > 0)
    .sort(([, a], [, b]) => b.length - a.length)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 110, right: 30, top: 10, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    yAxis: {
      type: 'category',
      data: sorted.map(([cat]) => cat).reverse(),
      axisLabel: { fontSize: 11, width: 100, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: sorted
          .map(([cat, techs]) => ({
            value: techs.length,
            itemStyle: {
              color: getCategoryColor(cat),
              borderRadius: [0, 4, 4, 0] as [number, number, number, number],
            },
          }))
          .reverse(),
        barMaxWidth: 20,
        label: { show: true, position: 'right', fontSize: 10 },
      },
    ],
  }
})
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="!hasData" description="無技術棧資料" :image-size="40" />
  <VChart v-else :option="option" :style="{ height: heightPx, width: '100%' }" autoresize />
</template>
