<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  commandUsageRate: number
  agentUsageRate: number
  hookHealthRate: number
  skillEnabledRate: number
  envScore: number
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const primary = useElCssVar('--el-color-primary', '#409eff')
const fill = useElCssVar('--el-color-primary-light-7', '#c6e2ff')
const labelRegular = useElCssVar('--el-text-color-regular', '#606266')
const splitLine = useElCssVar('--el-border-color-lighter', '#ebeef5')

const option = computed<ECOption>(() => ({
  radar: {
    indicator: [
      { name: '指令使用率', max: 100 },
      { name: 'Agent 使用率', max: 100 },
      { name: 'Hook 健康率', max: 100 },
      { name: 'Skill 啟用率', max: 100 },
      { name: '環境分數', max: 100 },
    ],
    axisName: { color: labelRegular.value, fontSize: 11 },
    splitLine: { lineStyle: { color: splitLine.value } },
    splitArea: { show: false },
  },
  series: [
    {
      type: 'radar',
      data: [
        {
          value: [
            props.commandUsageRate,
            props.agentUsageRate,
            props.hookHealthRate,
            props.skillEnabledRate,
            props.envScore,
          ],
          name: '健康指標',
          lineStyle: { color: primary.value, width: 2 },
          areaStyle: { color: fill.value, opacity: 0.4 },
          itemStyle: { color: primary.value },
        },
      ],
    },
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
