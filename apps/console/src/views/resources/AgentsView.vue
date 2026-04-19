<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useAgentsStore } from "@/stores/resources";

const store = useAgentsStore();
onMounted(() => store.fetchItems());

const searchQuery = ref("");

const filteredItems = computed(() => {
	const q = searchQuery.value.toLowerCase();
	if (!q) return store.items;
	return store.items.filter((s) => s.name.toLowerCase().includes(q));
});

const enabledCount = computed(() => store.items.filter((s) => s.enabled).length);

async function onToggle(name: string, enabled: boolean) {
	try {
		await store.toggleEnabled(name, enabled);
		ElMessage.success(`${name} 已${enabled ? "啟用" : "停用"}`);
	} catch (e) {
		ElMessage.error(e instanceof Error ? e.message : "切換失敗");
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
          <el-input v-model="searchQuery" placeholder="搜尋 Agent 名稱..." clearable size="small" prefix-icon="Search" />
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never">
      <el-table :data="filteredItems" stripe style="width:100%">
        <el-table-column prop="name" label="名稱" min-width="200" sortable show-overflow-tooltip />
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
      <el-empty v-if="!store.loading && filteredItems.length === 0" description="無 Agent 資料" />
    </el-card>
  </div>
</template>
