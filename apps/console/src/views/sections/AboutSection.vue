<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

// biome-ignore lint/correctness/noUnusedVariables: used in template
const appVersion = import.meta.env.VITE_APP_VERSION ?? "dev";
// biome-ignore lint/correctness/noUnusedVariables: used in template
const loading = computed(() => store.loading);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const overview = computed(() => store.data?.overview);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const skills = computed(() => store.data?.skills ?? []);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const plugins = computed(() => store.data?.plugins ?? []);
</script>

<template>
  <div style="padding: 24px; max-width: 800px">
    <el-descriptions title="ab-tao Console" :column="2" border>
      <el-descriptions-item label="版本">
        <el-tag type="info">{{ appVersion }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="健康度">
        <el-progress
          v-if="overview"
          :percentage="overview.healthPct"
          :status="overview.healthPct >= 80 ? 'success' : overview.healthPct >= 50 ? 'warning' : 'exception'"
          style="width: 200px"
        />
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="Skills 安裝數">
        {{ skills.length }}
      </el-descriptions-item>
      <el-descriptions-item label="Plugins 安裝數">
        {{ plugins.length }}
      </el-descriptions-item>
    </el-descriptions>

    <el-divider />

    <el-skeleton v-if="loading" :rows="4" animated />
    <el-empty v-else-if="!overview" description="無法取得狀態資訊" />
    <el-descriptions v-else title="系統資訊" :column="2" border>
      <el-descriptions-item label="已安裝總計">{{ overview.totalInstalled }}</el-descriptions-item>
      <el-descriptions-item label="已使用總計">{{ overview.totalUsed }}</el-descriptions-item>
      <el-descriptions-item label="指令使用率">{{ (overview.commandUsageRate * 100).toFixed(1) }}%</el-descriptions-item>
      <el-descriptions-item label="Agent 使用率">{{ (overview.agentUsageRate * 100).toFixed(1) }}%</el-descriptions-item>
    </el-descriptions>
  </div>
</template>
