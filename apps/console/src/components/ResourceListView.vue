<script setup lang="ts">
import type { ResourceEntry } from '@/types/resources'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

interface ResourceStore {
  items: ResourceEntry[]
  loading: boolean
  error: string | null
  toggling: Set<string>
  fetchItems: (_force?: boolean) => Promise<void>
  toggleEnabled: (_name: string, _enabled: boolean) => Promise<void>
}

const props = defineProps<{
  store: ResourceStore
  kindLabel: string
  showSourceColumn?: boolean
  showPathColumn?: boolean
}>()

const searchQuery = ref('')

const filteredItems = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q)
    return props.store.items
  return props.store.items.filter(
    s =>
      s.name.toLowerCase().includes(q)
      || s.description?.toLowerCase().includes(q),
  )
})

const enabledCount = computed(
  () => props.store.items.filter(s => s.enabled).length,
)

function sourceTagType(
  source?: string,
): 'primary' | 'success' | 'warning' | 'info' {
  if (source === 'ab-tao')
    return 'primary'
  if (source === 'ecc')
    return 'success'
  if (source === 'custom')
    return 'warning'
  return 'info'
}

const sourceGroupsData = computed(() => {
  const counts = new Map<string, number>()
  for (const item of props.store.items) {
    const src = item.source ?? 'custom'
    counts.set(src, (counts.get(src) ?? 0) + 1)
  }
  return [...counts.entries()].map(([src, count]) => ({
    name: src,
    kind: props.kindLabel.toLowerCase(),
    count,
  }))
})

async function onToggle(name: string, enabled: boolean) {
  try {
    await props.store.toggleEnabled(name, enabled)
    ElMessage.success(`${name} 已${enabled ? '啟用' : '停用'}`)
  }
  catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '切換失敗')
  }
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <el-card shadow="never" style="margin-bottom:16px">
      <el-row align="middle" justify="space-between">
        <el-col :span="12">
          <el-statistic title="已啟用" :value="enabledCount" style="display:inline-block; margin-right:16px" />
          <el-statistic title="總計" :value="store.items.length" style="display:inline-block" />
        </el-col>
        <el-col :span="8">
          <el-input v-model="searchQuery" :placeholder="`搜尋 ${kindLabel} 名稱...`" clearable size="small" :prefix-icon="Search" />
        </el-col>
      </el-row>
    </el-card>

    <!-- 資源來源分佈 -->
    <el-row v-if="store.items.length > 0" :gutter="16" style="margin-bottom:16px">
      <el-col :span="12">
        <el-card shadow="never" style="height:100%">
          <template #header>
            <span>來源分佈</span>
          </template>
          <ResourceSourcePie :resources="store.items" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" style="height:100%">
          <template #header>
            <span>來源數量</span>
          </template>
          <ResourceUsageBar :resources="sourceGroupsData" />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <el-table :data="filteredItems" stripe size="small" style="width:100%">
        <el-table-column prop="name" label="名稱" min-width="160" sortable show-overflow-tooltip />
        <el-table-column prop="description" label="說明" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="color:var(--el-text-color-regular); font-size:12px">{{ row.description ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="showSourceColumn" label="來源" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="sourceTagType(row.source)" size="small">
              {{ row.source ?? "—" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="showPathColumn" prop="path" label="路徑" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size:11px; color:var(--el-text-color-secondary)">{{ row.path ?? "—" }}</code>
          </template>
        </el-table-column>
        <el-table-column label="狀態" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? "啟用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="切換" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="store.toggling.has(row.name)"
              @change="(v: string | number | boolean) => onToggle(row.name, v as boolean)"
            />
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!store.loading && filteredItems.length === 0" :description="`無 ${kindLabel} 資料`" />
    </el-card>
  </div>
</template>
