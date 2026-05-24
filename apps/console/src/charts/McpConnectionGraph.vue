<script setup lang="ts">
import type { ECOption } from './types'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useElCssVar } from '@/composables/useElCssVar'
import '@/charts/registry'

const props = defineProps<{
  servers: Array<{ name: string, type?: string, toolCount?: number }>
  plugins?: Array<{ name: string, enabled: boolean }>
  loading?: boolean
  error?: string | null
  height?: number
}>()

const heightPx = computed(() => `${props.height ?? 320}px`)

const primary = useElCssVar('--el-color-primary', '#409eff')
const success = useElCssVar('--el-color-success', '#67c23a')
const warning = useElCssVar('--el-color-warning', '#e6a23c')
const info = useElCssVar('--el-color-info', '#909399')
const textColor = useElCssVar('--el-text-color-regular', '#606266')

const hasData = computed(
  () => (props.servers?.length ?? 0) + (props.plugins?.length ?? 0) > 0,
)

const option = computed<ECOption>(() => {
  const nodes: Array<{
    id: string
    name: string
    symbolSize: number
    category: number
    label: { show: boolean }
  }> = [
    {
      id: 'Claude',
      name: 'Claude',
      symbolSize: 36,
      category: 0,
      label: { show: true },
    },
  ]
  const links: Array<{ source: string, target: string }> = []

  for (const s of props.servers ?? []) {
    nodes.push({
      id: s.name,
      name: s.name,
      symbolSize: 20 + Math.min(s.toolCount ?? 1, 10) * 2,
      category: s.type === 'stdio' ? 1 : 2,
      label: { show: true },
    })
    links.push({ source: 'Claude', target: s.name })
  }
  for (const p of props.plugins ?? []) {
    nodes.push({
      id: `p:${p.name}`,
      name: p.name,
      symbolSize: 16,
      category: p.enabled ? 3 : 4,
      label: { show: true },
    })
    links.push({ source: 'Claude', target: `p:${p.name}` })
  }

  return {
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { dataType?: string, data?: { name?: string } }
        return p.dataType === 'node' ? (p.data?.name ?? '') : ''
      },
    },
    legend: {
      data: ['Claude', 'MCP stdio', 'MCP sse', 'Plugin 啟用', 'Plugin 停用'],
      bottom: 0,
      textStyle: { fontSize: 10 },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        data: nodes,
        links,
        categories: [
          { name: 'Claude', itemStyle: { color: primary.value } },
          { name: 'MCP stdio', itemStyle: { color: success.value } },
          { name: 'MCP sse', itemStyle: { color: warning.value } },
          { name: 'Plugin 啟用', itemStyle: { color: primary.value } },
          { name: 'Plugin 停用', itemStyle: { color: info.value } },
        ],
        force: { repulsion: 120, edgeLength: [60, 120] },
        lineStyle: { color: 'source', opacity: 0.6 },
        label: { color: textColor.value, fontSize: 10, position: 'right' },
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
  <el-empty v-else description="無連線資料" :image-size="40" />
</template>
