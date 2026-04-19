<script setup lang="ts">
import { onMounted } from "vue";
import { useExtendedStore } from "@/stores/extended";
import { useStatusStore } from "@/stores/status";

const ext = useExtendedStore();
const status = useStatusStore();
onMounted(() => {
	ext.fetch();
	status.fetchOverview();
});
</script>

<template>
  <div v-loading="ext.loading || status.loading">
    <el-card shadow="never">
      <template #header>MemoryView — 建置中（Wave 1）</template>
      <el-empty description="此頁面將在 Wave 1 實作完整內容" />
    </el-card>
  </div>
</template>
