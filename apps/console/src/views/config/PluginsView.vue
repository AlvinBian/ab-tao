<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const store = useSettingsStore()
onMounted(() => store.fetchSettings())

const pluginEntries = computed(() => {
  const plugins = store.settings?.enabledPlugins ?? {}
  return Object.entries(plugins)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, enabled]) => ({ name, enabled }))
})

const enabledCount = computed(
  () => pluginEntries.value.filter(p => p.enabled).length,
)

async function onToggle(name: string, enabled: boolean) {
  try {
    await store.patchPluginEnabled(name, enabled)
    ElMessage.success(`${name} 已${enabled ? '啟用' : '停用'}`)
  }
  catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '切換失敗')
  }
}

function pluginShortName(full: string): string {
  return full.split('@')[0] ?? full
}

function pluginSource(full: string): string {
  return full.split('@')[1] ?? '—'
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 摘要 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <el-row :gutter="12">
        <el-col :span="6">
          <el-statistic title="已啟用" :value="enabledCount" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="總計" :value="pluginEntries.length" />
        </el-col>
      </el-row>
    </el-card>

    <!-- 啟用比例圖 -->
    <el-card v-if="pluginEntries.length > 0" shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>啟用比例</span>
      </template>
      <PluginStatusPie :total="pluginEntries.length" :enabled="enabledCount" />
    </el-card>

    <el-card shadow="never">
      <el-table :data="pluginEntries" stripe size="small" style="width:100%">
        <el-table-column label="名稱" min-width="180">
          <template #default="{ row }">
            <span style="font-weight:500">{{ pluginShortName(row.name) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="來源" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ pluginSource(row.name) }}
            </el-tag>
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
              :loading="store.saving"
              @change="(v: string | number | boolean) => onToggle(row.name, v as boolean)"
            />
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!store.loading && !pluginEntries.length" description="無 Plugin 設定" />
    </el-card>
  </div>
</template>
