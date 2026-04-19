<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useSkillsStore } from "@/stores/resources";

const store = useSkillsStore();
onMounted(() => store.fetchItems());

const searchQuery = ref("");

const filteredItems = computed(() => {
	const q = searchQuery.value.toLowerCase();
	if (!q) return store.items;
	return store.items.filter((s) => s.name.toLowerCase().includes(q));
});

const enabledCount = computed(() => store.items.filter((s) => s.enabled).length);

function sourceTagType(source?: string): "primary" | "success" | "warning" | "info" {
	if (source === "ab-tao") return "primary";
	if (source === "ecc") return "success";
	if (source === "custom") return "warning";
	return "info";
}

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

    <!-- 標頭 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <el-row align="middle" justify="space-between">
        <el-col :span="12">
          <el-statistic title="已啟用" :value="enabledCount" style="display:inline-block; margin-right:16px" />
          <el-statistic title="總計" :value="store.items.length" style="display:inline-block" />
        </el-col>
        <el-col :span="8">
          <el-input v-model="searchQuery" placeholder="搜尋 Skill 名稱..." clearable size="small" prefix-icon="Search" />
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never">
      <el-table :data="filteredItems" stripe style="width:100%">
        <el-table-column prop="name" label="名稱" min-width="180" sortable show-overflow-tooltip />
        <el-table-column label="來源" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="sourceTagType(row.source)" size="small">{{ row.source ?? "—" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="路徑" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size:11px; color:var(--el-text-color-secondary)">{{ row.path ?? "—" }}</code>
          </template>
        </el-table-column>
        <el-table-column label="啟用" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :loading="store.toggling.has(row.name)"
              @change="(v: boolean) => onToggle(row.name, v)"
            />
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!store.loading && filteredItems.length === 0" description="無 Skill 資料" />
    </el-card>
  </div>
</template>
