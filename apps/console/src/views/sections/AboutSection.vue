<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

// biome-ignore lint/correctness/noUnusedVariables: used in template
const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev";
// biome-ignore lint/correctness/noUnusedVariables: used in template
const doctorData = computed(() => store.data?.doctor);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const loading = computed(() => store.loading);
</script>

<template>
  <div style="padding: 24px; max-width: 800px">
    <el-descriptions title="ab-tao Console" :column="2" border>
      <el-descriptions-item label="版本">
        <el-tag type="info">{{ appVersion }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="文件">
        <el-link type="primary" href="https://github.com/alvin-b/ab-tao" target="_blank">
          GitHub
        </el-link>
      </el-descriptions-item>
    </el-descriptions>

    <el-divider />

    <div v-if="loading">
      <el-skeleton :rows="4" animated />
    </div>
    <div v-else-if="doctorData">
      <h3 style="margin-bottom: 12px">模組安裝狀態</h3>
      <el-table :data="Object.entries(doctorData)" stripe size="small">
        <el-table-column label="模組" min-width="180">
          <template #default="{ row }">{{ row[0] }}</template>
        </el-table-column>
        <el-table-column label="狀態" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row[1] ? 'success' : 'danger'" size="small">
              {{ row[1] ? '已安裝' : '未安裝' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-empty v-else description="無法取得模組狀態" />
  </div>
</template>
