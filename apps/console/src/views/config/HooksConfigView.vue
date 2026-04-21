<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useSettingsStore } from "@/stores/settings";

const store = useSettingsStore();
onMounted(() => store.fetchSettings());

interface HookEntryFlat {
	event: string;
	id: string;
	description: string;
	command: string;
	timeout?: number;
}

const flatHooks = computed<HookEntryFlat[]>(() => {
	const hooks = store.settings?.hooks ?? {};
	const result: HookEntryFlat[] = [];
	for (const [event, entries] of Object.entries(hooks)) {
		for (const entry of entries) {
			for (const h of entry.hooks ?? []) {
				result.push({
					event,
					id: entry.id,
					description: entry.description,
					command: h.command,
					timeout: h.timeout,
				});
			}
		}
	}
	return result;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const events = computed(() => [
	...new Set(flatHooks.value.map((h) => h.event)),
]);
</script>

<template>
  <div v-loading="store.loading">
    <el-alert v-if="store.error" :title="store.error" type="error" show-icon style="margin-bottom:16px" />

    <!-- 摘要 -->
    <el-card shadow="never" style="margin-bottom:16px">
      <el-row :gutter="12">
        <el-col :span="6">
          <el-statistic title="總 Hook 數" :value="flatHooks.length" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="事件類型" :value="events.length" />
        </el-col>
      </el-row>
    </el-card>

    <!-- 按事件分組 -->
    <el-card v-for="event in events" :key="event" shadow="never" style="margin-bottom:12px">
      <template #header>
        <span>{{ event }}</span>
        <el-tag size="small" style="margin-left:8px">
          {{ flatHooks.filter(h => h.event === event).length }} 個 Hook
        </el-tag>
      </template>
      <el-table :data="flatHooks.filter(h => h.event === event)" size="small" style="width:100%">
        <el-table-column prop="id" label="ID" width="200" show-overflow-tooltip />
        <el-table-column prop="description" label="說明" min-width="180" show-overflow-tooltip />
        <el-table-column label="指令" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size:11px; color:var(--el-text-color-secondary)">{{ row.command }}</code>
          </template>
        </el-table-column>
        <el-table-column label="Timeout" width="90" align="center">
          <template #default="{ row }">
            <span v-if="row.timeout">{{ row.timeout }}s</span>
            <span v-else style="color:var(--el-text-color-placeholder)">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-empty v-if="!store.loading && flatHooks.length === 0" description="settings.json 中無 Hook 設定" />
  </div>
</template>
