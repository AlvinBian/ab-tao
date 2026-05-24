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
  const children = Object.entries(props.stacks)
    .filter(([, techs]) => techs.length > 0)
    .map(([category, techs]) => ({
      name: category,
      itemStyle: { color: getCategoryColor(category) },
      children: techs.slice(0, 15).map(t => ({
        name: t,
        value: 1,
      })),
    }))

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        type: 'sunburst',
        data: children,
        radius: ['10%', '90%'],
        label: {
          fontSize: 11,
          color: 'var(--el-text-color-regular)',
          overflow: 'truncate',
        },
        emphasis: {
          focus: 'ancestor',
          itemStyle: { opacity: 0.9 },
        },
        levels: [
          {},
          {
            r0: '15%',
            r: '55%',
            label: { align: 'right', fontSize: 12, fontWeight: 500 },
          },
          {
            r0: '55%',
            r: '88%',
            label: { position: 'outside', fontSize: 10, padding: 3 },
          },
        ],
      },
    ],
  }
})
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="!hasData" description="無技術棧資料" :image-size="40" />
  <VChart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
