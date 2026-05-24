<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useStatusStore } from '@/stores/status'

const store = useStatusStore()
onMounted(() => store.fetchData())

const d = computed(() => store.data?.extended?.state)
const drift = computed(() => store.data?.extended?.drift ?? [])

const managedEntries = computed(() =>
  Object.entries(d.value?.managed ?? {}).map(([path, entry]) => ({
    path,
    sha256: entry.sha256 ?? '—',
    source: entry.source ?? '—',
    installedAt: entry.installedAt ?? '—',
  })),
)

const choiceEntries = computed(() =>
  Object.entries(d.value?.choices ?? {}).map(([path, entry]) => ({
    path,
    decision: entry.decision,
    lockedAt: entry.lockedAt,
  })),
)

function driftTagType(decision: string): 'warning' | 'danger' | 'info' {
  if (decision === 'deleted')
    return 'danger'
  if (decision === 'modified')
    return 'warning'
  return 'info'
}
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- State 版本與 Sync 設定 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>State 設定</span>
      </template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="版本">
          {{ d?.version ?? "—" }}
        </el-descriptions-item>
        <el-descriptions-item label="Sync 工具">
          {{ d?.sync?.tool ?? "—" }}
        </el-descriptions-item>
        <el-descriptions-item label="Managed 檔案數">
          {{ managedEntries.length }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Drift + Choices 圖表 -->
    <el-row v-if="(drift.length > 0 || choiceEntries.length > 0)" :gutter="16" style="margin-bottom:16px">
      <el-col :span="8">
        <el-card shadow="never" style="height:100%">
          <template #header>
            <span>Drift 決策分佈</span>
          </template>
          <DriftAgePie :drift="drift" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" style="height:100%">
          <template #header>
            <span>安裝選擇分佈</span>
          </template>
          <ChoiceDecisionPie :choices="choiceEntries" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" style="height:100%">
          <template #header>
            <span>Managed 檔案來源</span>
          </template>
          <ManagedSourceBar :managed="d?.managed ?? {}" />
        </el-card>
      </el-col>
    </el-row>

    <!-- Drift 報告 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>Drift 報告</span>
        <el-tag
          v-if="drift.length > 0"
          type="warning"
          size="small"
          style="margin-left:8px"
        >
          {{ drift.length }} 個異動
        </el-tag>
        <el-tag v-else type="success" size="small" style="margin-left:8px">
          無 Drift
        </el-tag>
      </template>
      <el-table v-if="drift.length > 0" :data="drift" stripe size="small">
        <el-table-column prop="path" label="路徑" min-width="200" show-overflow-tooltip />
        <el-table-column label="狀態" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="driftTagType(row.decision)" size="small">
              {{ row.decision }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="本地 Hash" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size:11px">{{ row.localHash?.slice(0, 8) ?? "—" }}</code>
          </template>
        </el-table-column>
        <el-table-column label="Template Hash" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size:11px">{{ row.templateHash?.slice(0, 8) ?? "—" }}</code>
          </template>
        </el-table-column>
      </el-table>
      <DriftScatter v-if="drift.length > 0" :drift="drift" style="margin-top:12px" />
      <el-empty v-else description="所有 managed 檔案與 template 一致" />
    </el-card>

    <!-- Managed 檔案 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <template #header>
        <span>Managed 檔案（{{ managedEntries.length }}）</span>
      </template>
      <el-table :data="managedEntries" stripe size="small" max-height="300">
        <el-table-column prop="path" label="路徑" min-width="200" show-overflow-tooltip />
        <el-table-column prop="source" label="來源" min-width="160" show-overflow-tooltip />
        <el-table-column label="SHA256" width="100">
          <template #default="{ row }">
            <code style="font-size:11px">{{ row.sha256.slice(0, 8) }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="installedAt" label="安裝時間" width="160" show-overflow-tooltip />
      </el-table>
    </el-card>

    <!-- Choices -->
    <el-card shadow="never">
      <template #header>
        <span>安裝選擇記錄（{{ choiceEntries.length }}）</span>
      </template>
      <el-table :data="choiceEntries" stripe size="small" max-height="300">
        <el-table-column prop="path" label="路徑" min-width="200" show-overflow-tooltip />
        <el-table-column prop="decision" label="決策" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.decision === 'skip' ? 'info' : 'primary'">
              {{ row.decision }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lockedAt" label="決策時間" width="160" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>
