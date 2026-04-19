<script setup lang="ts">
import { onMounted } from "vue";
import { useExtendedStore } from "@/stores/extended";

const store = useExtendedStore();
onMounted(() => store.fetch());
</script>

<template>
  <div v-loading="store.loading">
    <el-card shadow="never">
      <template #header>Hooks 健檢</template>
      <el-table :data="store.data?.hooks?.hooks ?? []" stripe>
        <el-table-column prop="event" label="Event" width="180" />
        <el-table-column prop="name" label="名稱" />
        <el-table-column label="狀態" width="120">
          <template #default="{ row }">
            <el-tag :type="row.exists && row.executable ? 'success' : 'danger'" size="small">
              {{ row.exists && row.executable ? 'healthy' : row.exists ? 'not-exec' : 'missing' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="script" label="Script" class-name="mono" show-overflow-tooltip />
      </el-table>
    </el-card>
  </div>
</template>
