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

const option = computed<ECOption>(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} 項 ({d}%)' },
  legend: {
    orient: 'vertical',
    left: 'left',
    textStyle: { fontSize: 11 },
    type: 'scroll',
  },
  series: [
    {
      type: 'pie',
      radius: ['30%', '70%'],
      center: ['60%', '50%'],
      data: Object.entries(props.stacks)
        .filter(([, techs]) => techs.length > 0)
        .map(([cat, techs]) => ({
          name: cat,
          value: techs.length,
          itemStyle: { color: getCategoryColor(cat) },
        })),
      label: { fontSize: 11 },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0,0,0,0.2)',
        },
      },
    },
  ],
}))
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="!hasData" description="無技術棧資料" :image-size="40" />
  <VChart v-else :option="option" :style="{ height: heightPx, width: '100%' }" autoresize />
</template>
