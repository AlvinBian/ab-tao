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
  const data = Object.entries(props.stacks ?? {}).map(([cat, items]) => ({
    name: cat,
    value: items.length,
    itemStyle: { color: getCategoryColor(cat) },
    children: items.map(item => ({
      name: item,
      value: 1,
      itemStyle: { color: getCategoryColor(cat) },
    })),
  }))

  return {
    tooltip: {
      formatter: (info: unknown) => {
        const p = info as {
          name?: string
          value?: number
          treePathInfo?: Array<{ name: string }>
        }
        const path = (p.treePathInfo ?? []).map(x => x.name).join(' / ')
        return `${path || p.name}: ${p.value}`
      },
    },
    series: [
      {
        type: 'treemap',
        data,
        width: '100%',
        height: '100%',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { show: true, fontSize: 11, overflow: 'truncate' },
        upperLabel: { show: true, height: 22, fontSize: 11 },
        itemStyle: { borderWidth: 2, borderColor: '#fff' },
        levels: [
          { itemStyle: { borderWidth: 2, borderColor: '#fff', gapWidth: 2 } },
          {
            itemStyle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
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
  <template v-else-if="hasData">
    <VChart
      :option="option"
      :style="{ height: heightPx, width: '100%' }"
      autoresize
    />
  </template>
  <el-empty v-else description="無技術棧資料" :image-size="40" />
</template>
