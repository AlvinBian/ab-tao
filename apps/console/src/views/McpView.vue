<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useStatusStore } from "@/stores/status";

const store = useStatusStore();
onMounted(() => store.fetchData());

const mcp = computed(() => store.data?.extended?.mcp);
const servers = computed(() => mcp.value?.servers ?? []);
const enabledPlugins = computed(() => mcp.value?.enabledPlugins ?? []);
const installedPlugins = computed(() => store.data?.installedPlugins ?? []);
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <el-row :gutter="16" style="margin-bottom:16px">
      <!-- MCP Servers -->
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <span>MCP Servers（{{ servers.length }}）</span>
          </template>
          <el-table :data="servers" stripe size="small" style="width:100%">
            <el-table-column prop="name" label="名稱" min-width="160" />
            <el-table-column prop="type" label="類型" width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="row.type === 'sse' ? 'warning' : 'primary'">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="command" label="Command / URL" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <code style="font-size:11px; color:var(--el-text-color-secondary)">{{ row.command }}</code>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!servers.length && !store.loading" description="未設定 MCP Server" />
        </el-card>
      </el-col>

      <!-- Enabled Plugins -->
      <el-col :span="8">
        <el-card shadow="never" style="height:100%">
          <template #header><span>Enabled Plugins（{{ enabledPlugins.length }}）</span></template>
          <div style="display:flex; flex-wrap:wrap; gap:6px">
            <el-tag
              v-for="name in enabledPlugins"
              :key="name"
              size="small"
              type="success"
            >{{ name }}</el-tag>
            <el-empty v-if="!enabledPlugins.length" description="無啟用 Plugin" :image-size="40" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Installed Plugins -->
    <el-card shadow="never">
      <template #header>
        <span>已安裝 Plugins</span>
        <el-tag v-if="!installedPlugins" type="info" size="small" style="margin-left:8px">CLI 不可用</el-tag>
      </template>
      <el-table v-if="installedPlugins && installedPlugins.length" :data="installedPlugins" stripe size="small">
        <el-table-column prop="name" label="名稱" min-width="160" />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="repo" label="Repo" min-width="200" show-overflow-tooltip />
      </el-table>
      <el-empty v-else-if="!store.loading" description="無安裝資料（claude plugin list 失敗或未安裝）" />
    </el-card>
  </div>
</template>
