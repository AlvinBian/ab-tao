<script setup lang="ts">
import type { GaugeSeriesOption } from 'echarts/charts'
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  zshInstalled: ReadonlyArray<string>
  zshAvailable: ReadonlyArray<string>
  claudeHudWrapperDeployed: boolean
  claudeHudStatusLineConfigured: boolean
  envMissingCount: number
  envEmptyCount: number
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const successColor = useElCssVar('--el-color-success', '#67c23a')
const warningColor = useElCssVar('--el-color-warning', '#e6a23c')
const dangerColor = useElCssVar('--el-color-danger', '#f56c6c')
const borderColor = useElCssVar('--el-border-color', '#dcdfe6')

const zshScore = computed(() => {
  const installedSet = new Set(props.zshInstalled)
  const covered = props.zshAvailable.filter(m => installedSet.has(m)).length
  return Math.min(
    100,
    Math.round((covered / Math.max(props.zshAvailable.length, 1)) * 100),
  )
})

const claudeHudScore = computed(() => {
  if (props.claudeHudWrapperDeployed && props.claudeHudStatusLineConfigured)
    return 100
  if (props.claudeHudWrapperDeployed)
    return 60
  return 0
})

const envScore = computed(() =>
  Math.max(0, 100 - (props.envMissingCount + props.envEmptyCount) * 20),
)

function makeGauge(
  center: [string, string],
  title: string,
  value: number,
): GaugeSeriesOption {
  return {
    type: 'gauge',
    center,
    radius: '72%',
    startAngle: 200,
    endAngle: -20,
    min: 0,
    max: 100,
    axisLine: {
      lineStyle: {
        width: 10,
        color: [
          [0.3, dangerColor.value],
          [0.7, warningColor.value],
          [1, successColor.value],
        ],
      },
    },
    pointer: { length: '60%', width: 3 },
    axisTick: {
      distance: -10,
      length: 4,
      lineStyle: { color: borderColor.value },
    },
    splitLine: {
      distance: -10,
      length: 8,
      lineStyle: { color: borderColor.value },
    },
    axisLabel: { distance: 14, fontSize: 9 },
    detail: {
      formatter: '{value}%',
      fontSize: 14,
      offsetCenter: [0, '60%'],
    },
    title: { offsetCenter: [0, '85%'], fontSize: 11 },
    data: [{ name: title, value }],
  }
}

const option = computed<ECOption>(() => ({
  series: [
    makeGauge(['17%', '55%'], 'ZSH 覆蓋率', zshScore.value),
    makeGauge(['50%', '55%'], 'claude-hud 健康', claudeHudScore.value),
    makeGauge(['83%', '55%'], '環境變數', envScore.value),
  ],
}))
</script>

<template>
  <el-skeleton v-if="loading" :rows="3" animated />
  <el-alert v-else-if="error" :title="error" type="error" show-icon />
  <VChart
    v-else
    :option="option"
    :style="{ height: heightPx, width: '100%' }"
    autoresize
  />
</template>
