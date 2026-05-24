<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  backups: Array<{ id: string, date?: string, fileCount?: number }>
  loading?: boolean
  error?: string | null
  height?: number
}>()

const emit = defineEmits<{ select: [id: string] }>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const primary = useElCssVar('--el-color-primary', '#409eff')
const labelSecondary = useElCssVar('--el-text-color-secondary', '#909399')
const labelRegular = useElCssVar('--el-text-color-regular', '#606266')
const splitLine = useElCssVar('--el-border-color-lighter', '#ebeef5')

const hasData = computed(() => (props.backups?.length ?? 0) > 0)

const option = computed<ECOption>(() => {
  const sorted = [...(props.backups ?? [])].slice(-12)
  const labels = sorted.map(b => b.date?.slice(0, 10) ?? b.id.slice(0, 10))
  const values = sorted.map(b => b.fileCount ?? 1)

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 20, top: 10, bottom: 50 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: labelRegular.value, fontSize: 10, rotate: 30 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: labelSecondary.value, fontSize: 11 },
      splitLine: { lineStyle: { color: splitLine.value } },
    },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: { color: primary.value, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 32,
      },
    ],
  }
})

function handleClick(params: { dataIndex: number }) {
  const backup = props.backups?.[params.dataIndex]
  if (backup)
    emit('select', backup.id)
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
  <el-empty v-else description="無備份記錄" :image-size="40" />
</template>
