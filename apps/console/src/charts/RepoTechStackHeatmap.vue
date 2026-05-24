<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

interface RepoTechData {
  repo: string
  techStacks: string[]
}

const props = defineProps<{
  data: RepoTechData[] | null
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

function isEmpty(d: unknown): boolean {
  return (
    d == null
    || (Array.isArray(d) && d.length === 0)
    || (typeof d === 'object'
      && !Array.isArray(d)
      && Object.keys(d as object).length === 0)
  )
}

const primary = useElCssVar('--el-color-primary', '#409eff')
const fill = useElCssVar('--el-fill-color-light', '#f5f7fa')
const labelSecondary = useElCssVar('--el-text-color-secondary', '#909399')
const labelRegular = useElCssVar('--el-text-color-regular', '#606266')
const borderColor = useElCssVar('--el-border-color-lighter', '#ebeef5')

const option = computed<ECOption>(() => {
  const rows = props.data ?? []

  // 收集所有唯一技術棧
  const techSet = new Set<string>()
  for (const r of rows) {
    for (const t of r.techStacks) {
      techSet.add(t)
    }
  }
  const techs = [...techSet].sort()
  const repos = rows.map(r => r.repo)

  // 建立矩陣：[techIndex, repoIndex, value]
  const heatData: [number, number, number][] = []
  for (let ri = 0; ri < rows.length; ri++) {
    const stackSet = new Set(rows[ri].techStacks)
    for (let ti = 0; ti < techs.length; ti++) {
      heatData.push([ti, ri, stackSet.has(techs[ti]) ? 1 : 0])
    }
  }

  return {
    tooltip: {
      formatter: (p: unknown) => {
        const params = p as { data: [number, number, number] }
        const [ti, ri] = params.data
        return `${repos[ri]} × ${techs[ti]}: ${params.data[2] ? '✓' : '✗'}`
      },
    },
    grid: {
      left: 120,
      right: 20,
      top: 10,
      bottom: techs.length > 8 ? 80 : 50,
    },
    xAxis: {
      type: 'category',
      data: techs,
      axisLabel: {
        color: labelRegular.value,
        fontSize: 10,
        rotate: 30,
        width: 80,
        overflow: 'truncate',
      },
      splitArea: { show: true, areaStyle: { color: [fill.value, '#fff'] } },
    },
    yAxis: {
      type: 'category',
      data: repos,
      axisLabel: {
        color: labelSecondary.value,
        fontSize: 11,
        width: 110,
        overflow: 'truncate',
      },
      splitArea: { show: true, areaStyle: { color: [fill.value, '#fff'] } },
    },
    visualMap: {
      min: 0,
      max: 1,
      show: false,
      inRange: { color: [borderColor.value, primary.value] },
    },
    series: [
      {
        type: 'heatmap',
        data: heatData,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' },
        },
      },
    ],
  }
})
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <el-empty v-else-if="isEmpty(data)" description="暫無資料" :image-size="40" />
  <VChart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
